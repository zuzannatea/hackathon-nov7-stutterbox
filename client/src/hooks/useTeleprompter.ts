import { useCallback, useEffect, useRef, useState } from "react";
import { countWords } from "../utils/format";

export const MIN_SPEED_WPM = 100;
export const MAX_SPEED_WPM = 180;
export const DEFAULT_SPEED_WPM = 130;
const MIN_LINE_MS = 1000; // even a one-word line stays up for at least a second
const TICK_MS = 100;

/** How long a line stays as the current line, based on its words and the speed. */
function lineDurationMs(line: string | undefined, wordsPerMinute: number): number {
  const words = countWords(line ?? "");
  return Math.max(MIN_LINE_MS, (words / wordsPerMinute) * 60_000);
}

/** Where the teleprompter is: which line, and how long it has been showing. */
interface Position {
  index: number;
  elapsedMs: number;
}

/**
 * Timing for the Practice-mode teleprompter (scrolling only — speech
 * recognition is handled separately by useSpeechRecorder).
 */
export function useTeleprompter(lines: string[]) {
  const [position, setPosition] = useState<Position>({ index: 0, elapsedMs: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [wordsPerMinute, setWordsPerMinute] = useState(DEFAULT_SPEED_WPM);

  // The timer reads these through refs so it always uses the latest values.
  const linesRef = useRef(lines);
  const speedRef = useRef(wordsPerMinute);
  useEffect(() => {
    linesRef.current = lines;
    speedRef.current = wordsPerMinute;
  });

  // Stable functions (they never change), so other effects can safely depend on them.
  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);

  const lastIndex = Math.max(0, lines.length - 1);
  const currentIndex = Math.min(position.index, lastIndex);
  const currentDuration = lineDurationMs(lines[currentIndex], wordsPerMinute);
  const isFinished = lines.length > 0 && currentIndex === lastIndex && position.elapsedMs >= currentDuration;

  // While playing, add time every 100 ms and move to the next line when its time is up.
  useEffect(() => {
    if (!isPlaying) return;
    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = now - lastTick;
      lastTick = now;

      setPosition((current) => {
        const allLines = linesRef.current;
        const duration = lineDurationMs(allLines[current.index], speedRef.current);
        const elapsedMs = current.elapsedMs + delta;
        if (elapsedMs < duration) return { index: current.index, elapsedMs };
        if (current.index < allLines.length - 1) return { index: current.index + 1, elapsedMs: 0 };
        return current.elapsedMs >= duration ? current : { index: current.index, elapsedMs: duration }; // stay on the last line
      });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  // Overall progress from 0 to 1 (whole lines done + part of the current line).
  const progress =
    lines.length === 0 ? 0 : (currentIndex + Math.min(1, position.elapsedMs / currentDuration)) / lines.length;

  return {
    currentIndex,
    progress,
    isPlaying: isPlaying && !isFinished,
    isFinished,
    wordsPerMinute,
    setWordsPerMinute,
    play,
    pause,
    restart: () => {
      setIsPlaying(false);
      setPosition({ index: 0, elapsedMs: 0 });
    },
    jumpTo: (index: number) => setPosition({ index: Math.max(0, Math.min(index, lastIndex)), elapsedMs: 0 }),
  };
}
