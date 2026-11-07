// Asks our backend to turn uploaded CSV data into a speech.
// The backend calls Claude; the API key never reaches the browser.

import type { CsvSpeechRequest } from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fallbackMessage(status: number): string {
  switch (status) {
    case 400:
      return "The data couldn't be read. Please upload the CSV file again.";
    case 413:
      return "This data is too large to send. Please use a smaller CSV file.";
    case 503:
      return "Speech writing isn't available right now. Please try again later.";
    case 504:
      return "Turning your data into a speech took too long. Please try again.";
    default:
      return "Something went wrong while writing your speech. Please try again.";
  }
}

/** Returns the generated speech text, or throws an Error with a friendly message. */
export async function requestSpeechFromCsv(request: CsvSpeechRequest): Promise<string> {
  let response: Response;
  try {
    response = await fetch("/api/generate-speech-from-csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
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
