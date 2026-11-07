import { useEffect, useRef, useState } from "react";
import {
  createSpeechRecognition,
  type SpeechRecognitionController,
  type SpeechRecognitionFailure,
} from "../services/speechRecognition";

/*
 * React wrapper around Zuzanna's createSpeechRecognition() controller
 * (services/speechRecognition.ts — do not edit that file here).
 *
 * What this hook adds on top of the controller:
 *  - an elapsed-time timer and the 10-minute / 20,000-character limits;
 *  - quiet automatic restarts when Chrome stops listening by itself
 *    (e.g. after a pause). The controller clears its transcript on every
 *    start(), so we save the finished text BEFORE each restart and join the
 *    pieces ourselves ("option b");
 *  - knowing whether the user pressed Stop, so only a real Stop ends the attempt;
 *  - friendly error messages.
 *
 * Only FINISHED recognition results ever go into the transcript. The grey
 * interim text is for display only.
 */

export type RecorderStatus = "idle" | "starting" | "recording" | "stopping";

export interface RecordingResult {
  /** Final transcript (may be empty if nothing was heard). */
  transcript: string;
  /** Measured length of the attempt in seconds. */
  durationSeconds: number;
}

interface RecorderOptions {
  language: string;
  maxSeconds: number;
  maxCharacters: number;
  /** Called once when an attempt ends (Stop, a limit, an error, or leaving the screen). */
  onFinish: (result: RecordingResult) => void;
}

// Errors where restarting would not help, so the attempt ends.
const FATAL_ERRORS = new Set([
  "not-allowed",
  "service-not-allowed",
  "audio-capture",
  "network",
  "language-not-supported",
  "bad-grammar",
  "unsupported",
  "start-failed",
  "keeps-stopping",
]);

const RESTART_DELAY_MS = 250; // short pause before quietly restarting
const STOP_FALLBACK_MS = 2500; // if the browser never confirms Stop, finish anyway
const QUICK_RESTART_LIMIT = 5; // more restarts than this in the window means something is wrong
const QUICK_RESTART_WINDOW_MS = 10_000;

/** Turns a recognition error code into a message a user can act on. */
function friendlyErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Stutterbox can't use your microphone. Click the microphone icon in Chrome's address bar, choose \"Allow\", then press Start again.";
    case "audio-capture":
      return "No microphone was found. Check that one is connected and not being used by another app, then try again.";
    case "network":
      return "Live transcription needs an internet connection, because Chrome uses an online speech service. Check your connection and try again.";
    case "unsupported":
      return "This browser doesn't support live speech recognition. Please use Google Chrome on a computer, or type your transcript instead.";
    case "language-not-supported":
      return "English (UK) speech recognition isn't available in this browser. Please try Google Chrome.";
    case "keeps-stopping":
      return "Speech recognition keeps stopping, so recording has ended.";
    default:
      return "Speech recognition stopped unexpectedly.";
  }
}

/** Joins two pieces of transcript with a single space. */
function joinText(first: string, second: string): string {
  return [first.trim(), second.trim()].filter(Boolean).join(" ");
}

