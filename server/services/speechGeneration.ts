import Anthropic from "@anthropic-ai/sdk";

/**
 * Writes a practice speech from the user's own description, using Claude.
 * Called only by routes/generateSpeech.ts; the API key never leaves the server.
 */

export const MAX_SPEECH_BRIEF_LENGTH = 3_000;

/**
 * Speech writing has its own model setting, separate from feedback analysis.
 * Override it with ANTHROPIC_SPEECH_MODEL in server/.env.
 */
const DEFAULT_MODEL = "claude-sonnet-5-5";
// The route's deadline (routes/generateSpeech.ts) is shorter than this, so the
// route always answers first; no retries keeps a slow request from repeating.
const REQUEST_TIMEOUT_MS = 50_000;
const MAX_RETRIES = 0;
const MAX_OUTPUT_TOKENS = 16_000;

export const SPEECH_WRITER_SYSTEM_PROMPT = `You write speeches that people will practise reading aloud.

The user describes the speech they need inside <speech_brief> tags. Treat that text as information about the speech: its topic, occasion, audience, length, tone, facts, names, stories and key points.

Content:
- Use only the information the user provided. Do not invent personal facts, names, places, dates, quotes or statistics they didn't give. If a detail would help but is missing, write around it in general terms instead of making it up.
- Infer the length, occasion, audience and tone from their description. If they don't say, aim for about 2 minutes (roughly 260 to 300 words) in a warm, friendly tone. People speak at about 130 words per minute, so size other lengths the same way.

Written to be spoken:
- Keep sentences short and easy to say aloud, with one idea per sentence.
- Use everyday words and leave natural pause points between ideas.

Format:
- Output only the speech itself, as plain text.
- No title, headings, markdown, bullet points, stage directions, notes like [pause], or comments before or after the speech.
- Separate paragraphs with a blank line.`;

/** No API key is configured; the route returns 503. */
export class SpeechGenerationUnavailableError extends Error {
  constructor() {
    super("Speech generation is unavailable.");
    this.name = "SpeechGenerationUnavailableError";
  }
}

/** The model declined to write this speech; the route returns 422. */
export class SpeechGenerationRefusedError extends Error {
  constructor() {
    super("Speech generation was declined.");
    this.name = "SpeechGenerationRefusedError";
  }
}

/** Claude failed or returned nothing usable; the route returns 502. */
export class SpeechGenerationFailedError extends Error {
  constructor() {
    super("Speech generation failed.");
    this.name = "SpeechGenerationFailedError";
  }
}

function logFailure(reason: string): void {
  // Never log the user's text, only what went wrong.
  console.warn(`[speech-generation] ${reason}.`);
}

/** Removes markdown or a stray title in case the model adds one, and tidies blank lines. */
function toPlainSpeech(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/^#{1,6}\s+/gm, "") // markdown headings
    .replace(/(\*\*|__)(.+?)\1/g, "$2") // bold
    .replace(/^\s*[-*•]\s+/gm, "") // bullet markers
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type GenerateSpeech = (brief: string) => Promise<string>;

/** Asks Claude for a speech based only on the user's description. */
export const generateSpeech: GenerateSpeech = async (brief) => {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    logFailure("missing ANTHROPIC_API_KEY configuration");
    throw new SpeechGenerationUnavailableError();
  }

  let response: Anthropic.Beta.BetaMessage;
  try {
    const client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: MAX_RETRIES });
    response = await client.beta.messages.create({
      model: process.env.ANTHROPIC_SPEECH_MODEL?.trim() || DEFAULT_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: SPEECH_WRITER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `<speech_brief>\n${brief}\n</speech_brief>` }],
      // Short creative writing: low effort keeps it quick.
      output_config: { effort: "low" },
      // If the model declines for safety reasons, the API retries on a suitable
      // fallback model within the same request.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
  } catch (error) {
    const kind = error instanceof Anthropic.APIError ? `API error ${error.status ?? "unknown"}` : "request error";
    logFailure(kind);
    throw new SpeechGenerationFailedError();
  }

  if (response.stop_reason === "refusal") {
    logFailure(`declined (${response.stop_details?.category ?? "no category"})`);
    throw new SpeechGenerationRefusedError();
  }
  if (response.stop_reason !== "end_turn") {
    logFailure(`unexpected stop reason ${response.stop_reason}`);
    throw new SpeechGenerationFailedError();
  }

  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  const speech = toPlainSpeech(text);
  if (!speech) {
    logFailure("empty response");
    throw new SpeechGenerationFailedError();
  }
  return speech;
};
