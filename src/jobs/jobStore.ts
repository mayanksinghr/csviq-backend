import { randomUUID } from "crypto";
import { CrmRecord } from "../validators/crmRecord.schema";

export type JobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "rate_limited";

export interface SkippedRecord {
  sourceRowIndex: number;
  reason: string;
  rawRow: Record<string, string>;
  category?: AiErrorCategory;
}

export interface ImportedRecord {
  sourceRowIndex: number;
  record: CrmRecord;
  columnMapping: Record<string, string>;
}

export type AiErrorCategory =
  | "RATE_LIMIT"
  | "INVALID_RESPONSE"
  | "EMPTY_RESPONSE"
  | "INVALID_JSON"
  | "UNKNOWN";

export interface JobErrorInfo {
  batch: number;
  category: AiErrorCategory;
  message: string;
  retryAfterSeconds?: number | null;
}

export interface Job {
  id: string;
  status: JobStatus;
  totalRows: number;
  processedRows: number;
  totalBatches: number;
  completedBatches: number;
  imported: ImportedRecord[];
  skipped: SkippedRecord[];
  errors: JobErrorInfo[];
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, Job>();

export function createJob(totalRows: number, totalBatches: number): Job {
  const job: Job = {
    id: randomUUID(),
    status: "pending",
    totalRows,
    processedRows: 0,
    totalBatches,
    completedBatches: 0,
    imported: [],
    skipped: [],
    errors: [],
    createdAt: Date.now(),
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}

export function updateJob(jobId: string, patch: Partial<Job>): void {
  const job = jobs.get(jobId);
  if (!job) return;
  Object.assign(job, patch);
}