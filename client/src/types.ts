// Shared data shapes for the Stutterbox frontend.
//
// These MUST match the backend contract in server/routes/analyze.ts and
// server/services/statistics.ts (see PROJECT.md section 8). The client and
// server are separate projects, so this file is a copy, not a competing
// definition. If the team changes the contract, update both places together.

/** What the user tells us about their presentation (filled in by the form). */
export interface Presentation {
  title: string;
  audience: string;
  purpose: string;
  keyPoints: string[];
  desiredDurationMinutes: number;
  tone: string;
}

/** Numbers the backend calculates from the transcript. */
export interface SpeechStatistics {
  durationSeconds: number;
  wordCount: number;
  wordsPerMinute: number;
  fillerWords: Record<string, number>;
}

/** AI feedback returned by the backend. */
export interface Feedback {
  overallAssessment: string;
  planningAssessment: string;
  executionAssessment: string;
  strengths: Array<{ title: string; explanation: string; evidence?: string }>;
  improvements: Array<{
    title: string;
    explanation: string;
    evidence?: string;
    recommendation: string;
  }>;
  keyPointCoverage: Array<{
    keyPoint: string;
    status: "covered" | "partial" | "missing";
    explanation: string;
  }>;
  nextSteps: string[];
  suggestedRewrite?: string;
}

/** Body the frontend sends to POST /api/analyze. */
export interface AnalyzeRequestBody {
  transcript: string;
  presentation: Presentation;
  durationSeconds: number;
  inspiration?: string;
  intendedSpeech?: string;
}

/** Successful response from POST /api/analyze. */
export interface AnalysisResponse {
  transcript: string;
  formattedTranscript: string;
  statistics: SpeechStatistics;
  feedback: Feedback;
}

// ---------------------------------------------------------------------------
// Frontend-only types below. These are NOT part of the API contract and are
// never sent to the backend as-is.
// ---------------------------------------------------------------------------

/**
 * The user's written speech from Step 1. Used as a practice reference and
 * sent separately as optional `intendedSpeech`; it is not part of `Presentation`.
 */
export interface SpeechDraft {
  title: string;
  text: string;
  /** The last uploaded file (for the file card), or null. */
  file: { name: string; sizeBytes: number } | null;
  /**
   * Where the speech came from: an uploaded speech document, an uploaded CSV
   * data file (speech generated from it), or null (typed/pasted, or nothing yet).
   * Only one of the two uploads can be active at a time.
   */
  source: "document" | "csv" | null;
}

/** One CSV cell after parsing (numbers and true/false are converted). */
export type CsvCell = string | number | boolean | null;

/** Summary of one CSV column, calculated over every row of the file. */
export interface CsvColumnSummary {
  column: string;
  type: "number" | "text" | "empty";
  count: number;
  min?: number;
  max?: number;
  mean?: number;
  topValues?: Array<{ value: string; count: number }>;
}

/** Body of POST /api/generate-speech-from-csv (a sample + summaries, not the whole file). */
export interface CsvSpeechRequest {
  fileName: string;
  rowCount: number;
  columns: string[];
  rows: CsvCell[][];
  summaries: CsvColumnSummary[];
}

/** An uploaded CSV file: what the preview shows and what we send to the server. */
export interface CsvData {
  fileName: string;
  sizeBytes: number;
  rowCount: number;
  columnCount: number;
  previewRows: CsvCell[][];
  request: CsvSpeechRequest;
}

/** One finished practice attempt from Step 3. */
export interface PractiseAttempt {
  /** Final transcript (finished speech-recognition results only, or typed text). */
  transcript: string;
  /** How long the attempt took, in seconds (always greater than 0). */
  durationSeconds: number;
  /** Whether the words were spoken live or typed/pasted by the user. */
  source: "speech" | "typed";
}
