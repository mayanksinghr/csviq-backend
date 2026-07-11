import { Request, Response } from "express";
import { parseCsvBuffer } from "../services/csvParser.service";
import { createJob, getJob, updateJob } from "../jobs/jobStore";
import { processImportJob } from "../jobs/importProcessor";
import { registerConnection, sendDone } from "../sse/sseManager";
import { chunkRows } from "../utils/batchChunker";

const BATCH_SIZE = 25;

export function previewCsv(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded. Field name must be 'file'." });
  }
  try {
    const parsed = parseCsvBuffer(req.file.buffer);
    if (parsed.totalRows === 0) {
      return res.status(400).json({ error: "CSV file is empty or has no valid rows." });
    }
    return res.json({
      filename: req.file.originalname,
      headers: parsed.headers,
      previewRows: parsed.rows.slice(0, 5),
      totalRows: parsed.totalRows,
    });
  } catch {
    return res.status(400).json({ error: "Failed to parse CSV. Please check the file format." });
  }
}

export function startImport(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded. Field name must be 'file'." });
  }
  let parsed;
  try {
    parsed = parseCsvBuffer(req.file.buffer);
  } catch {
    return res.status(400).json({ error: "Failed to parse CSV. Please check the file format." });
  }
  if (parsed.totalRows === 0) {
    return res.status(400).json({ error: "CSV file is empty or has no valid rows." });
  }

  const totalBatches = chunkRows(parsed.rows, BATCH_SIZE).length;
  const job = createJob(parsed.totalRows, totalBatches);

  processImportJob(job.id, parsed.rows).catch((err) => {
    console.error(`Job ${job.id} crashed:`, err);
  });

  return res.status(202).json({ jobId: job.id });
}

export function streamImportProgress(req: Request, res: Response) {
  const jobId = req.params.jobId as string;
  const job = getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  registerConnection(jobId, res);

  if (
    job.status === "completed" ||
    job.status === "failed" ||
    job.status === "cancelled" ||
    job.status === "rate_limited"
  ) {
    sendDone(jobId, job);
    return;
  }

  req.on("close", () => {
    // client disconnected — sseManager cleans up via closeConnection() on done
  });
}

// Cancel an in-flight import job
export function cancelImport(req: Request, res: Response) {
  const jobId = req.params.jobId as string;
  const job = getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  if (
    job.status === "completed" ||
    job.status === "failed" ||
    job.status === "cancelled" ||
    job.status === "rate_limited"
  ) {
    return res.status(400).json({ error: `Job already ${job.status}, cannot cancel.` });
  }

  updateJob(jobId, { status: "cancelled" });
  return res.status(200).json({ status: "cancelled" });
}