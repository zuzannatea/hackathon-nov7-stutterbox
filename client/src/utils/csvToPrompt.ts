// CSV support for "Generate a speech". The file is read in the browser with
// FileReader (no library, nothing uploaded) and kept as an attachment. When the
// user presses Generate, buildBrief() combines their typed prompt with the rows
// as readable text, within the prompt's character limit.

const MAX_CSV_BYTES = 1024 * 1024; // 1 MB is plenty for a prompt-sized table
export const DATA_INTRO = "Use this data to write the speech:";

/** A CSV file kept in React state: one readable line per data row. */
export interface CsvAttachment {
  fileName: string;
  rowCount: number;
  /** "Row 1 — Name: Ana, Role: Lead, …" */
  lines: string[];
}

/** Splits CSV text into rows of cells. Handles quoted values ("a, b"), "" escapes and line breaks in quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"'; // escaped quote
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++; // Windows line ending
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);

  // Skip empty rows (including a trailing newline at the end of the file).
  return rows.filter((r) => r.some((value) => value.trim() !== ""));
}

export type CsvAttachmentResult = { ok: true; attachment: CsvAttachment } | { ok: false; message: string };

/** First row = headers; every other row becomes "Row N — Header: value, …" (empty cells left out). */
export function csvTextToAttachment(fileName: string, csvText: string): CsvAttachmentResult {
  const rows = parseCsv(csvText.replace(/^﻿/, "")); // drop a byte-order mark if present
  if (rows.length === 0) {
    return { ok: false, message: "This CSV file is empty. Please choose another file." };
  }
  const headers = rows[0].map((header, index) => header.trim() || `Column ${index + 1}`);
  const dataRows = rows.slice(1);
  if (dataRows.length === 0) {
    return { ok: false, message: "This CSV file has a header row but no data rows." };
  }

  const lines = dataRows.map((row, index) => {
    const parts = headers
      .map((header, column) => {
        const value = (row[column] ?? "").trim().replace(/\s+/g, " ");
        return value ? `${header}: ${value}` : null;
      })
      .filter((part): part is string => part !== null);
    return `Row ${index + 1} — ${parts.join(", ")}`;
  });

  return { ok: true, attachment: { fileName, rowCount: dataRows.length, lines } };
}

/** Checks the file and reads it with FileReader. */
export function readCsvAttachment(file: File): Promise<CsvAttachmentResult> {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return Promise.resolve({ ok: false, message: "Please choose a .csv file." });
  }
  if (file.size === 0) {
    return Promise.resolve({ ok: false, message: "This CSV file is empty. Please choose another file." });
  }
  if (file.size > MAX_CSV_BYTES) {
    return Promise.resolve({ ok: false, message: "This CSV file is larger than 1 MB. Please choose a smaller file." });
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(
        typeof reader.result === "string"
          ? csvTextToAttachment(file.name, reader.result)
          : { ok: false, message: "We couldn't read this CSV file. Please try another." },
      );
    reader.onerror = () => resolve({ ok: false, message: "We couldn't read this CSV file. Please try another." });
    reader.readAsText(file);
  });
}

export type BuildBriefResult =
  | { ok: true; brief: string; rowsIncluded: number; rowCount: number }
  | { ok: false; message: string };

/**
 * The text sent as { brief }: the typed prompt (if any), then
 * "Use this data to write the speech:" and as many rows as fit in maxLength.
 */
export function buildBrief(prompt: string, csv: CsvAttachment | null, maxLength: number): BuildBriefResult {
  const typed = prompt.trim();
  if (!csv) {
    return typed
      ? { ok: true, brief: typed.slice(0, maxLength), rowsIncluded: 0, rowCount: 0 }
      : { ok: false, message: "Describe the speech or attach a .csv file first." };
  }

  const noteFor = (included: number) => `(Showing the first ${included} of ${csv.rowCount} rows.)`;
  let brief = typed ? `${typed}\n\n${DATA_INTRO}` : DATA_INTRO;
  let included = 0;
  for (const line of csv.lines) {
    const next = `${brief}\n${line}`;
    // Leave room for the "(Showing the first …)" note if more rows remain after this one.
    const roomForNote = included + 1 < csv.lines.length ? noteFor(included + 1).length + 1 : 0;
    if (next.length + roomForNote > maxLength) break;
    brief = next;
    included++;
  }
  if (included === 0) {
    return { ok: false, message: "Your prompt is too long to add the data. Shorten it a little, or remove the CSV." };
  }
  if (included < csv.rowCount) brief += `\n${noteFor(included)}`;
  return { ok: true, brief, rowsIncluded: included, rowCount: csv.rowCount };
}
