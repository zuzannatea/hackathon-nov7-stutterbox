import type { AnalysisResponse, AnalyzeRequestBody } from "../types";

export type AnalysisApiErrorKind = "http" | "network" | "response" | "request";

export interface AnalysisApiErrorInfo {
  kind: AnalysisApiErrorKind;
  message: string;
  status?: number;
}

export class AnalysisApiError extends Error implements AnalysisApiErrorInfo {
  readonly kind: AnalysisApiErrorKind;
  readonly status?: number;

  constructor(kind: AnalysisApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "AnalysisApiError";
    this.kind = kind;
    this.status = status;
  }
}

type AnalysisSubmission = Pick<AnalyzeRequestBody, "presentation" | "transcript" | "durationSeconds" | "intendedSpeech">;
const MAX_INTENDED_SPEECH_LENGTH = 20_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fallbackHttpMessage(status: number): string {
  switch (status) {
    case 400:
      return "The request was rejected. Check your presentation details and try again.";
    case 413:
      return "The transcript or request is too large to analyze.";
    case 502:
      return "Speech analysis failed. Please try again.";
    case 503:
      return "AI analysis is temporarily unavailable. Please try again later.";
    case 504:
      return "Analysis took too long. Please try again.";
    default:
      return `The server couldn't complete the analysis (HTTP ${status}). Please try again.`;
  }
}

/** Sends only the backend request fields; frontend-only attempt metadata is excluded. */
export async function submitAnalysis(request: AnalysisSubmission): Promise<AnalysisResponse> {
  if (request.intendedSpeech && request.intendedSpeech.length > MAX_INTENDED_SPEECH_LENGTH) {
    throw new AnalysisApiError(
      "request",
      `Your prepared speech must be ${MAX_INTENDED_SPEECH_LENGTH} characters or fewer to include it in the analysis.`,
    );
  }

  let response: Response;
  try {
    response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        presentation: request.presentation,
        transcript: request.transcript,
        durationSeconds: request.durationSeconds,
        ...(request.intendedSpeech?.trim() ? { intendedSpeech: request.intendedSpeech } : {}),
      }),
    });
  } catch {
    throw new AnalysisApiError(
      "network",
      "Couldn't reach the analysis server. Check your connection and try again.",
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (response.ok) {
      throw new AnalysisApiError(
        "response",
        "The server returned an unreadable response. Please try again.",
        response.status,
      );
    }
    body = null;
  }

  if (!response.ok) {
    const message = isRecord(body) && typeof body.error === "string"
      ? body.error
      : fallbackHttpMessage(response.status);
    throw new AnalysisApiError("http", message, response.status);
  }

  if (
    !isRecord(body) ||
    typeof body.transcript !== "string" ||
    typeof body.formattedTranscript !== "string" ||
    !isRecord(body.statistics) ||
    !isRecord(body.feedback)
  ) {
    throw new AnalysisApiError(
      "response",
      "The server returned an unexpected analysis response. Please try again.",
      response.status,
    );
  }

  return body as unknown as AnalysisResponse;
}
