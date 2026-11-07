import { Router, type Request, type Response } from "express";
import {
  calculateSpeechStatistics,
  type SpeechStatistics,
} from "../services/statistics.js";
import {
  AnalysisProviderError,
  AnalysisUnavailableError,
} from "../services/analysisErrors.js";

export interface Presentation {
  title: string;
  audience: string;
  purpose: string;
  keyPoints: string[];
  desiredDurationMinutes: number;
  tone: string;
}

export interface AnalysisRequest {
  presentation: Presentation;
  transcript: string;
  statistics: SpeechStatistics;
  inspiration?: string;
  intendedSpeech?: string;
}

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

/** Internal AI result; the route returns formattedTranscript beside Feedback. */
export interface AnalysisResult extends Feedback {
  formattedTranscript: string;
}

export interface AnalysisResponse {
  transcript: string;
  formattedTranscript: string;
  statistics: SpeechStatistics;
  feedback: Feedback;
}

export type AnalyseSpeech = (input: AnalysisRequest) => Promise<AnalysisResult>;

export const ANALYSIS_TIMEOUT_MS = 30_000;

const MAX_TRANSCRIPT_LENGTH = 20_000;
const MAX_INSPIRATION_LENGTH = 5_000;
const MAX_INTENDED_SPEECH_LENGTH = 20_000;
const MAX_KEY_POINTS = 20;
const MAX_TEXT_FIELD_LENGTH = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, maxLength = MAX_TEXT_FIELD_LENGTH): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function validatePresentation(value: unknown): value is Presentation {
  if (!isRecord(value)) return false;

  return (
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.audience) &&
    isNonEmptyString(value.purpose) &&
    isNonEmptyString(value.tone) &&
    Array.isArray(value.keyPoints) &&
    value.keyPoints.length > 0 &&
    value.keyPoints.length <= MAX_KEY_POINTS &&
    value.keyPoints.every((point) => isNonEmptyString(point)) &&
    typeof value.desiredDurationMinutes === "number" &&
    Number.isFinite(value.desiredDurationMinutes) &&
    value.desiredDurationMinutes > 0
  );
}

function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

class AnalysisTimeoutError extends Error {}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new AnalysisTimeoutError()), timeoutMs);
  });

  return Promise.race([operation, timeoutPromise]).finally(() => clearTimeout(timeout));
}

export function createAnalyzeRouter(
  analyseSpeech?: AnalyseSpeech,
  analysisTimeoutMs = ANALYSIS_TIMEOUT_MS,
): Router {
  if (!Number.isFinite(analysisTimeoutMs) || analysisTimeoutMs <= 0) {
    throw new RangeError("analysisTimeoutMs must be a positive finite number.");
  }

  const router = Router();

  router.post("/", async (req: Request, res: Response) => {
    const body: unknown = req.body;

    if (!isRecord(body)) {
      sendError(res, 400, "Request body must be a JSON object.");
      return;
    }
    if (typeof body.transcript !== "string") {
      sendError(res, 400, "A transcript is required.");
      return;
    }
    if (!body.transcript.trim()) {
      sendError(res, 400, "Transcript cannot be empty.");
      return;
    }
    if (body.transcript.length > MAX_TRANSCRIPT_LENGTH) {
      sendError(res, 413, `Transcript must be ${MAX_TRANSCRIPT_LENGTH} characters or fewer.`);
      return;
    }
    if (!validatePresentation(body.presentation)) {
      sendError(res, 400, "Presentation details are missing or invalid.");
      return;
    }
    if (typeof body.durationSeconds !== "number" || !Number.isFinite(body.durationSeconds) || body.durationSeconds <= 0) {
      sendError(res, 400, "durationSeconds must be a positive finite number.");
      return;
    }
    if (body.inspiration !== undefined && (typeof body.inspiration !== "string" || body.inspiration.length > MAX_INSPIRATION_LENGTH)) {
      sendError(res, 400, `inspiration must be text of ${MAX_INSPIRATION_LENGTH} characters or fewer.`);
      return;
    }
    if (
      body.intendedSpeech !== undefined &&
      (typeof body.intendedSpeech !== "string" || body.intendedSpeech.length > MAX_INTENDED_SPEECH_LENGTH)
    ) {
      sendError(res, 400, `intendedSpeech must be text of ${MAX_INTENDED_SPEECH_LENGTH} characters or fewer.`);
      return;
    }

    const statistics = calculateSpeechStatistics(body.transcript, body.durationSeconds);
    if (!analyseSpeech) {
      sendError(res, 503, "AI analysis is not available yet. Please try again later.");
      return;
    }

    try {
      const analysis = await withTimeout(
        analyseSpeech({
          presentation: body.presentation,
          transcript: body.transcript,
          statistics,
          ...(typeof body.inspiration === "string" ? { inspiration: body.inspiration } : {}),
          ...(typeof body.intendedSpeech === "string" ? { intendedSpeech: body.intendedSpeech } : {}),
        }),
        analysisTimeoutMs,
      );
      const { formattedTranscript, ...feedback } = analysis;
      res.json({ transcript: body.transcript, formattedTranscript, statistics, feedback });
    } catch (error) {
      if (error instanceof AnalysisTimeoutError) {
        sendError(res, 504, "Speech analysis timed out. Please try again.");
        return;
      }
      if (error instanceof AnalysisUnavailableError) {
        sendError(res, 503, "AI analysis is not available yet. Please try again later.");
        return;
      }
      if (error instanceof AnalysisProviderError) {
        sendError(res, 502, "Speech analysis failed. Please try again.");
        return;
      }
      sendError(res, 502, "Speech analysis failed. Please try again.");
    }
  });

  return router;
}
