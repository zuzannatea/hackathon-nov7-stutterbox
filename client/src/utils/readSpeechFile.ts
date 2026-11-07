// Reads a speech document in the browser. Nothing is uploaded to the server.

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ACCEPTED_EXTENSIONS = [".txt", ".docx"];

/** For the file picker's `accept` attribute. */
export const ACCEPT_ATTRIBUTE =
  ".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

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

/** Checks a file's type and size, then reads its text. */
export async function readSpeechFile(file: File): Promise<ReadFileResult> {
  const lowerName = file.name.toLowerCase();
  const extension = ACCEPTED_EXTENSIONS.find((ext) => lowerName.endsWith(ext));

  if (!extension) {
    return { ok: false, message: "Please upload a .txt or .docx file, or paste your speech." };
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
  try {
    rawText = extension === ".txt" ? await readTextFile(file) : await readDocxFile(file);
  } catch {
    return {
      ok: false,
      message: "We couldn't read this file. It may be damaged or password-protected. Try another file, or paste your speech.",
    };
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