export function useSpeechRecorder(options: RecorderOptions) {
  // ---- What the screen shows ----
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [finalTranscript, setFinalTranscript] = useState(""); // black text
  const [interimTranscript, setInterimTranscript] = useState(""); // grey text
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ---- Behind-the-scenes values (refs don't redraw the screen) ----
  const controllerRef = useRef<SpeechRecognitionController | null>(null);
  const savedTextRef = useRef(""); // finished text from earlier sessions (before restarts)
  const sessionTextRef = useRef(""); // finished text from the current session
  const isAttemptActiveRef = useRef(false); // true from Start until the attempt is finished
  const userStoppedRef = useRef(false); // true once the user (or a limit) asked to stop
  const fatalErrorRef = useRef<string | null>(null);
  const sessionRunningRef = useRef(false); // is the browser recognition session running?
  const startTimeRef = useRef(0);
  const endTimeRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const restartTimeoutRef = useRef<number | null>(null);
  const stopFallbackRef = useRef<number | null>(null);
  const restartTimesRef = useRef<number[]>([]);
  const optionsRef = useRef(options);

  // Always use the latest options (e.g. the latest onFinish) inside callbacks.
  useEffect(() => {
    optionsRef.current = options;
  });

  function currentText(): string {
    return joinText(savedTextRef.current, sessionTextRef.current);
  }

  function clearTimers() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    if (restartTimeoutRef.current !== null) window.clearTimeout(restartTimeoutRef.current);
    if (stopFallbackRef.current !== null) window.clearTimeout(stopFallbackRef.current);
    timerRef.current = null;
    restartTimeoutRef.current = null;
    stopFallbackRef.current = null;
  }

  /** Ends the attempt and reports the result exactly once. */
  function finish() {
    if (!isAttemptActiveRef.current) return;
    isAttemptActiveRef.current = false;
    clearTimers();

    const endTime = endTimeRef.current ?? Date.now();
    const elapsedMs = endTime - startTimeRef.current;
    // One decimal place, and never zero (the backend needs a positive duration).
    const durationSeconds = Math.max(0.1, Math.round(elapsedMs / 100) / 10);
    const transcript = currentText().slice(0, optionsRef.current.maxCharacters);

    setFinalTranscript(transcript);
    setInterimTranscript("");
    setElapsedSeconds(Math.floor(elapsedMs / 1000));
    setStatus("idle");
    if (!transcript && !fatalErrorRef.current) {
      setNotice("We didn't catch any words. Check your microphone is on, speak clearly, and try again.");
    }
    optionsRef.current.onFinish({ transcript, durationSeconds });
  }

  /** Asks recognition to stop. Used by the Stop button and by the limits. */
  function requestStop() {
    if (!isAttemptActiveRef.current || userStoppedRef.current) return;
    userStoppedRef.current = true;
    endTimeRef.current = Date.now(); // freeze the timer at the moment Stop was pressed
    setStatus("stopping");

    // Between automatic restarts nothing is running, so we can finish right away.
    if (restartTimeoutRef.current !== null || !sessionRunningRef.current) {
      finish();
      return;
    }
    controllerRef.current?.stop(); // the browser sends its last words, then "end"
    stopFallbackRef.current = window.setTimeout(() => {
      controllerRef.current?.abort();
      finish();
    }, STOP_FALLBACK_MS);
  }

  /** Called when the browser's recognition session ends, for any reason. */
  function handleSessionEnd(sessionText: string) {
    sessionRunningRef.current = false;
    sessionTextRef.current = sessionText;
    setInterimTranscript("");
    if (!isAttemptActiveRef.current) return; // the attempt was already finished

    // A real Stop, or an error that a restart can't fix: end the attempt.
    if (userStoppedRef.current || fatalErrorRef.current) {
      finish();
      return;
    }

    // Chrome stopped by itself (e.g. after a pause). Restart quietly,
    // unless it keeps happening very quickly — then something is wrong.
    const now = Date.now();
    restartTimesRef.current = [
      ...restartTimesRef.current.filter((time) => now - time < QUICK_RESTART_WINDOW_MS),
      now,
    ];
    if (restartTimesRef.current.length > QUICK_RESTART_LIMIT) {
      fatalErrorRef.current = "keeps-stopping";
      setError(friendlyErrorMessage("keeps-stopping"));
      endTimeRef.current = now;
      finish();
      return;
    }

    // Save this session's finished text BEFORE restarting, because the
    // controller clears its own transcript when start() is called again.
    savedTextRef.current = currentText();
    sessionTextRef.current = "";
    restartTimeoutRef.current = window.setTimeout(() => {
      restartTimeoutRef.current = null;
      if (isAttemptActiveRef.current && !userStoppedRef.current) {
        controllerRef.current?.start();
      }
    }, RESTART_DELAY_MS);
  }

  function handleError(failure: SpeechRecognitionFailure) {
    if (failure.finalTranscript) sessionTextRef.current = failure.finalTranscript;

    // "aborted": we caused it ourselves (Stop fallback or leaving the screen).
    // If the browser aborted on its own, the "end" that follows restarts quietly.
    if (failure.code === "aborted" || failure.code === "abort-failed") return;

    // "no-speech": a pause or silence. Not a problem; the session ends and
    // restarts quietly. If nothing was said at all, finish() shows a gentle note.
    if (failure.code === "no-speech") return;

    if (failure.code === "stop-failed") {
      finish();
      return;
    }

    // Everything else ends the attempt but keeps what was already said.
    fatalErrorRef.current = FATAL_ERRORS.has(failure.code) ? failure.code : "unexpected";
    const kept = currentText() ? " What you'd said so far has been kept." : "";
    setError(friendlyErrorMessage(failure.code) + kept);
    endTimeRef.current = endTimeRef.current ?? Date.now();
    // If the session isn't running (e.g. start failed), no "end" event will come.
    if (!sessionRunningRef.current) finish();
  }

  /** Creates the controller the first time it's needed, then reuses it. */
  function getController(): SpeechRecognitionController {
    if (!controllerRef.current) {
      controllerRef.current = createSpeechRecognition(
        {
          onInterimTranscript: (text) => setInterimTranscript(text),
          onFinalTranscript: (_segment, sessionTranscript) => {
            sessionTextRef.current = sessionTranscript;
            const text = currentText();
            setFinalTranscript(text);
            if (text.length >= optionsRef.current.maxCharacters) {
              setNotice("You've reached the maximum transcript length (20,000 characters), so recording stopped.");
              requestStop();
            }
          },
          onStateChange: (state) => {
            if (state === "ended") {
              sessionRunningRef.current = false;
              return;
            }
            sessionRunningRef.current = true;
            if (state === "listening") {
              setStatus((current) => (current === "starting" ? "recording" : current));
            }
          },
          onError: handleError,
          onEnd: handleSessionEnd,
        },
        { language: optionsRef.current.language },
      );
    }
    return controllerRef.current;
  }

  /** Starts a brand-new attempt. */
  function start() {
    if (isAttemptActiveRef.current) return;

    setError(null);
    setNotice(null);
    setFinalTranscript("");
    setInterimTranscript("");
    setElapsedSeconds(0);
    savedTextRef.current = "";
    sessionTextRef.current = "";
    userStoppedRef.current = false;
    fatalErrorRef.current = null;
    endTimeRef.current = null;
    restartTimesRef.current = [];

    const controller = getController();
    if (!controller.isSupported) {
      setError(friendlyErrorMessage("unsupported"));
      return;
    }

    isAttemptActiveRef.current = true;
    startTimeRef.current = Date.now();
    setStatus("starting");

    // The timer uses real clock time, so it doesn't drift.
    timerRef.current = window.setInterval(() => {
      if (endTimeRef.current !== null) return; // frozen after Stop
      const seconds = (Date.now() - startTimeRef.current) / 1000;
      setElapsedSeconds(Math.floor(seconds));
      if (seconds >= optionsRef.current.maxSeconds) {
        setNotice("You reached the 10-minute limit, so recording stopped.");
        requestStop();
      }
    }, 250);

    controller.start();
  }

  /** Clears the screen for a new attempt (used by "Record again"). */
  function reset() {
    if (isAttemptActiveRef.current) return;
    setError(null);
    setNotice(null);
    setFinalTranscript("");
    setInterimTranscript("");
    setElapsedSeconds(0);
    setStatus("idle");
  }

  // Leaving the screen while recording: stop the microphone and keep what was said.
  useEffect(() => {
    return () => {
      if (isAttemptActiveRef.current) {
        userStoppedRef.current = true;
        endTimeRef.current = endTimeRef.current ?? Date.now();
        finish();
      }
      clearTimers();
      controllerRef.current?.abort();
    };
  }, []); // empty list: the clean-up runs only when the screen closes

  return {
    status,
    isRecording: status !== "idle",
    finalTranscript,
    interimTranscript,
    elapsedSeconds,
    error,
    notice,
    start,
    stop: requestStop,
    reset,
  };
}
