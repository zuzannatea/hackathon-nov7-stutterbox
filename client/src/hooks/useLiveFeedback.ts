import { useEffect, useRef, useState } from "react";

/*
 * Live, browser-only delivery hints while the user is recording:
 *  - VOLUME: microphone input level via the Web Audio API. This is an
 *    input-level indicator only, NOT a confidence or speaking-quality score.
 *  - PACE: words per minute over a rolling window, from the live transcript.
 *
 * No AI calls and nothing is sent anywhere. The microphone stream opened here
 * is only measured, never recorded or uploaded, and is released as soon as
 * recording stops or the screen closes.
 *
 * All thresholds below are guesses to tune on the demo laptop: mics differ a lot.
 */

// ---------- On/off switch ----------
/** Set to false if the volume meter interferes with speech recognition. Pace keeps working. */
export const ENABLE_VOLUME_WARNINGS = true;
/** TEMPORARY for tuning: logs the mic level to the browser console once a second. Set to false before committing. */
const DEBUG_LOG_LEVELS = false;

// ---------- Volume (levels in dBFS: 0 is the loudest possible, -100 is near silence) ----------
/** How often the mic level is measured. */
const VOLUME_SAMPLE_MS = 100;
/** Below this level counts as silence or a pause and is ignored (never triggers "Speak up"). */
const NOISE_FLOOR_DB = -50;
/** Speaking, but below this level, counts as quiet speech. */
const QUIET_SPEECH_DB = -32;
/** How far back to look when deciding the voice is too quiet. */
const QUIET_WINDOW_MS = 2_500;
/** Need at least this much actual speech (not pauses) in the window before judging. */
const QUIET_MIN_SPEECH_MS = 1_200;
/** Share of the speech in the window that must be quiet to show "Speak up". */
const QUIET_SHARE = 0.7;
/** A sample peak at or above this (1.0 = clipping) counts as near clipping. */
const NEAR_CLIP_PEAK = 0.95;
/** How far back to look when deciding the voice is too loud. */
const LOUD_WINDOW_MS = 2_000;
/** Near-clipping samples needed in that window to show "Too loud". */
const LOUD_MIN_CLIP_SAMPLES = 4;
/** The level meter maps this range of dB onto 0–1. */
const METER_MIN_DB = -60;
const METER_MAX_DB = 0;

// ---------- Pace ----------
/** Words per minute are measured over this rolling window. */
const PACE_WINDOW_MS = 20_000;
/** No pace warnings until this long after recording starts. */
const PACE_WARMUP_MS = 10_000;
/** Faster than this shows "Slow down a little". */
const TOO_FAST_WPM = 170;
/** Slower than this shows "Pick up the pace a little". */
const TOO_SLOW_WPM = 100;
/** "Too slow" is not shown while the user has been silent for at least this long (a pause). */
const PAUSE_IGNORE_MS = 1_500;

// ---------- No flicker ----------
/** The display updates at most this often. */
const UPDATE_MS = 1_000;
/** A new condition must hold for this many updates in a row before the display switches. */
const CONFIRM_UPDATES = 2;
/** Once shown, a warning stays visible at least this long. */
const MIN_WARNING_VISIBLE_MS = 3_000;

export const VOLUME_MESSAGES = {
  quiet: "Speak up",
  loud: "A bit loud — move back from the mic",
} as const;

export const PACE_MESSAGES = {
  fast: "Slow down a little",
  slow: "Pick up the pace a little",
} as const;

type VolumeWarning = keyof typeof VOLUME_MESSAGES;
type PaceWarning = keyof typeof PACE_MESSAGES;

export interface LiveFeedbackInput {
  isRecording: boolean;
  finalTranscript: string;
  interimTranscript: string;
}

export interface LiveFeedbackState {
  /** False when the mic level can't be read (or volume is switched off): hide the volume part. */
  volumeAvailable: boolean;
  /** Microphone input level from 0 to 1, averaged over the last second. */
  inputLevel: number;
  volumeWarning: string | null;
  /** Words per minute over the rolling window, or null during the warm-up. */
  wordsPerMinute: number | null;
  paceWarning: string | null;
}

