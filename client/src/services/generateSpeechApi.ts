// Asks our backend to write a speech from the user's description.
// The backend calls Claude; the API key never reaches the browser.

export const MAX_SPEECH_BRIEF_LENGTH = 3_000; // same limit as the server

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fallbackMessage(status: number): string {
  switch (status) {
    case 400:
      return "Please check your description and try again.";
    case 503:
      return "Speech writing isn't available right now. Please try again later.";
    case 504:
      return "Writing your speech took too long. Please try again.";
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
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // handled below
  }

  if (!response.ok) {
    throw new Error(isRecord(body) && typeof body.error === "string" ? body.error : fallbackMessage(response.status));
  }
  if (!isRecord(body) || typeof body.speech !== "string" || !body.speech.trim()) {
    throw new Error("The server sent back an empty speech. Please try again.");
  }
  return body.speech;
}
