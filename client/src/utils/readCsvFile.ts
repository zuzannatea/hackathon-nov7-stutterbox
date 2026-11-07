// Reads a CSV data file in the browser and prepares what we send to the server:
// the headers, a sample of rows and per-column summaries (not the whole file).

import type { CsvCell, CsvColumnSummary, CsvData } from "../types";

export const MAX_CSV_BYTES = 1024 * 1024; // about 1 MB
export const CSV_ACCEPT_ATTRIBUTE = ".csv,text/csv";
const SAMPLE_ROWS = 200; // rows sent to the server (same limit as the server)
const PREVIEW_ROWS = 5;
const MAX_COLUMNS = 100; // same limit as the server
const MAX_CELL_LENGTH = 500; // same limit as the server
const TOP_VALUES = 5;

export type ReadCsvResult = { ok: true; data: CsvData } | { ok: false; message: string };

/** Keeps cells within the server's limits (long text is shortened). */
function cleanCell(value: unknown): CsvCell {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (typeof value === "boolean") return value;
  const text = String(value);
  return text.length > MAX_CELL_LENGTH ? text.slice(0, MAX_CELL_LENGTH - 1) + "…" : text;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** count/min/max/mean for number columns, most common values for text columns. */
function summarise(column: string, values: CsvCell[]): CsvColumnSummary {
  const present = values.filter((v) => v !== null && v !== "");
  if (present.length === 0) return { column, type: "empty", count: 0 };

  if (present.every((v) => typeof v === "number")) {
    const numbers = present as number[];
    const sum = numbers.reduce((total, n) => total + n, 0);
    return {
      column,
      type: "number",
      count: numbers.length,
      min: round(Math.min(...numbers)),
      max: round(Math.max(...numbers)),
      mean: round(sum / numbers.length),
    };
  }

  const counts = new Map<string, number>();
  for (const v of present) {
    const key = String(v).slice(0, 200);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const topValues = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_VALUES)
    .map(([value, count]) => ({ value, count }));
  return { column, type: "text", count: present.length, topValues };
}

/** Checks, parses and summarises a CSV file. */
export async function readCsvFile(file: File): Promise<ReadCsvResult> {
  const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
  if (!isCsv) {
    return { ok: false, message: "Please upload a .csv file. To use a speech document, upload it as your speech instead." };
  }
  if (file.size > MAX_CSV_BYTES) {
    return { ok: false, message: "This CSV file is larger than 1 MB. Please upload a smaller file." };
  }
  if (file.size === 0) {
    return { ok: false, message: "This CSV file is empty. Please choose another file." };
  }

  let parsed: { data: Record<string, unknown>[]; fields: string[] };
  try {
    // Loaded only when someone uploads a CSV, so the rest of the app stays small.
    const Papa = (await import("papaparse")).default;
    parsed = await new Promise((resolve, reject) => {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => resolve({ data: results.data, fields: results.meta.fields ?? [] }),
        error: (error) => reject(error),
      });
    });
  } catch {
    return { ok: false, message: "We couldn't read this CSV file. Please check it and try again." };
  }

  const columns = parsed.fields.map((field) => field.trim()).filter((field) => field !== "");
  if (columns.length === 0) {
    return { ok: false, message: "This CSV file needs a header row with column names." };
  }
  if (parsed.data.length === 0) {
    return { ok: false, message: "This CSV file has a header row but no data rows." };
  }
  if (columns.length > MAX_COLUMNS) {
    return { ok: false, message: `This CSV file has ${columns.length} columns. Please use one with ${MAX_COLUMNS} or fewer.` };
  }

  // Rows as arrays in column order (header names were trimmed above).
  const originalFields = parsed.fields.filter((field) => field.trim() !== "");
  const rows: CsvCell[][] = parsed.data.map((record) => originalFields.map((field) => cleanCell(record[field])));
  const summaries = columns.map((column, index) => summarise(column, rows.map((row) => row[index])));

  return {
    ok: true,
    data: {
      fileName: file.name,
      sizeBytes: file.size,
      rowCount: rows.length,
      columnCount: columns.length,
      previewRows: rows.slice(0, PREVIEW_ROWS),
      request: {
        fileName: file.name,
        rowCount: rows.length,
        columns: columns.map((column) => column.slice(0, MAX_CELL_LENGTH)),
        rows: rows.slice(0, SAMPLE_ROWS),
        summaries,
      },
    },
  };
}
