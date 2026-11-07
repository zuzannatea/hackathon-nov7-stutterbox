export type SpeechRecognitionState = "starting" | "listening" | "ended";

export interface SpeechRecognitionFailure {
  code:
    | SpeechRecognitionErrorCode
    | "unsupported"
    | "start-failed"
    | "stop-failed"
    | "abort-failed";
  message?: string;
  finalTranscript: string;
}

export interface SpeechRecognitionCallbacks {
  /** Current provisional text. It may change and must not be added to the final transcript. */
  onInterimTranscript?: (transcript: string) => void;
  /** A newly finalized or corrected segment and the complete final transcript so far. */
  onFinalTranscript?: (segment: string, completeTranscript: string) => void;
  /** State transitions include the final transcript; `starting` follows a session reset. */
  onStateChange?: (state: SpeechRecognitionState, finalTranscript: string) => void;
  onError?: (failure: SpeechRecognitionFailure) => void;
  onEnd?: (finalTranscript: string) => void;
}

export interface SpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

export interface SpeechRecognitionController {
  readonly isSupported: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  getFinalTranscript(): string;
}

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((event: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionConstructor = new () => RecognitionLike;
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

/**
 * Creates a UI-independent Web Speech API controller. Finalized text is kept
 * locally and remains available through getFinalTranscript(), including after
 * recognition errors or unexpected end events.
 */
export function createSpeechRecognition(
  callbacks: SpeechRecognitionCallbacks = {},
  options: SpeechRecognitionOptions = {},
): SpeechRecognitionController {
  const browserWindow =
    typeof window === "undefined" ? undefined : (window as SpeechRecognitionWindow);
  const Recognition = browserWindow?.SpeechRecognition ?? browserWindow?.webkitSpeechRecognition;
  const recognition = Recognition ? new Recognition() : null;
  const finalizedSegments: string[] = [];

  let active = false;

  if (recognition) {
    recognition.lang = options.language ?? "en-US";
    recognition.continuous = options.continuous ?? true;
    recognition.interimResults = options.interimResults ?? true;

    recognition.onstart = () => {
      active = true;
      callbacks.onStateChange?.("listening", getFinalTranscript());
    };

    recognition.onresult = (event) => {
      const interimSegments: string[] = [];

      // Scan every result so a revised interim result is reflected immediately.
      // Final segments are stored by result index, preventing duplicate appends.
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const segment = result[0]?.transcript.trim() ?? "";
        if (!segment) continue;

        if (result.isFinal) {
          if (finalizedSegments[index] !== segment) {
            finalizedSegments[index] = segment;
            callbacks.onFinalTranscript?.(segment, getFinalTranscript());
          }
        } else {
          interimSegments.push(segment);
        }
      }

      callbacks.onInterimTranscript?.(interimSegments.join(" ").trim());
    };

    recognition.onerror = (event) => {
      callbacks.onError?.({
        code: event.error,
        ...(event.message ? { message: event.message } : {}),
        finalTranscript: getFinalTranscript(),
      });
    };

    recognition.onend = () => {
      active = false;
      const finalTranscript = getFinalTranscript();
      callbacks.onInterimTranscript?.("");
      callbacks.onStateChange?.("ended", finalTranscript);
      callbacks.onEnd?.(finalTranscript);
    };
  }

  function getFinalTranscript(): string {
    return finalizedSegments.filter(Boolean).join(" ").trim();
  }

  return {
    isSupported: recognition !== null,

    start(): void {
      if (active) return;
      if (!recognition) {
        callbacks.onError?.({
          code: "unsupported",
          message: "Speech recognition is not supported in this browser.",
          finalTranscript: getFinalTranscript(),
        });
        return;
      }

      // A call while active is ignored above. An inactive start begins a new
      // session and clears the prior session's finalized text exactly once.
      finalizedSegments.length = 0;
      active = true;
      callbacks.onInterimTranscript?.("");
      callbacks.onStateChange?.("starting", "");

      try {
        recognition.start();
      } catch (error) {
        active = false;
        callbacks.onStateChange?.("ended", getFinalTranscript());
        callbacks.onError?.({
          code: "start-failed",
          ...(error instanceof Error ? { message: error.message } : {}),
          finalTranscript: getFinalTranscript(),
        });
      }
    },

    stop(): void {
      if (!active || !recognition) return;
      try {
        recognition.stop();
      } catch (error) {
        callbacks.onError?.({
          code: "stop-failed",
          ...(error instanceof Error ? { message: error.message } : {}),
          finalTranscript: getFinalTranscript(),
        });
      }
    },

    abort(): void {
      if (!active || !recognition) return;
      try {
        recognition.abort();
      } catch (error) {
        callbacks.onError?.({
          code: "abort-failed",
          ...(error instanceof Error ? { message: error.message } : {}),
          finalTranscript: getFinalTranscript(),
        });
      }
    },

    getFinalTranscript,
  };
}
