// Extracts plain text from a text-based PDF, entirely in the browser.
// This module is only loaded (with import()) when someone uploads a PDF,
// so pdf.js and its worker don't add to the initial bundle.

import * as pdfjsLib from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

// A vertical jump bigger than this many line-heights starts a new paragraph.
const PARAGRAPH_GAP = 1.6;

/** Lines that are only a page number: "3", "- 3 -", "Page 3", "3 of 12", "3/12". */
const PAGE_NUMBER_LINE = /^[-–—\s]*(page\s+)?\d+(\s*(of|\/)\s*\d+)?[-–—\s]*$/i;

/** Makes sure `text` ends with at least `count` line breaks (and no trailing spaces). */
function endWithBreaks(text: string, count: number): string {
  const trimmed = text.replace(/[ \t]+$/, "");
  const existing = trimmed.length - trimmed.replace(/\n+$/, "").length;
  return existing >= count ? trimmed : trimmed + "\n".repeat(count - existing);
}

/** Turns one page's text items into lines, using hasEOL and vertical jumps. */
function pageItemsToText(items: TextItem[]): string {
  let text = "";
  let lastY: number | null = null;
  let lastHeight = 0;

  for (const item of items) {
    const y = item.transform[5]; // vertical position on the page
    const lineHeight = item.height || lastHeight || 12;

    if (lastY !== null && text !== "") {
      const jump = Math.abs(lastY - y);
      if (jump > lineHeight * PARAGRAPH_GAP) text = endWithBreaks(text, 2); // big gap → new paragraph
      else if (jump > lineHeight * 0.5) text = endWithBreaks(text, 1); // next line
    }

    text += item.str;
    if (item.hasEOL) text = endWithBreaks(text, 1);

    // Empty items (often just end-of-line markers) don't tell us where text is.
    if (item.str.trim() !== "") {
      lastY = y;
      lastHeight = lineHeight;
    }
  }
  return text;
}

/** Collapses spaces, rejoins hyphenated words and drops page-number lines. */
function cleanUp(text: string): string {
  return (
    text
      // "some-\nthing" → "something" (a word split across a line break)
      .replace(/(\p{L})-\n(\p{L})/gu, "$1$2")
      .split("\n")
      .map((line) => line.replace(/[ \t ]+/g, " ").trim())
      .filter((line) => !PAGE_NUMBER_LINE.test(line))
      .join("\n")
      // at most one blank line between paragraphs
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Reads every page of a PDF and returns its text with line and paragraph breaks.
 * Throws pdf.js errors (e.g. PasswordException, InvalidPDFException) for the caller to handle.
 */
export async function readPdfText(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data });

  try {
    const pdf = await loadingTask.promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      // Keep real text items; skip "marked content" entries, which have no text.
      const items = content.items.filter((item): item is TextItem => "str" in item);
      pages.push(pageItemsToText(items));
      page.cleanup();
    }
    return cleanUp(pages.join("\n\n"));
  } finally {
    void loadingTask.destroy(); // frees the worker's memory for this document
  }
}
