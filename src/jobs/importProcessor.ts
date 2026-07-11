import { chunkRows } from "../utils/batchChunker";
import { extractCrmBatch, classifyAiError, RateLimitExhaustedError } from "../services/geminiExtractor.service";
import { updateJob, getJob, ImportedRecord, SkippedRecord } from "./jobStore";
import { shouldSkipRecord } from "../validators/crmRecord.schema";
import { sendProgress, sendDone } from "../sse/sseManager";
import { retryWithBackoff } from "../utils/retry";

const BATCH_SIZE = 25;

export async function processImportJob(jobId: string, rows: Record<string, string>[]) {
  updateJob(jobId, { status: "processing" });

  const batches = chunkRows(rows, BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    const job = getJob(jobId);
    if (!job) return;

    if (job.status === "cancelled") {
      sendDone(jobId, job);
      return;
    }

    const batch = batches[i];
    const batchStartIndex = i * BATCH_SIZE;

    try {
      const response = await retryWithBackoff(() =>
        extractCrmBatch({ rows: batch, batchStartIndex })
      );

      const newImported: ImportedRecord[] = [];
      const newSkipped: SkippedRecord[] = [];

      for (const item of response.results) {
        const globalIndex = batchStartIndex + item.sourceRowIndex;

        if (shouldSkipRecord(item.record)) {
          newSkipped.push({
            sourceRowIndex: globalIndex,
            reason: "No email or mobile number found",
            rawRow: batch[item.sourceRowIndex] ?? {},
          });
        } else {
          newImported.push({
            sourceRowIndex: globalIndex,
            record: item.record,
            columnMapping: item.columnMapping ?? {},
          });
        }
      }

      updateJob(jobId, {
        completedBatches: job.completedBatches + 1,
        processedRows: job.processedRows + batch.length,
        imported: [...job.imported, ...newImported],
        skipped: [...job.skipped, ...newSkipped],
      });
    } catch (err: any) {
      // Both models exhausted their quota — stop the whole job now,
      // don't burn remaining quota retrying batches that would fail identically.
      if (err instanceof RateLimitExhaustedError) {
        const remainingSkipped: SkippedRecord[] = batch.map((row, idx) => ({
          sourceRowIndex: batchStartIndex + idx,
          reason: "AI service rate limit reached — this row was not processed.",
          rawRow: row,
          category: "RATE_LIMIT",  
        }));

        updateJob(jobId, {
          status: "rate_limited",
          processedRows: job.processedRows + batch.length,
          skipped: [...job.skipped, ...remainingSkipped],
          errors: [
            ...job.errors,
            {
              batch: i + 1,
              category: "RATE_LIMIT",
              message: err.message,
              retryAfterSeconds: err.retryAfterSeconds,
            },
          ],
        });

        const finalJob = getJob(jobId);
        sendDone(jobId, finalJob);
        return;
      }

      const classified = classifyAiError(err);
      const skippedBatch: SkippedRecord[] = batch.map((row, idx) => ({
        sourceRowIndex: batchStartIndex + idx,
        reason: classified.message,
        rawRow: row,
        category: classified.category,
      }));

      updateJob(jobId, {
        completedBatches: job.completedBatches + 1,
        processedRows: job.processedRows + batch.length,
        skipped: [...job.skipped, ...skippedBatch],
        errors: [...job.errors, { batch: i + 1, category: classified.category, message: classified.message }],
      });
    }

    const afterBatch = getJob(jobId);
    if (afterBatch?.status === "cancelled" || afterBatch?.status === "rate_limited") {
      sendDone(jobId, afterBatch);
      return;
    }

    sendProgress(jobId, {
      batch: i + 1,
      totalBatches: batches.length,
      processedRows: afterBatch?.processedRows,
      totalRows: afterBatch?.totalRows,
      importedCount: afterBatch?.imported.length,
      skippedCount: afterBatch?.skipped.length,
      errorCount: afterBatch?.errors.length ?? 0,
    });
  }

  updateJob(jobId, { status: "completed" });
  sendDone(jobId, getJob(jobId));
}