export interface SpeechStatistics {
  durationSeconds: number;
  wordCount: number;
  wordsPerMinute: number;
  fillerWords: Record<string, number>;
}

// Two-word filler phrases, counted before single words so no word counts twice.
const FILLER_PHRASES = new Set([
  "you know",
  "i mean",
  "kind of",
  "sort of",
  "you see",
  "or something",
  "and stuff",
]);
// Chrome's speech recognition usually strips um/uh; they still count in typed text.
const FILLER_WORDS = new Set([
  "um", "uh", "erm", "er",
  "basically", "literally", "actually", "honestly", "totally", "anyway",
]);
// "what kind of car", "a sort of" are descriptions, not fillers.
const NOT_FILLER_BEFORE_KIND_OF = new Set([
  "what", "which", "this", "that", "a", "the", "some", "any", "every", "same", "different", "other", "no",
]);
// "do you know the answer" is a question, not a filler.
const NOT_FILLER_BEFORE_YOU_KNOW = new Set(["do", "did", "don't", "didn't", "if", "as", "would"]);
// "I like", "feel like", "looks like" are verbs or comparisons, not fillers.
const NOT_FILLER_BEFORE_LIKE = new Set([
  "i", "you", "we", "they", "would", "don't", "do", "feel", "looks", "look", "seems", "sounds", "just",
]);
// Deliberately never counted (too many false positives without punctuation):
// so, right, well, just, really, okay.

function countFillerWords(transcript: string): Record<string, number> {
  const tokens = transcript.toLowerCase().replace(/’/g, "'").match(/[\p{L}\p{N}']+/gu) ?? [];
  const fillerWords: Record<string, number> = {};
  const add = (filler: string) => {
    fillerWords[filler] = (fillerWords[filler] ?? 0) + 1;
  };

  for (let i = 0; i < tokens.length; i++) {
    const previous = tokens[i - 1] ?? "";
    const word = tokens[i];
    const phrase = `${word} ${tokens[i + 1] ?? ""}`;

    if (FILLER_PHRASES.has(phrase)) {
      const excluded =
        ((phrase === "kind of" || phrase === "sort of") && NOT_FILLER_BEFORE_KIND_OF.has(previous)) ||
        (phrase === "you know" && NOT_FILLER_BEFORE_YOU_KNOW.has(previous));
      if (!excluded) {
        add(phrase);
        i++; // skip the phrase's second word
        continue;
      }
    }

    if (FILLER_WORDS.has(word)) {
      add(word);
    } else if (word === "like" && !NOT_FILLER_BEFORE_LIKE.has(previous) && tokens[i + 1] !== "a") {
      add(word);
    }
  }

  return fillerWords;
}

/**
 * Counts whitespace-separated tokens as words. Filler counts are
 * case-insensitive whole-word estimates; see countFillerWords for the
 * selected phrases, words, and context exclusions.
 */
export function calculateSpeechStatistics(
  transcript: string,
  durationSeconds: number,
): SpeechStatistics {
  const words = transcript.trim().match(/\S+/g) ?? [];
  const validDuration = Number.isFinite(durationSeconds) && durationSeconds > 0;
  const normalizedDuration = validDuration ? durationSeconds : 0;
  const fillerWords = countFillerWords(transcript);

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
