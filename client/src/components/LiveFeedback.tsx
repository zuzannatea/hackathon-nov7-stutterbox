import { useLiveFeedback, type LiveFeedbackInput } from "../hooks/useLiveFeedback";

interface LiveFeedbackProps {
  /** The object returned by useSpeechRecorder (only these three fields are used). */
  recorder: LiveFeedbackInput;
}

/**
 * Live volume and pace hints shown while recording. Unstyled: plain class
 * names for Member 1 to style. Only warnings are announced to screen readers.
 */
export default function LiveFeedback({ recorder }: LiveFeedbackProps) {
  const live = useLiveFeedback(recorder);
  if (!recorder.isRecording) return null;

  return (
    <div className="live-feedback">
      {live.volumeAvailable && (
        <div className={`live-feedback__volume${live.volumeWarning ? " live-feedback--warning" : ""}`}>
          <label className="live-feedback__label">
            Mic input level (not a quality score)
            <meter className="live-feedback__meter" min={0} max={1} low={0.3} high={0.9} optimum={0.6} value={live.inputLevel} />
          </label>
          <p className="live-feedback__message" aria-live="polite">
            {live.volumeWarning ?? ""}
          </p>
        </div>
      )}

      <div className={`live-feedback__pace${live.paceWarning ? " live-feedback--warning" : ""}`}>
        <p className="live-feedback__label">
          Pace: {live.wordsPerMinute === null ? "measuring…" : `${live.wordsPerMinute} words/min`}
        </p>
        <p className="live-feedback__message" aria-live="polite">
          {live.paceWarning ?? ""}
        </p>
      </div>
    </div>
  );
}
