import { Router, type Request, type Response } from "express";
import {
  generateSpeechFromCsv as defaultGenerate,
  SpeechGenerationRefusedError,
  SpeechGenerationUnavailableError,
  type CsvCell,
  type CsvColumnSummary,
  type CsvSpeechInput,
  type GenerateSpeechFromCsv,
} from "../services/csvSpeech.js";

/**
 * POST /api/generate-speech-from-csv
 * Request:  { fileName, rowCount, columns: string[], rows: (string|number|boolean|null)[][],
 *             summaries: [{ column, type, count, min?, max?, mean?, topValues? }] }
 *           (rows: at most 200; the browser sends a sample plus summaries, not the whole file)
 * Response: { "speech": string }  (plain text, paragraphs separated by blank lines)
 * Errors:   { "error": string } with 400, 422, 502, 503 or 504.
 */

export const CSV_GENERATION_TIMEOUT_MS = 45_000;
export const MAX_CSV_ROWS = 200;
export const MAX_CSV_COLUMNS = 100;
const MAX_TEXT = 500; // longest cell / header / value we accept
const MAX_TOP_VALUES = 10;
const SUMMARY_TYPES = new Set(["number", "text", "empty"]);

class GenerationTimeoutError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isShortString(value: unknown, max = MAX_TEXT): value is string {
  return typeof value === "string" && value.length <= max;
}

function isCell(value: unknown): value is CsvCell {
  return (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    isShortString(value)
  );
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

function isSummary(value: unknown): value is CsvColumnSummary {
  if (!isRecord(value)) return false;
  if (!isShortString(value.column) || !SUMMARY_TYPES.has(String(value.type))) return false;
  if (!Number.isInteger(value.count) || (value.count as number) < 0) return false;
  if (!isOptionalNumber(value.min) || !isOptionalNumber(value.max) || !isOptionalNumber(value.mean)) return false;
  if (value.topValues === undefined) return true;
  return (
    Array.isArray(value.topValues) &&
    value.topValues.length <= MAX_TOP_VALUES &&
    value.topValues.every(
      (top) => isRecord(top) && isShortString(top.value) && Number.isInteger(top.count) && (top.count as number) >= 0,
    )
  );
}

/** Checks the request body; returns the data or an error message. */
function validate(body: unknown): { ok: true; input: CsvSpeechInput } | { ok: false; message: string } {
  const invalid = { ok: false as const, message: "The data couldn't be read. Please upload the CSV file again." };
  if (!isRecord(body)) return invalid;
  const { fileName, rowCount, columns, rows, summaries } = body;

  if (!isShortString(fileName, 255) || fileName.trim() === "") return invalid;
  if (!Number.isInteger(rowCount) || (rowCount as number) < 1) return invalid;
  if (!Array.isArray(columns) || columns.length < 1 || columns.length > MAX_CSV_COLUMNS) return invalid;
  if (!columns.every((column) => isShortString(column))) return invalid;
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > MAX_CSV_ROWS || rows.length > (rowCount as number)) {
    return invalid;
  }
  if (!rows.every((row) => Array.isArray(row) && row.length <= columns.length && row.every(isCell))) return invalid;
  if (!Array.isArray(summaries) || summaries.length > MAX_CSV_COLUMNS || !summaries.every(isSummary)) return invalid;

  return {
    ok: true,
    input: {
      fileName: fileName.trim(),
      rowCount: rowCount as number,
      columns: columns as string[],
      rows: rows as CsvCell[][],
      summaries: summaries as CsvColumnSummary[],
    },
  };
}

function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new GenerationTimeoutError()), timeoutMs);
  });
  return Promise.race([operation, timeoutPromise]).finally(() => clearTimeout(timeout));
}

export function createGenerateSpeechFromCsvRouter(
  generate: GenerateSpeechFromCsv = defaultGenerate,
  timeoutMs = CSV_GENERATION_TIMEOUT_MS,
): Router {
  const router = Router();

  router.post("/", async (req: Request, res: Response) => {
    const result = validate(req.body);
    if (!result.ok) {
      sendError(res, 400, result.message);
      return;
    }

    try {
      const speech = await withTimeout(generate(result.input), timeoutMs);
      res.json({ speech });
    } catch (error) {
      if (error instanceof GenerationTimeoutError) {
        sendError(res, 504, "Turning your data into a speech took too long. Please try again.");
      } else if (error instanceof SpeechGenerationUnavailableError) {
        sendError(res, 503, "Speech writing isn't available right now. Please try again later.");
      } else if (error instanceof SpeechGenerationRefusedError) {
        sendError(res, 422, "We couldn't write a speech from this data. Try a different file.");
      } else {
        sendError(res, 502, "Something went wrong while writing your speech. Please try again.");
      }
    }
  });

  return router;
}
