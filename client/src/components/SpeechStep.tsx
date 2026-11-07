import { ArrowRight, FileText, RotateCcw, Sheet, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import type { CsvCell, CsvData, SpeechDraft } from "../types";
import { countWords, formatTime } from "../utils/format";
import { CSV_ACCEPT_ATTRIBUTE, readCsvFile } from "../utils/readCsvFile";
import { ACCEPT_ATTRIBUTE, formatFileSize, readSpeechFile } from "../utils/readSpeechFile";
import FileDropZone from "./FileDropZone";

const SPEAKING_WORDS_PER_MINUTE = 140; // for the estimated speaking time
const SAMPLE_ROWS_SENT = 200; // must match readCsvFile.ts

const SPEECH_TIPS = [
  "Write how you speak. Short sentences are easier to say out loud.",
  "Most speeches land best at 130–160 words per minute.",
  "Break a long speech into short paragraphs.",
];

/** A file that was read successfully but is waiting for "Replace?" to be answered. */
interface PendingFile {
  text: string;
  titleFromName: string;
  name: string;
  sizeBytes: number;
}

interface SpeechStepProps {
  /** The speech, kept in App.tsx so it survives moving between steps. */
  speech: SpeechDraft;
  onSpeechChange: Dispatch<SetStateAction<SpeechDraft>>;
  /** The uploaded CSV data file, also kept in App.tsx (Practise can regenerate from it). */
  csvData: CsvData | null;
  onCsvDataChange: (data: CsvData | null) => void;
  /** Turns the CSV into a speech (server side) and puts it into the speech. Resolves true on success. */
  onGenerateFromCsv: () => Promise<boolean>;
  isGeneratingFromCsv: boolean;
  csvGenerateError: string | null;
  onContinue: () => void;
  onSkip: () => void;
}

/** "Quarterly Sales.csv" → "Quarterly Sales" */
function nameWithoutExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

function displayCell(value: CsvCell): string {
  return value === null ? "" : String(value);
}

/**
 * Step 1: type or paste the speech, upload a speech document, OR upload a CSV
 * data file that our server turns into a speech. Only one upload at a time.
 */
export default function SpeechStep({
  speech,
  onSpeechChange,
  csvData,
  onCsvDataChange,
  onGenerateFromCsv,
  isGeneratingFromCsv,
  csvGenerateError,
  onContinue,
  onSkip,
}: SpeechStepProps) {
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  // Name of the file being read (null when not reading). PDFs can take a moment.
  const [readingFileName, setReadingFileName] = useState<string | null>(null);
  const isReading = readingFileName !== null;
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceButtonRef = useRef<HTMLButtonElement>(null);
  const speechTextRef = useRef<HTMLTextAreaElement>(null);

  // ---- CSV data upload ----
  const [csvReadError, setCsvReadError] = useState<string | null>(null);
  const [isReadingCsv, setIsReadingCsv] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Only one upload can be active: a speech document OR a CSV data file.
  const speechUploadLocked = speech.source === "csv";
  const csvUploadLocked = speech.source === "document";

  const wordCount = countWords(speech.text);
  const speakingSeconds = (wordCount / SPEAKING_WORDS_PER_MINUTE) * 60;
  const hasText = speech.text.trim() !== "";
  const hasGeneratedFromCsv = speech.source === "csv" && hasText;

  // A file dropped outside the drop zones would make the browser open it and
  // leave the app (losing work), so ignore drops anywhere else on this page.
  useEffect(() => {
    // (Only for files; dragging text into the textarea still works.)
    const preventDefault = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    };
    window.addEventListener("dragover", preventDefault);
    window.addEventListener("drop", preventDefault);
    return () => {
      window.removeEventListener("dragover", preventDefault);
      window.removeEventListener("drop", preventDefault);
    };
  }, []);

  // When the "Replace your current speech?" question appears, move focus to it.
  useEffect(() => {
    if (pendingFile) replaceButtonRef.current?.focus();
  }, [pendingFile]);

  // ---------------- Speech document upload (unchanged behaviour) ----------------

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  /** Put the file's text into the speech (and use its name as the title if empty). */
  function applyFile(file: PendingFile) {
    onSpeechChange((current) => ({
      title: current.title.trim() ? current.title : file.titleFromName,
      text: file.text,
      file: { name: file.name, sizeBytes: file.sizeBytes },
      source: "document",
    }));
    setPendingFile(null);
    setCsvReadError(null); // a leftover CSV error no longer applies
    setStatusMessage(`Loaded ${file.name} into "Your speech". You can edit it below.`);
  }

  async function handleFile(file: File) {
    if (speechUploadLocked) return;
    setError(null);
    setStatusMessage("");
    setPendingFile(null);
    if (file.name.toLowerCase().endsWith(".csv")) {
      setError('That\'s a data file. To turn data into a speech, use "Upload data (.csv)" below.');
      return;
    }
    setReadingFileName(file.name);
    const result = await readSpeechFile(file);
    setReadingFileName(null);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    const loaded: PendingFile = {
      text: result.text,
      titleFromName: result.titleFromName,
      name: file.name,
      sizeBytes: file.size,
    };
    if (speech.text.trim()) {
      setPendingFile(loaded); // ask before replacing what's already there
    } else {
      applyFile(loaded);
    }
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // so choosing the same file again still works
    if (file) void handleFile(file);
  }

  function keepCurrentSpeech() {
    setPendingFile(null);
    setStatusMessage("Kept your current speech.");
  }

  function removeFileCard() {
    onSpeechChange((current) => ({
      ...current,
      file: null,
      source: current.source === "document" ? null : current.source,
    }));
    setStatusMessage("File removed. Your speech text is unchanged. You can now upload data instead.");
  }

  // ---------------- CSV data upload ----------------

  function openCsvPicker() {
    csvInputRef.current?.click();
  }

  async function handleCsvFile(file: File) {
    if (csvUploadLocked || isReadingCsv) return;
    setCsvReadError(null);
    setStatusMessage("");
    setIsReadingCsv(true);
    const result = await readCsvFile(file);
    setIsReadingCsv(false);
    if (!result.ok) {
      setCsvReadError(result.message);
      return;
    }
    onCsvDataChange(result.data);
    setError(null); // a leftover speech-upload error no longer applies
    onSpeechChange((current) => ({
      ...current,
      title: current.title.trim() ? current.title : nameWithoutExtension(file.name),
      file: null,
      source: "csv",
    }));
    setStatusMessage(`Loaded ${file.name}. Check the preview, then turn it into a speech.`);
  }

  function handleCsvInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void handleCsvFile(file);
  }

  function removeCsv() {
    onCsvDataChange(null);
    onSpeechChange((current) => ({ ...current, source: current.source === "csv" ? null : current.source }));
    setCsvReadError(null);
    setStatusMessage("Data file removed. Your speech text is unchanged. You can now upload a speech instead.");
  }

  async function generateFromCsv() {
    if (isGeneratingFromCsv) return; // no double submissions
    setStatusMessage("Turning your data into a speech…");
    const ok = await onGenerateFromCsv();
    if (ok) {
      setStatusMessage('Your speech is ready in "Your speech" above. You can edit it there.');
      speechTextRef.current?.focus();
      speechTextRef.current?.scrollIntoView({ block: "center" });
    } else {
      setStatusMessage("");
    }
  }

  return (
    <div className="speech-layout">
      {/* ---------- Left: title, speech text and uploads ---------- */}
      <section className="card speech-card" aria-label="Your speech">
        <div className="field">
          <label htmlFor="speech-title">Speech title (optional)</label>
          <input
            id="speech-title"
            type="text"
            value={speech.title}
            maxLength={500}
            onChange={(e) => onSpeechChange((current) => ({ ...current, title: e.target.value }))}
          />
        </div>

        <div className="field">
          <label htmlFor="speech-text">Your speech</label>
          <textarea
            id="speech-text"
            ref={speechTextRef}
            className="speech-textarea"
            rows={14}
            value={speech.text}
            onChange={(e) => onSpeechChange((current) => ({ ...current, text: e.target.value }))}
            aria-describedby="speech-stats"
          />
          <ul id="speech-stats" className="chip-row speech-stats" aria-label="Speech length">
            <li className="chip">
              {wordCount} {wordCount === 1 ? "word" : "words"}
            </li>
            <li className="chip">~{formatTime(speakingSeconds)} speaking time</li>
          </ul>
        </div>

        <p className="visually-hidden" role="status">
          {isReading ? `Reading ${readingFileName}…` : isReadingCsv ? "Reading CSV file…" : statusMessage}
        </p>

        {/* Stacked: upload a speech, — or —, upload data, then Continue and Skip */}
        <div className="speech-actions">
          {/* ---------- 1. Upload your speech ---------- */}
          <section className="drop-cell" aria-labelledby="upload-speech-heading">
            <h2 id="upload-speech-heading" className="card-heading-small">
              Upload your speech
            </h2>
            <FileDropZone
              onFile={(file) => void handleFile(file)}
              onBrowse={openFilePicker}
              disabled={isReading || speechUploadLocked}
              describedBy={speechUploadLocked ? "speech-locked-note" : error ? "upload-error" : undefined}
            />

            {speechUploadLocked && (
              <p id="speech-locked-note" className="hint locked-note">
                You've uploaded data. Remove it to upload a speech instead.
              </p>
            )}
            {error && (
              <p id="upload-error" className="message message-error upload-message" role="alert">
                {error}
              </p>
            )}
            {isReading && (
              <p className="hint reading-note">
                Reading {readingFileName}…
                {readingFileName?.toLowerCase().endsWith(".pdf") && " Large PDFs can take a moment."}
              </p>
            )}

            {pendingFile && (
              <div className="replace-box" role="group" aria-labelledby="replace-heading">
                <p id="replace-heading" className="replace-title">
                  Replace your current speech?
                </p>
                <p className="hint">
                  The text in "Your speech" will be replaced with the text from{" "}
                  <strong>{pendingFile.name}</strong>.
                </p>
                <div className="replace-actions">
                  <button
                    ref={replaceButtonRef}
                    type="button"
                    className="button-primary"
                    onClick={() => applyFile(pendingFile)}
                  >
                    Replace
                  </button>
                  <button type="button" className="button-secondary" onClick={keepCurrentSpeech}>
                    Keep my speech
                  </button>
                </div>
              </div>
            )}
          </section>

          <p className="or-divider" aria-hidden="true">
            — or —
          </p>

          {/* ---------- 2. Upload data (.csv) ---------- */}
          <section className="csv-section" aria-labelledby="csv-heading">
            <h2 id="csv-heading" className="card-heading-small">
              Upload data (.csv)
            </h2>
            <p className="hint csv-intro">We'll turn your data into a short spoken presentation.</p>

            {csvUploadLocked && (
              <p id="csv-locked-note" className="hint locked-note">
                You've uploaded a speech. Remove it to upload data instead.
              </p>
            )}

            {!csvData && (
              <FileDropZone
                onFile={(file) => void handleCsvFile(file)}
                onBrowse={openCsvPicker}
                disabled={csvUploadLocked || isReadingCsv}
                describedBy={csvUploadLocked ? "csv-locked-note" : csvReadError ? "csv-error" : undefined}
                title="Drop a CSV file here"
                hint=".csv · up to 1 MB"
              />
            )}
            {isReadingCsv && <p className="hint reading-note">Reading CSV file…</p>}
            {csvReadError && (
              <p id="csv-error" className="message message-error upload-message" role="alert">
                {csvReadError}
              </p>
            )}

            {csvData && (
              <div className="csv-card">
                <div className="csv-card-top">
                  <span className="file-card-icon" aria-hidden="true">
                    <Sheet size={20} />
                  </span>
                  <div className="file-card-text">
                    <p className="file-card-name">{csvData.fileName}</p>
                    <p className="file-card-meta">
                      {csvData.rowCount.toLocaleString("en-GB")} {csvData.rowCount === 1 ? "row" : "rows"} ·{" "}
                      {csvData.columnCount} {csvData.columnCount === 1 ? "column" : "columns"} ·{" "}
                      {formatFileSize(csvData.sizeBytes)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={removeCsv}
                    disabled={isGeneratingFromCsv}
                    aria-label="Remove data file"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>

                <div className="table-scroll">
                  <table className="csv-preview">
                    <caption>
                      First {csvData.previewRows.length} {csvData.previewRows.length === 1 ? "row" : "rows"} of{" "}
                      {csvData.fileName}
                    </caption>
                    <thead>
                      <tr>
                        {csvData.request.columns.map((column, index) => (
                          <th key={index} scope="col">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.previewRows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {csvData.request.columns.map((_, columnIndex) => (
                            <td key={columnIndex}>{displayCell(row[columnIndex] ?? null)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {csvData.rowCount > SAMPLE_ROWS_SENT && (
                  <p className="hint">
                    This file has {csvData.rowCount.toLocaleString("en-GB")} rows. We'll use summaries of every
                    column plus the first {SAMPLE_ROWS_SENT} rows.
                  </p>
                )}
                {hasText && !hasGeneratedFromCsv && (
                  <p className="hint">This replaces the text in "Your speech".</p>
                )}

                <div className="csv-actions">
                  <button
                    type="button"
                    className={hasGeneratedFromCsv ? "button-secondary" : "button-primary"}
                    onClick={() => void generateFromCsv()}
                    disabled={isGeneratingFromCsv}
                  >
                    {hasGeneratedFromCsv && !isGeneratingFromCsv && <RotateCcw size={16} aria-hidden="true" />}
                    {isGeneratingFromCsv
                      ? "Turning your data into a speech…"
                      : hasGeneratedFromCsv
                        ? "Regenerate speech"
                        : "Turn this data into a speech"}
                  </button>
                </div>

                {csvGenerateError && (
                  <div className="message message-error csv-generate-error" role="alert">
                    {csvGenerateError}{" "}
                    <button
                      type="button"
                      className="link-button inline-link"
                      onClick={() => void generateFromCsv()}
                      disabled={isGeneratingFromCsv}
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          <div className="continue-group">
            <button type="button" className="button-primary continue-button" onClick={onContinue} disabled={!hasText}>
              Continue
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <button type="button" className="link-button skip-link" onClick={onSkip}>
              Skip this step
            </button>
          </div>
        </div>

        {/* Hidden file pickers: speech documents (drop zone + Upload Document) and CSV data */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={handleFileInputChange}
        />
        <input
          ref={csvInputRef}
          type="file"
          accept={CSV_ACCEPT_ATTRIBUTE}
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={handleCsvInputChange}
        />
      </section>

      {/* ---------- Right: Upload Document, file card, tips ---------- */}
      <div className="speech-side">
        <button
          type="button"
          className="button-secondary upload-button-wide"
          onClick={openFilePicker}
          disabled={isReading || speechUploadLocked}
          aria-describedby={speechUploadLocked ? "speech-locked-note" : undefined}
        >
          <Upload size={16} aria-hidden="true" />
          Upload Document
        </button>

        {speech.file && (
          <div className="file-card">
            <span className="file-card-icon" aria-hidden="true">
              <FileText size={20} />
            </span>
            <div className="file-card-text">
              <p className="file-card-name">{speech.file.name}</p>
              <p className="file-card-meta">Uploaded · {formatFileSize(speech.file.sizeBytes)}</p>
            </div>
            <button type="button" className="icon-button" onClick={removeFileCard} aria-label="Remove file">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        )}

        <aside className="card tips-white" aria-labelledby="speech-tips-heading">
          <h2 id="speech-tips-heading">Quick tips</h2>
          <ul className="tips-list">
            {SPEECH_TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
