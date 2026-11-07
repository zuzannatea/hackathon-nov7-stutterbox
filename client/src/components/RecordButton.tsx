import { Mic, Square } from "lucide-react";

interface RecordButtonProps {
  isRecording: boolean;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
}

/** The big Start / Stop button, shared by Live transcript and Practice mode. */
export default function RecordButton({ isRecording, disabled = false, onStart, onStop }: RecordButtonProps) {
  return (
    <button
      type="button"
      className={`record-button ${isRecording ? "record-button-stop" : ""}`}
      onClick={isRecording ? onStop : onStart}
      disabled={disabled}
    >
      {isRecording ? (
        <>
          <Square size={20} fill="currentColor" aria-hidden="true" />
          Stop
        </>
      ) : (
        <>
          <Mic size={22} aria-hidden="true" />
          Start
        </>
      )}
    </button>
  );
}
