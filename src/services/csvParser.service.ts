import { parse } from "csv-parse/sync";

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

export function parseCsvBuffer(buffer: Buffer): ParsedCsv {
  const records: Record<string, string>[] = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  const headers = records.length > 0 ? Object.keys(records[0] as object) : [];

  return {
    headers,
    rows: records,
    totalRows: records.length,
  };
}