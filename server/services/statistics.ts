export interface SpeechStatistics {
  durationSeconds: number;
  wordCount: number;
  wordsPerMinute: number;
  fillerWords: Record<string, number>;
}

/**
 * Counts whitespace-separated tokens as words. Filler counts use only clear
 * disfluencies so context-dependent words such as "like" and "so" are not
 * misclassified.
 */
export function calculateSpeechStatistics(
  transcript: string,
  durationSeconds: number,
): SpeechStatistics {
  const words = transcript.trim().match(/\S+/g) ?? [];
  const validDuration = Number.isFinite(durationSeconds) && durationSeconds > 0;
  const normalizedDuration = validDuration ? durationSeconds : 0;
  const fillerWords: Record<string, number> = {};

  for (const match of transcript.matchAll(/\b(um|uh|erm|er)\b/gi)) {
    const filler = match[1].toLowerCase();
    fillerWords[filler] = (fillerWords[filler] ?? 0) + 1;
  }

  return {
    durationSeconds: normalizedDuration,
    wordCount: words.length,
    wordsPerMinute:
      normalizedDuration > 0
        ? words.length / (normalizedDuration / 60)
        : 0,
    fillerWords,
  };
}
