import { ArrowRight, FileText, RotateCcw, Sparkles, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import type { SpeechDraft } from "../types";
import { countWords, formatTime } from "../utils/format";
import { MAX_SPEECH_BRIEF_LENGTH, requestGeneratedSpeech } from "../services/generateSpeechApi";
import { ACCEPT_ATTRIBUTE, formatFileSize, readSpeechFile } from "../utils/readSpeechFile";
import FileDropZone from "./FileDropZone";

const SPEAKING_WORDS_PER_MINUTE = 140; // for the estimated speaking time

const BRIEF_PLACEHOLDER =
  "A 2-minute speech for my team's hackathon demo. Our app Stutterbox helps people practise speeches with a live transcript. Friendly tone, mention that we built it in one day.";

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

/**
 * Step 1: type, paste, upload or generate the speech. The speech itself stays in
 * the browser; only a "Generate" description is sent to our server.
 */
export default function SpeechStep({ speech, onSpeechChange, onContinue, onSkip }: SpeechStepProps) {
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  // Name of the file being read (null when not reading). PDFs can take a moment.
  const [readingFileName, setReadingFileName] = useState<string | null>(null);
  const isReading = readingFileName !== null;
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceButtonRef = useRef<HTMLButtonElement>(null);

  // ---- "Generate a speech" ----
  const [brief, setBrief] = useState(""); // what the user wants the speech to be based on
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null); // generated text, editable before use
  const generateAbortRef = useRef<AbortController | null>(null);
  const speechTextRef = useRef<HTMLTextAreaElement>(null);

  // Upload and Generate can't both be active.
  const uploadLocked = speech.source === "generated";
  const generateLocked = speech.source === "upload";

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

  // Cancel a generation request still in flight if the user leaves this step.
  useEffect(() => () => generateAbortRef.current?.abort(), []);

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
      source: "upload",
    }));
    setPendingFile(null);
    setStatusMessage(`Loaded ${file.name} into "Your speech". You can edit it below.`);
  }

  async function handleFile(file: File) {
    setError(null);
    setStatusMessage("");
    setPendingFile(null);
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
    onSpeechChange((current) => ({ ...current, file: null, source: current.source === "upload" ? null : current.source }));
    setStatusMessage("File removed. Your speech text is unchanged. You can now generate a speech instead.");
  }

  /** Asks the server to write a speech. Guarded so it can't be sent twice at once. */
  async function generate() {
    if (isGenerating || generateLocked || !brief.trim()) return;
    const controller = new AbortController();
    generateAbortRef.current = controller;
    setIsGenerating(true);
    setGenerateError(null);
    setStatusMessage("Writing your speech…");
    try {
      const text = await requestGeneratedSpeech(brief.trim(), controller.signal);
      setPreview(text);
      setStatusMessage("Your speech is ready to review below.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return; // left the page
      setGenerateError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setStatusMessage("");
    } finally {
      if (generateAbortRef.current === controller) generateAbortRef.current = null;
      setIsGenerating(false);
    }
  }

  /** Puts the generated text into "Your speech", exactly like an uploaded document. */
  function applyGeneratedSpeech() {
    if (preview === null || !preview.trim()) return;
    const text = preview.trim();
    onSpeechChange((current) => ({ ...current, text, file: null, source: "generated" }));
    setPreview(null);
    setStatusMessage('Your generated speech is now in "Your speech". You can edit it there.');
    speechTextRef.current?.focus();
    speechTextRef.current?.scrollIntoView({ block: "center" });
  }

  function removeGeneratedSpeech() {
    onSpeechChange((current) => ({ ...current, text: "", source: null }));
    setStatusMessage("Generated speech removed. You can now upload a document instead.");
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

        {/* Stacked: drop zone (full width), then Continue, then Skip */}
        <div className="speech-actions">
          <div className="drop-cell">
            <FileDropZone
              onFile={(file) => void handleFile(file)}
              onBrowse={openFilePicker}
              disabled={isReading || uploadLocked}
              describedBy={uploadLocked ? "upload-locked-note" : error ? "upload-error" : undefined}
            />

            {uploadLocked && (
              <p id="upload-locked-note" className="hint locked-note">
                You've generated a speech. Remove it to upload a document instead.{" "}
                <button type="button" className="link-button inline-link" onClick={removeGeneratedSpeech}>
                  Remove generated speech
                </button>
              </p>
            )}

            {error && (
              <p id="upload-error" className="message message-error upload-message" role="alert">
                {error}
              </p>
            )}
            <p className="visually-hidden" role="status">
              {isReading ? `Reading ${readingFileName}…` : statusMessage}
            </p>
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
          </div>

          {/* ---------- Generate a speech ---------- */}
          <p className="or-divider" aria-hidden="true">
            — or —
          </p>
          <section className="generate-section" aria-labelledby="generate-heading">
            <h2 id="generate-heading" className="card-heading-small">
              No speech yet? Describe it and we'll write one.
            </h2>
            <label htmlFor="speech-brief" className="visually-hidden">
              Describe the speech you need
            </label>
            <textarea
              id="speech-brief"
              rows={5}
              value={brief}
              maxLength={MAX_SPEECH_BRIEF_LENGTH}
              placeholder={BRIEF_PLACEHOLDER}
              onChange={(e) => setBrief(e.target.value)}
              disabled={generateLocked || isGenerating}
              aria-describedby={generateLocked ? "generate-locked-note brief-count" : "brief-hint brief-count"}
            />
            <div className="brief-meta">
              <p id="brief-hint" className="hint">
                Topic, occasion, audience, length, tone, facts, names, stories or key points.
              </p>
              <p id="brief-count" className="hint brief-count">
                {brief.length.toLocaleString("en-GB")} / {MAX_SPEECH_BRIEF_LENGTH.toLocaleString("en-GB")}
              </p>
            </div>
            {generateLocked && (
              <p id="generate-locked-note" className="hint locked-note">
                You've uploaded a speech. Remove it to generate one instead.
              </p>
            )}

            <button
              type="button"
              className="button-secondary"
              onClick={() => void generate()}
              disabled={generateLocked || isGenerating || !brief.trim()}
            >
              <Sparkles size={16} aria-hidden="true" />
              {isGenerating ? "Writing your speech…" : "Generate speech"}
            </button>

            {generateError && (
              <div className="message message-error generate-error" role="alert">
                {generateError}{" "}
                <button type="button" className="link-button inline-link" onClick={() => void generate()}>
                  Try again
                </button>
              </div>
            )}

            {preview !== null && (
              <div className="generated-preview">
                <label htmlFor="generated-preview" className="generated-preview-label">
                  Your generated speech (you can edit it)
                </label>
                <textarea
                  id="generated-preview"
                  rows={12}
                  value={preview}
                  onChange={(e) => setPreview(e.target.value)}
                  disabled={isGenerating}
                />
                {hasText && (
                  <p className="hint">Using it replaces the text in "Your speech".</p>
                )}
                <div className="generated-actions">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => void generate()}
                    disabled={isGenerating || !brief.trim()}
                  >
                    <RotateCcw size={16} aria-hidden="true" />
                    Regenerate
                  </button>
                  <button
                    type="button"
                    className="button-primary"
                    onClick={applyGeneratedSpeech}
                    disabled={isGenerating || !preview.trim()}
                  >
                    Use this speech
                  </button>
                </div>
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
          disabled={isReading || uploadLocked}
          aria-describedby={uploadLocked ? "upload-locked-note" : undefined}
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
