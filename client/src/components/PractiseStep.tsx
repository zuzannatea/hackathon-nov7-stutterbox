import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSpeechRecorder } from "../hooks/useSpeechRecorder";
import type { AnalysisApiErrorInfo } from "../services/analysisApi";
import type { PractiseAttempt } from "../types";
import { formatTime } from "../utils/format";
import { splitSpeechLines } from "../utils/splitSpeechLines";
import RecordButton from "./RecordButton";
import Teleprompter from "./Teleprompter";

type PractiseMode = "live" | "practice";

// Team decisions for the demo (PROJECT.md section 12 "Open decisions").
const MAX_RECORDING_SECONDS = 10 * 60; // 10 minutes
const MAX_TRANSCRIPT_CHARACTERS = 20_000; // same limit as the backend
const RECOGNITION_LANGUAGE = "en-GB";

const PRACTISE_TIPS = [
  "Speak at your normal pace, as if your audience were in front of you.",
  "Pauses are fine. Recording keeps going until you press Stop.",
  "Use Google Chrome on a computer, with an internet connection.",
];

interface PractiseStepProps {
  /** The speech from Step 1 (empty if skipped), shown as a reference. */
  speechTitle: string;
  speechText: string;
  /** The finished attempt kept in App.tsx, or null if there isn't one yet. */
  attempt: PractiseAttempt | null;
  onAttemptChange: (attempt: PractiseAttempt | null) => void;
  onBack: () => void;
  onGetFeedback: () => void;
  isSubmitting: boolean;
  analysisError: AnalysisApiErrorInfo | null;
  /** Go back to Step 1 (from the "Add your speech" hint). */
  onEditSpeech: () => void;
}

