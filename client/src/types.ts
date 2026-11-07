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
  sentenceCount: number;
}

/** AI feedback returned by the backend. */
export interface Feedback {
  overallAssessment: string;
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
}

/** Successful response from POST /api/analyze. */
export interface AnalysisResponse {
  transcript: string;
  statistics: SpeechStatistics;
  feedback: Feedback;
}

// ---------------------------------------------------------------------------
// Frontend-only types below. These are NOT part of the API contract and are
// never sent to the backend as-is.
// ---------------------------------------------------------------------------

/**
 * The user's written speech from Step 1. Used only as a reference while
 * practising; it is NOT sent to the backend or part of `Presentation`.
 * TODO: the team may add a "script" field to the API contract later.
 */
export interface SpeechDraft {
  title: string;
  text: string;
  /** The last uploaded file (for the file card), or null. */
  file: { name: string; sizeBytes: number } | null;
  /**
   * Where the speech came from: an uploaded document, a generated speech, or
   * null (typed/pasted, or nothing yet). Upload and Generate can't both be active.
   */
  source: "upload" | "generated" | null;
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
