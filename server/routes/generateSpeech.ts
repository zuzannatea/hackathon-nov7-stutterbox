import { Router, type Request, type Response } from "express";
import {
  generateSpeech as defaultGenerateSpeech,
  MAX_SPEECH_BRIEF_LENGTH,
  SpeechGenerationRefusedError,
  SpeechGenerationUnavailableError,
  type GenerateSpeech,
} from "../services/speechGeneration.js";

/**
 * POST /api/generate-speech
 * Request:  { "brief": string }   (what the speech should be based on; 1–3,000 characters)
 * Response: { "speech": string }  (plain text, paragraphs separated by blank lines)
 * Errors:   { "error": string } with 400, 422, 502, 503 or 504.
 */

export const GENERATION_TIMEOUT_MS = 45_000;

class GenerationTimeoutError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

export function createGenerateSpeechRouter(
  generateSpeech: GenerateSpeech = defaultGenerateSpeech,
  timeoutMs = GENERATION_TIMEOUT_MS,
): Router {
  const router = Router();

  router.post("/", async (req: Request, res: Response) => {
    const body: unknown = req.body;
    if (!isRecord(body) || typeof body.brief !== "string") {
      sendError(res, 400, "Please describe the speech you'd like.");
      return;
    }
    const brief = body.brief.trim();
    if (!brief) {
      sendError(res, 400, "Please describe the speech you'd like.");
      return;
    }
    if (brief.length > MAX_SPEECH_BRIEF_LENGTH) {
      sendError(res, 400, `Please keep your description to ${MAX_SPEECH_BRIEF_LENGTH.toLocaleString("en-GB")} characters or fewer.`);
      return;
    }

    try {
      const speech = await withTimeout(generateSpeech(brief), timeoutMs);
      res.json({ speech });
    } catch (error) {
      if (error instanceof GenerationTimeoutError) {
        sendError(res, 504, "Writing your speech took too long. Please try again.");
      } else if (error instanceof SpeechGenerationUnavailableError) {
        sendError(res, 503, "Speech writing isn't available right now. Please try again later.");
      } else if (error instanceof SpeechGenerationRefusedError) {
        sendError(res, 422, "We couldn't write a speech from that description. Try describing it differently.");
      } else {
        sendError(res, 502, "Something went wrong while writing your speech. Please try again.");
      }
    }
  });

  return router;
}
