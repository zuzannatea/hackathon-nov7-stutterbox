import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { useSpeechRecorder } from "../hooks/useSpeechRecorder";
import { MAX_SPEED_WPM, MIN_SPEED_WPM, useTeleprompter } from "../hooks/useTeleprompter";
import { formatTime } from "../utils/format";
import RecordButton from "./RecordButton";

const LINES_EACH_SIDE = 2; // show about 2 lines before and 2 after the current one

interface TeleprompterProps {
  /** The speech split into short lines (see utils/splitSpeechLines.ts). */
  lines: string[];
  /** The same recorder Live mode uses, so recognition code isn't duplicated. */
  recorder: ReturnType<typeof useSpeechRecorder>;
}

/**
 * Practice mode: a lyrics-style teleprompter. Start begins both the scrolling
 * and speech recognition; Stop ends both. The live transcript text is hidden
 * here to avoid distraction, but it's still captured for Feedback.
 */
export default function Teleprompter({ lines, recorder }: TeleprompterProps) {
  const prompter = useTeleprompter(lines);
  const { play, pause } = prompter;
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const [offset, setOffset] = useState(0);

  // Scrolling follows recording: it starts when recognition is actually
  // listening, and stops when recording ends for any reason (Stop, an error,
  // or a limit). Pause/Resume in between only affects the scrolling.
  useEffect(() => {
    if (recorder.status === "recording") play();
    if (recorder.status === "idle" || recorder.status === "stopping") pause();
  }, [recorder.status, play, pause]); // play/pause never change, so this reacts to the recording status

  // Keep the current line vertically centred in the panel.
  useLayoutEffect(() => {
    function centreCurrentLine() {
      const panel = panelRef.current;
      const current = listRef.current?.children[prompter.currentIndex] as HTMLElement | undefined;
      if (!panel || !current) return;
      setOffset(panel.clientHeight / 2 - (current.offsetTop + current.offsetHeight / 2));
    }
    centreCurrentLine();
    window.addEventListener("resize", centreCurrentLine);
    return () => window.removeEventListener("resize", centreCurrentLine);
  }, [prompter.currentIndex, lines]);

  function handleStart() {
    if (prompter.isFinished) prompter.restart(); // start again from the top if the last run finished
    recorder.start();
  }

  const isRecording = recorder.isRecording;
  const canPauseOrResume = recorder.status === "recording" && !prompter.isFinished;
  const isPausedWhileRecording = canPauseOrResume && !prompter.isPlaying;
  const percent = Math.round(prompter.progress * 100);

  return (
    <section className="card prompter-card" aria-labelledby="prompter-heading">
      <h2 id="prompter-heading" className="visually-hidden">
        Practice mode
      </h2>

      {/* Small recording indicator instead of the live transcript */}
      <div className="prompter-status">
        <p className={`recording-status recording-status-${recorder.status}`} role="status">
          <span className="recording-dot" aria-hidden="true" />
          {recorder.status === "idle" && "Ready. Press Start to begin scrolling and recording"}
          {recorder.status === "starting" && "Starting… if Chrome asks, allow the microphone"}
          {recorder.status === "recording" && "Recording"}
          {recorder.status === "stopping" && "Finishing…"}
        </p>
        {isRecording && (
          <p className="prompter-time">
            <span className="visually-hidden">Elapsed time: </span>
            {formatTime(recorder.elapsedSeconds)}
          </p>
        )}
      </div>

      {/* ---------- Scrolling lines ---------- */}
      <div className="prompter-panel" ref={panelRef}>
        <ol className="prompter-lines" ref={listRef} style={{ transform: `translateY(${offset}px)` }}>
          {lines.map((line, index) => {
            const distance = Math.abs(index - prompter.currentIndex);
            const isVisible = distance <= LINES_EACH_SIDE;
            return (
              <li key={index} className={`prompter-line prompter-line-d${Math.min(distance, 3)}`}>
                <button
                  type="button"
                  className="prompter-line-button"
                  onClick={() => prompter.jumpTo(index)}
                  tabIndex={isVisible ? 0 : -1}
                  aria-hidden={isVisible ? undefined : true}
                  aria-current={distance === 0 ? "true" : undefined}
                  aria-label={`Line ${index + 1}: ${line}. Jump to this line`}
                >
                  {line}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* ---------- Progress ---------- */}
      <div className="prompter-progress-row">
        <div
          className="prompter-progress"
          role="progressbar"
          aria-label="Speech progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="prompter-progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <p className="prompter-line-count">
          Line {prompter.currentIndex + 1} of {lines.length}
        </p>
      </div>
      {prompter.isFinished && isRecording && (
        <p className="hint prompter-end-note">End of your speech. Press Stop when you've finished.</p>
      )}

      {/* ---------- Controls ---------- */}
      <RecordButton
        isRecording={isRecording}
        disabled={recorder.status === "stopping"}
        onStart={handleStart}
        onStop={recorder.stop}
      />

      <div className="prompter-controls">
        <button
          type="button"
          className="button-secondary"
          onClick={isPausedWhileRecording ? play : pause}
          disabled={!canPauseOrResume}
        >
          {isPausedWhileRecording ? (
            <>
              <Play size={16} aria-hidden="true" /> Resume scrolling
            </>
          ) : (
            <>
              <Pause size={16} aria-hidden="true" /> Pause scrolling
            </>
          )}
        </button>
        <button type="button" className="button-secondary" onClick={prompter.restart} disabled={isRecording}>
          <RotateCcw size={16} aria-hidden="true" /> Restart
        </button>
      </div>

      <div className="prompter-speed">
        <label htmlFor="prompter-speed">Scrolling speed</label>
        <input
          id="prompter-speed"
          type="range"
          min={MIN_SPEED_WPM}
          max={MAX_SPEED_WPM}
          step={5}
          value={prompter.wordsPerMinute}
          onChange={(e) => prompter.setWordsPerMinute(Number(e.target.value))}
          aria-valuetext={`${prompter.wordsPerMinute} words per minute`}
        />
        <output htmlFor="prompter-speed" className="prompter-speed-value">
          {prompter.wordsPerMinute} words / min
        </output>
      </div>

      <p className="hint privacy-note">
        Your browser's speech service turns your voice into text in the background. Chrome uses an
        online service, so you need an internet connection. Stutterbox never records or uploads audio.
      </p>
    </section>
  );
}
