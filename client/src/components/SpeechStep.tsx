import { ArrowRight, FileText, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import type { SpeechDraft } from "../types";
import { countWords, formatTime } from "../utils/format";
import { ACCEPT_ATTRIBUTE, formatFileSize, readSpeechFile } from "../utils/readSpeechFile";
import FileDropZone from "./FileDropZone";

const SPEAKING_WORDS_PER_MINUTE = 140; // for the estimated speaking time

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
  onContinue: () => void;
  onSkip: () => void;
}

/** Step 1: type, paste or upload the speech (frontend-only, never sent to the server). */
export default function SpeechStep({ speech, onSpeechChange, onContinue, onSkip }: SpeechStepProps) {
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceButtonRef = useRef<HTMLButtonElement>(null);

  const wordCount = countWords(speech.text);
  const speakingSeconds = (wordCount / SPEAKING_WORDS_PER_MINUTE) * 60;
  const hasText = speech.text.trim() !== "";

  // A file dropped outside the drop zone would make the browser open it and
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

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  /** Put the file's text into the speech (and use its name as the title if empty). */
  function applyFile(file: PendingFile) {
    onSpeechChange((current) => ({
      title: current.title.trim() ? current.title : file.titleFromName,
      text: file.text,
      file: { name: file.name, sizeBytes: file.sizeBytes },
    }));
    setPendingFile(null);
    setStatusMessage(`Loaded ${file.name} into "Your speech". You can edit it below.`);
  }

  async function handleFile(file: File) {
    setError(null);
    setStatusMessage("");
    setPendingFile(null);
    setIsReading(true);
    const result = await readSpeechFile(file);
    setIsReading(false);

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
    onSpeechChange((current) => ({ ...current, file: null }));
    setStatusMessage("File removed. Your speech text is unchanged.");
  }

  return (
    <div className="speech-layout">
      {/* ---------- Left: title, speech text and buttons ---------- */}
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

        {/* Stacked: drop zone (full width), then Continue, then Skip */}
        <div className="speech-actions">
          <div className="drop-cell">
            <FileDropZone
              onFile={(file) => void handleFile(file)}
              onBrowse={openFilePicker}
              disabled={isReading}
              describedBy={error ? "upload-error" : undefined}
            />

            {error && (
              <p id="upload-error" className="message message-error upload-message" role="alert">
                {error}
              </p>
            )}
            <p className="visually-hidden" role="status">
              {isReading ? "Reading file…" : statusMessage}
            </p>
            {isReading && <p className="hint reading-note">Reading file…</p>}

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
          </div>

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

        {/* One hidden file picker, opened by both "Upload Document" and the drop zone */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={handleFileInputChange}
        />
      </section>

      {/* ---------- Right: Upload Document, file card, tips ---------- */}
      <div className="speech-side">
        <button
          type="button"
          className="button-secondary upload-button-wide"
          onClick={openFilePicker}
          disabled={isReading}
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
