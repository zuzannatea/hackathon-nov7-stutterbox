// Asks our backend to write a speech from the user's description.
// The backend calls Claude; the API key never reaches the browser.

export const MAX_SPEECH_BRIEF_LENGTH = 3_000; // same limit as the server

const CANT_REACH_SERVER = "Can't reach the server. Is it running?";
const AI_UNAVAILABLE = "The AI service isn't available right now. Please try again in a moment.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A short, safe message for each kind of failure. We don't show the server's
 * own text except for 422, which is already written for users.
 */
function messageFor(status: number, body: unknown): string {
  const fromOurServer = isRecord(body) && typeof body.error === "string";
  // In development the Vite proxy answers 5xx with no JSON body when the
  // backend isn't running, so "no body" means we never reached our server.
  if (status >= 500 && !fromOurServer) return CANT_REACH_SERVER;

  switch (status) {
    case 400:
    case 413:
      return "Your request was too long or empty. Please check it and try again.";
    case 422:
      return fromOurServer ? (body.error as string) : "We couldn't write a speech from that. Try describing it differently.";
    case 502:
    case 503:
      return AI_UNAVAILABLE;
    case 504:
      return "The AI service took too long to answer. Please try again.";
    default:
      return "Something went wrong while writing your speech. Please try again.";
  }
}

/** Returns the generated speech text, or throws an Error with a friendly message. */
export async function requestGeneratedSpeech(brief: string, signal?: AbortSignal): Promise<string> {
  let response: Response;
  try {
    response = await fetch("/api/generate-speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error(CANT_REACH_SERVER);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // no JSON body; handled below
  }

  if (!response.ok) {
    throw new Error(messageFor(response.status, body));
  }
  if (!isRecord(body) || typeof body.speech !== "string" || !body.speech.trim()) {
    throw new Error("The server sent back an empty speech. Please try again.");
  }
  return body.speech;
}
