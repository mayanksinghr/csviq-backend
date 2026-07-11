import { Response } from "express";

const connections = new Map<string, Response>();

export function registerConnection(jobId: string, res: Response) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ jobId })}\n\n`);
  connections.set(jobId, res);
}

export function sendProgress(jobId: string, data: unknown) {
  const res = connections.get(jobId);
  if (!res) return;
  res.write(`event: progress\ndata: ${JSON.stringify(data)}\n\n`);
}

export function sendDone(jobId: string, data: unknown) {
  const res = connections.get(jobId);
  if (!res) return;
  res.write(`event: done\ndata: ${JSON.stringify(data)}\n\n`);
  closeConnection(jobId);
}

export function closeConnection(jobId: string) {
  const res = connections.get(jobId);
  if (res) {
    res.end();
    connections.delete(jobId);
  }
}