const IDLE_STATE: LiveFeedbackState = {
  volumeAvailable: false,
  inputLevel: 0,
  volumeWarning: null,
  wordsPerMinute: null,
  paceWarning: null,
};

interface LevelSample {
  time: number;
  db: number;
  peak: number;
}

interface WordSample {
  time: number;
  words: number;
}

/** Holds a warning steady: switches only after the change is confirmed, and keeps a warning up for a minimum time. */
class SteadyWarning<T extends string> {
  private shown: T | null = null;
  private shownSince = 0;
  private candidate: T | null = null;
  private candidateCount = 0;

  update(raw: T | null, now: number): T | null {
    if (raw === this.shown) {
      this.candidate = null;
      this.candidateCount = 0;
      return this.shown;
    }
    if (raw === this.candidate) {
      this.candidateCount += 1;
    } else {
      this.candidate = raw;
      this.candidateCount = 1;
    }
    const warningStillHeld = this.shown !== null && now - this.shownSince < MIN_WARNING_VISIBLE_MS;
    if (this.candidateCount >= CONFIRM_UPDATES && !warningStillHeld) {
      this.shown = raw;
      this.shownSince = now;
      this.candidate = null;
      this.candidateCount = 0;
    }
    return this.shown;
  }
}

function countWords(text: string): number {
  return (text.trim().match(/\S+/g) ?? []).length;
}

function toDb(value: number): number {
  return value > 0 ? 20 * Math.log10(value) : -100;
}

function decideVolume(samples: LevelSample[], now: number): VolumeWarning | null {
  const loudSamples = samples.filter((s) => now - s.time <= LOUD_WINDOW_MS && s.peak >= NEAR_CLIP_PEAK);
  if (loudSamples.length >= LOUD_MIN_CLIP_SAMPLES) return "loud";

  const speech = samples.filter((s) => now - s.time <= QUIET_WINDOW_MS && s.db >= NOISE_FLOOR_DB);
  if (speech.length * VOLUME_SAMPLE_MS < QUIET_MIN_SPEECH_MS) return null; // mostly pauses: no judgement
  const quiet = speech.filter((s) => s.db < QUIET_SPEECH_DB).length;
  return quiet / speech.length >= QUIET_SHARE ? "quiet" : null;
}

function isPausing(samples: LevelSample[], now: number): boolean {
  const recent = samples.filter((s) => now - s.time <= PAUSE_IGNORE_MS);
  return recent.length > 0 && recent.every((s) => s.db < NOISE_FLOOR_DB);
}

/**
 * Live volume and pace hints for the current recording. Pass the recorder's
 * isRecording, finalTranscript and interimTranscript.
 */