export default function PractiseStep({
  speechTitle,
  speechText,
  attempt,
  onAttemptChange,
  onBack,
  onGetFeedback,
  isSubmitting,
  analysisError,
  onEditSpeech,
}: PractiseStepProps) {
  const recorder = useSpeechRecorder({
    language: RECOGNITION_LANGUAGE,
    maxSeconds: MAX_RECORDING_SECONDS,
    maxCharacters: MAX_TRANSCRIPT_CHARACTERS,
    onFinish: (result) => {
      // Only keep an attempt if some words were heard. Otherwise the hook
      // shows a gentle "we didn't catch any words" message.
      if (result.transcript) {
        onAttemptChange({ ...result, source: "speech" });
      }
    },
  });

  const [showTypedForm, setShowTypedForm] = useState(false);

  // Practice mode needs a speech from Step 1 to scroll through.
  const lines = useMemo(() => splitSpeechLines(speechText), [speechText]);
  const canUsePracticeMode = lines.length > 0;
  const [mode, setMode] = useState<PractiseMode>(canUsePracticeMode ? "practice" : "live");
  const activeMode: PractiseMode = canUsePracticeMode ? mode : "live";
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);

  // When a finished transcript appears, move keyboard/screen-reader focus to it.
  useEffect(() => {
    if (attempt) resultHeadingRef.current?.focus();
  }, [attempt]);

  function recordAgain() {
    onAttemptChange(null);
    recorder.reset();
    setShowTypedForm(false);
  }

  function handleTypedTranscript(typedAttempt: PractiseAttempt) {
    onAttemptChange(typedAttempt);
    recorder.reset();
    setShowTypedForm(false);
  }

  const statusLabel = {
    idle: "Ready to record",
    starting: "Starting… if Chrome asks, allow the microphone",
    recording: "Recording",
    stopping: "Finishing…",
  }[recorder.status];

  const hasLiveText = recorder.finalTranscript !== "" || recorder.interimTranscript !== "";

  // "Get feedback" is only available once recording has stopped and there's a final transcript.
  const hasTranscript = attempt !== null && attempt.transcript.trim() !== "";
  const feedbackBlockedReason = recorder.isRecording
    ? "Stop recording first"
    : !hasTranscript
      ? "Record your speech first"
      : null;
  const canGetFeedback = feedbackBlockedReason === null && !isSubmitting;

  function handleGetFeedbackClick() {
    if (canGetFeedback) onGetFeedback(); // aria-disabled buttons can still be clicked, so check here
  }

  return (
    <>
      {/* ---------- Mode switch ---------- */}
      <div className="mode-switch-row">
        <div className="mode-switch" role="group" aria-label="Practise mode">
          <button
            type="button"
            className="mode-option"
            aria-pressed={activeMode === "live"}
            onClick={() => setMode("live")}
            disabled={recorder.isRecording}
          >
            Live transcript
          </button>
          <button
            type="button"
            className="mode-option"
            aria-pressed={activeMode === "practice"}
            onClick={() => setMode("practice")}
            disabled={recorder.isRecording || !canUsePracticeMode}
            aria-describedby={canUsePracticeMode ? undefined : "practice-mode-hint"}
          >
            Practice mode
          </button>
        </div>
        {!canUsePracticeMode && (
          <p id="practice-mode-hint" className="hint mode-hint">
            Add your speech in Step 1 to use Practice mode.{" "}
            <button type="button" className="link-button inline-link" onClick={onEditSpeech}>
              Go to Step 1
            </button>
          </p>
        )}
        {recorder.isRecording && (
          <p className="hint mode-hint">You can switch modes after you stop recording.</p>
        )}
      </div>

      {recorder.error && (
        <div className="message message-error" role="alert">
          {recorder.error}
        </div>
      )}
      {recorder.notice && (
        <div className="message message-info" role="status">
          {recorder.notice}
        </div>
      )}

      <div className={`practise-layout ${activeMode === "practice" ? "practise-layout-full" : ""}`}>
        <div className="practise-main">
          {attempt ? (
            // ---------- Finished: show the complete transcript ----------
            <section className="card" aria-labelledby="result-heading">
              <h2 id="result-heading" className="card-heading" tabIndex={-1} ref={resultHeadingRef}>
                Your transcript
              </h2>
              <ul className="chip-row" aria-label="About this attempt">
                <li className="chip">
                  {attempt.source === "typed" ? "Typed transcript (not spoken)" : "Spoken, transcribed live"}
                </li>
                <li className="chip">Duration {formatTime(attempt.durationSeconds)}</li>
              </ul>
              <div className="transcript-box">{attempt.transcript}</div>
              {/* "Record again" and "Get feedback" sit together at the bottom of the screen. */}
            </section>
          ) : activeMode === "practice" ? (
            // ---------- Practice mode: teleprompter + background recognition ----------
            <Teleprompter lines={lines} recorder={recorder} />
          ) : (
            // ---------- Live transcript mode (unchanged) ----------
            <section className="card recorder-card" aria-labelledby="recorder-heading">
              <h2 id="recorder-heading" className="visually-hidden">
                Record your speech
              </h2>
              <div className="recorder-top">
                <p className={`recording-status recording-status-${recorder.status}`} role="status">
                  <span className="recording-dot" aria-hidden="true" />
                  {statusLabel}
                </p>
                <p className="recorder-timer">
                  <span className="visually-hidden">Elapsed time: </span>
                  {formatTime(recorder.elapsedSeconds)}
                  <span className="recorder-timer-max"> / {formatTime(MAX_RECORDING_SECONDS)}</span>
                </p>
              </div>

              <RecordButton
                isRecording={recorder.isRecording}
                disabled={recorder.status === "stopping"}
                onStart={recorder.start}
                onStop={recorder.stop}
              />

              <h3 className="live-heading">Live transcript</h3>
              <div className="transcript-box live-box">
                {!hasLiveText && !recorder.isRecording && (
                  <p className="live-placeholder">Press Start and your words will appear here as you speak.</p>
                )}
                {!hasLiveText && recorder.isRecording && (
                  <p className="live-placeholder">Listening…</p>
                )}
                <p className="live-text">
                  {/* Finished words: announced politely to screen readers */}
                  <span aria-live="polite">{recorder.finalTranscript}</span>
                  {/* In-progress words: grey, may still change */}
                  {recorder.interimTranscript && (
                    <span className="interim-text"> {recorder.interimTranscript}</span>
                  )}
                </p>
              </div>
              <p className="hint privacy-note">
                Your browser's speech service turns your voice into text. Chrome uses an online
                service, so you need an internet connection. Stutterbox never records or uploads
                audio, and transcripts may contain mistakes.
              </p>
            </section>
          )}

          {/* ---------- Fallback: type or paste a transcript ---------- */}
          {!attempt && (
            <section className="card typed-card" aria-labelledby="typed-heading">
              {showTypedForm ? (
                <TypedTranscriptForm
                  onCancel={() => setShowTypedForm(false)}
                  onSubmit={handleTypedTranscript}
                />
              ) : (
                <>
                  <h2 id="typed-heading" className="card-heading-small">
                    Speech recognition not working?
                  </h2>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => setShowTypedForm(true)}
                    disabled={recorder.isRecording}
                  >
                    Type or paste a transcript instead
                  </button>
                </>
              )}
            </section>
          )}
        </div>

        {/* ---------- Side panel (Live mode only): the Step 1 speech, or tips ---------- */}
        {activeMode === "practice" ? null : speechText.trim() ? (
          <aside className="side-card speech-panel" aria-labelledby="speech-panel-heading">
            <h2 id="speech-panel-heading">Your speech</h2>
            {speechTitle && <p className="speech-panel-title">{speechTitle}</p>}
            <div className="speech-panel-text">{speechText}</div>
          </aside>
        ) : (
          <aside className="side-card" aria-labelledby="practise-tips-heading">
            <h2 id="practise-tips-heading">Quick tips</h2>
            <ul className="tips-list">
              {PRACTISE_TIPS.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      {analysisError && (
        <div className="message message-error feedback-error" role="alert">
          {analysisError.kind === "network"
            ? analysisError.message
            : `Analysis request${analysisError.status ? ` (HTTP ${analysisError.status})` : ""} failed: ${analysisError.message}`}
        </div>
      )}

      {/* ---------- Bottom row: Back (left) and Get feedback (right) ---------- */}
      <div className="step-nav step-nav-split">
        <button type="button" className="button-back" onClick={onBack} disabled={isSubmitting}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back
        </button>
        <div className="feedback-action">
          <div className="practise-actions">
            {/* Shown only once there's a recording, as before */}
            {attempt && (
              <button
                type="button"
                className="button-secondary"
                onClick={recordAgain}
                disabled={isSubmitting}
              >
                <RotateCcw size={16} aria-hidden="true" />
                Record again
              </button>
            )}
            <button
              type="button"
              className="button-primary"
              onClick={handleGetFeedbackClick}
              aria-disabled={!canGetFeedback}
              aria-describedby={feedbackBlockedReason ? "feedback-hint" : undefined}
            >
              {isSubmitting ? "Analyzing…" : "Get feedback"}
              {!isSubmitting && <ArrowRight size={18} aria-hidden="true" />}
            </button>
          </div>
          {feedbackBlockedReason && (
            <p id="feedback-hint" className="hint feedback-hint">
              {feedbackBlockedReason}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

interface TypedTranscriptFormProps {
  onCancel: () => void;
  onSubmit: (attempt: PractiseAttempt) => void;
}

/**
 * Lets the user type or paste a transcript when live recognition fails.
 * The result is always labelled as typed, never as spoken. The user must say
 * how long the speech took, because the backend needs a real duration to
 * work out words per minute.
 */
function TypedTranscriptForm({ onCancel, onSubmit }: TypedTranscriptFormProps) {
  const [text, setText] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const mins = minutes.trim() === "" ? 0 : Number(minutes);
    const secs = seconds.trim() === "" ? 0 : Number(seconds);
    const totalSeconds = mins * 60 + secs;

    if (text.trim() === "") {
      setError("Please type or paste your transcript.");
    } else if (
      !Number.isInteger(mins) || !Number.isInteger(secs) || mins < 0 || secs < 0 || secs > 59
    ) {
      setError("Please enter whole minutes, and seconds between 0 and 59.");
    } else if (totalSeconds <= 0) {
      setError("Please enter how long the speech took (more than 0 seconds).");
    } else if (totalSeconds > MAX_RECORDING_SECONDS) {
      setError("Please keep it to 10 minutes or less.");
    } else {
      onSubmit({ transcript: text.trim(), durationSeconds: totalSeconds, source: "typed" });
      return;
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 id="typed-heading" className="card-heading-small">
        Type or paste a transcript
      </h2>
      <p className="hint">
        Use this if live speech recognition isn't working. Your feedback will say it was typed, not
        spoken.
      </p>

      {error && (
        <p className="field-error typed-error" role="alert">
          {error}
        </p>
      )}

      <div className="field">
        <label htmlFor="typed-transcript">Transcript</label>
        <textarea
          id="typed-transcript"
          rows={6}
          value={text}
          maxLength={MAX_TRANSCRIPT_CHARACTERS}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <fieldset className="field">
        <legend>How long did it take to say?</legend>
        <div className="duration-inputs">
          <div>
            <label htmlFor="typed-minutes" className="sub-label-inline">
              Minutes
            </label>
            <input
              id="typed-minutes"
              type="number"
              inputMode="numeric"
              min={0}
              max={10}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="typed-seconds" className="sub-label-inline">
              Seconds
            </label>
            <input
              id="typed-seconds"
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      <div className="form-actions">
        <button type="button" className="button-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button-primary">
          Use this transcript
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
