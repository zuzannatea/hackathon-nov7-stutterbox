const MAX_WORDS_PER_LINE = 12;

/**
 * Splits a speech into short lines for the Practice-mode teleprompter:
 * first by paragraph/line break, then by sentence (. ! ? …), and any sentence
 * longer than 12 words into roughly equal chunks (e.g. 20 words → 10 + 10).
 */
export function splitSpeechLines(text: string): string[] {
  const lines: string[] = [];

  for (const paragraph of text.split(/\n+/)) {
    // A sentence = text up to and including . ! ? or … (plus any closing quote/bracket),
    // or whatever is left at the end without punctuation.
    const sentences = paragraph.match(/[^.!?…]+[.!?…]+["'”’)\]]*|[^.!?…]+$/g) ?? [];

    for (const sentence of sentences) {
      const words = sentence.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) continue;

      const chunkCount = Math.ceil(words.length / MAX_WORDS_PER_LINE);
      const chunkSize = Math.ceil(words.length / chunkCount);
      for (let start = 0; start < words.length; start += chunkSize) {
        lines.push(words.slice(start, start + chunkSize).join(" "));
      }
    }
  }

  return lines;
}
