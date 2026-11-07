// Reads a speech document in the browser. Nothing is uploaded to the server.

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ACCEPTED_EXTENSIONS = [".txt", ".docx", ".pdf"];
const PDF_MIME_TYPE = "application/pdf";

/** For the file picker's `accept` attribute. */
export const ACCEPT_ATTRIBUTE =
  ".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,application/pdf";

const WRONG_TYPE_MESSAGE = "Please upload a .txt, .docx or .pdf file, or paste your speech.";
const SCANNED_PDF_MESSAGE =
  "This PDF looks like a scanned image, so there's no text to read. Try a text-based PDF or paste the speech instead.";
// A PDF with fewer letters than this is treated as "no real text" (e.g. a scan with a page number).
const MIN_PDF_LETTERS = 20;

export type ReadFileResult =
  | { ok: true; text: string; titleFromName: string }
  | { ok: false; message: string };

/** "My Speech.docx" → "My Speech" */
function nameWithoutExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/** Turns 24_576 bytes into "24 KB", 2_400_000 into "2.3 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Tidies extracted text: consistent line endings, no runs of blank lines. */
function tidyText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Reads a plain-text file with the browser's built-in FileReader. */
function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsText(file);
  });
}

/** Extracts the plain text from a Word .docx file using mammoth. */
async function readDocxFile(file: File): Promise<string> {
  // Loaded only when someone uploads a .docx, so the rest of the app stays fast.
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

/** Extracts the text from a PDF using pdf.js (see readPdfText.ts). */
async function readPdfFile(file: File): Promise<string> {
  // Loaded only when someone uploads a PDF, so the rest of the app stays fast.
  const { readPdfText } = await import("./readPdfText");
  return readPdfText(file);
}

/** A friendly message for a PDF that pdf.js couldn't open. */
function pdfErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "PasswordException") {
    return "This PDF is password-protected. Remove the password, or paste your speech instead.";
  }
  return "We couldn't read this PDF. It may be damaged. Try another file, or paste your speech.";
}

/** Checks a file's type and size, then reads its text. */
export async function readSpeechFile(file: File): Promise<ReadFileResult> {
  const lowerName = file.name.toLowerCase();
  const isPdf = file.type === PDF_MIME_TYPE || lowerName.endsWith(".pdf");
  const extension = isPdf ? ".pdf" : ACCEPTED_EXTENSIONS.find((ext) => lowerName.endsWith(ext));

  if (!extension) {
    return { ok: false, message: WRONG_TYPE_MESSAGE };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      message: `This file is ${formatFileSize(file.size)}. Please upload a file of 10 MB or less, or paste your speech.`,
    };
  }
  if (file.size === 0) {
    return { ok: false, message: "This file is empty. Please choose another file, or paste your speech." };
  }

  let rawText: string;
  if (extension === ".pdf") {
    try {
      rawText = await readPdfFile(file);
    } catch (error) {
      return { ok: false, message: pdfErrorMessage(error) };
    }
    // Scanned PDFs are pictures of text: pdf.js finds little or no real text in them.
    if ((rawText.match(/\p{L}/gu) ?? []).length < MIN_PDF_LETTERS) {
      return { ok: false, message: SCANNED_PDF_MESSAGE };
    }
  } else {
    try {
      rawText = extension === ".txt" ? await readTextFile(file) : await readDocxFile(file);
    } catch {
      return {
        ok: false,
        message: "We couldn't read this file. It may be damaged or password-protected. Try another file, or paste your speech.",
      };
    }
  }

  const text = tidyText(rawText);
  if (text === "") {
    return {
      ok: false,
      message: "We couldn't find any text in this file. Please choose another file, or paste your speech.",
    };
  }

  return { ok: true, text, titleFromName: nameWithoutExtension(file.name) };
}