export function useLiveFeedback({ isRecording, finalTranscript, interimTranscript }: LiveFeedbackInput): LiveFeedbackState {
  const [state, setState] = useState<LiveFeedbackState>(IDLE_STATE);

  // Latest transcript text, read once per second without restarting the timers.
  const transcriptRef = useRef({ finalTranscript, interimTranscript });
  useEffect(() => {
    transcriptRef.current = { finalTranscript, interimTranscript };
  });

  useEffect(() => {
    if (!isRecording) return;

    let cancelled = false;
    const startedAt = Date.now();
    const levelSamples: LevelSample[] = [];
    const wordSamples: WordSample[] = [];
    let wordsSeen = 0;
    let volumeAvailable = false;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let sampleTimer: number | null = null;
    const volumeSteady = new SteadyWarning<VolumeWarning>();
    const paceSteady = new SteadyWarning<PaceWarning>();

    // ---- Volume: measure the mic level ~10 times a second ----
    async function startVolume() {
      if (!ENABLE_VOLUME_WARNINGS || !navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") return;
      try {
        // Turn off automatic gain so a quiet voice really reads as quiet.
        const media = await navigator.mediaDevices.getUserMedia({
          audio: { autoGainControl: false, noiseSuppression: false, echoCancellation: false },
        });
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        audioContext.createMediaStreamSource(media).connect(analyser);
        const buffer = new Float32Array(analyser.fftSize);

        sampleTimer = window.setInterval(() => {
          analyser.getFloatTimeDomainData(buffer);
          let sumSquares = 0;
          let peak = 0;
          for (const value of buffer) {
            sumSquares += value * value;
            peak = Math.max(peak, Math.abs(value));
          }
          const now = Date.now();
          levelSamples.push({ time: now, db: toDb(Math.sqrt(sumSquares / buffer.length)), peak });
          while (levelSamples.length > 0 && now - levelSamples[0].time > QUIET_WINDOW_MS) levelSamples.shift();
        }, VOLUME_SAMPLE_MS);
        volumeAvailable = true;
      } catch {
        // Mic level can't be read (permission, no device, unsupported): quietly hide the volume part.
        volumeAvailable = false;
      }
    }
    void startVolume();

    // ---- Once a second: decide what to show ----
    const updateTimer = window.setInterval(() => {
      const now = Date.now();

      // Volume
      let inputLevel = 0;
      let volumeWarning: VolumeWarning | null = null;
      if (volumeAvailable) {
        const lastSecond = levelSamples.filter((s) => now - s.time <= UPDATE_MS);
        const averageDb = lastSecond.length > 0 ? lastSecond.reduce((sum, s) => sum + s.db, 0) / lastSecond.length : -100;
        inputLevel = Math.min(1, Math.max(0, (averageDb - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB)));
        const rawVolume = decideVolume(levelSamples, now);
        volumeWarning = volumeSteady.update(rawVolume, now);
        if (DEBUG_LOG_LEVELS && lastSecond.length > 0) {
          const dbs = lastSecond.map((s) => s.db);
          const speaking = lastSecond.filter((s) => s.db >= NOISE_FLOOR_DB).length;
          console.log(
            `[live-feedback] avg ${averageDb.toFixed(1)} dB | min ${Math.min(...dbs).toFixed(1)} | max ${Math.max(...dbs).toFixed(1)} | ` +
              `peak ${Math.max(...lastSecond.map((s) => s.peak)).toFixed(2)} | counted as speech ${speaking}/${lastSecond.length} | ` +
              `decision ${rawVolume ?? "ok"} | shown ${volumeWarning ?? "none"}`,
          );
        }
      }

      // Pace: words seen so far (never goes down when interim text is revised)
      const { finalTranscript: final, interimTranscript: interim } = transcriptRef.current;
      wordsSeen = Math.max(wordsSeen, countWords(final) + countWords(interim));
      wordSamples.push({ time: now, words: wordsSeen });
      while (wordSamples.length > 1 && now - wordSamples[1].time >= PACE_WINDOW_MS) wordSamples.shift();

      let wordsPerMinute: number | null = null;
      let rawPace: PaceWarning | null = null;
      if (now - startedAt >= PACE_WARMUP_MS) {
        const oldest = wordSamples[0];
        const minutes = (now - oldest.time) / 60_000;
        wordsPerMinute = minutes > 0 ? Math.round((wordsSeen - oldest.words) / minutes) : null;
        if (wordsPerMinute !== null) {
          if (wordsPerMinute > TOO_FAST_WPM) rawPace = "fast";
          else if (wordsPerMinute < TOO_SLOW_WPM && !(volumeAvailable && isPausing(levelSamples, now))) rawPace = "slow";
        }
      }
      const paceWarning = paceSteady.update(rawPace, now);

      setState({
        volumeAvailable,
        inputLevel,
        volumeWarning: volumeWarning ? VOLUME_MESSAGES[volumeWarning] : null,
        wordsPerMinute,
        paceWarning: paceWarning ? PACE_MESSAGES[paceWarning] : null,
      });
    }, UPDATE_MS);

    // ---- Clean up: release the mic and close the audio when recording stops or the screen closes ----
    return () => {
      cancelled = true;
      window.clearInterval(updateTimer);
      if (sampleTimer !== null) window.clearInterval(sampleTimer);
      stream?.getTracks().forEach((track) => track.stop());
      void audioContext?.close();
      setState(IDLE_STATE);
    };
  }, [isRecording]);

  return state;
}
