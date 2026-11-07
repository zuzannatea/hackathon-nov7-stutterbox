import { FileUp } from "lucide-react";
import { useState, type DragEvent } from "react";

interface FileDropZoneProps {
  /** Called with the file the user dropped. */
  onFile: (file: File) => void;
  /** Opens the file picker (on click, Enter or Space). */
  onBrowse: () => void;
  disabled?: boolean;
  /** id of an error message to link for screen readers. */
  describedBy?: string;
  /** Main text and the small hint under it (defaults are for speech documents). */
  title?: string;
  hint?: string;
}

/**
 * Dashed area you can drop a file onto. It's a real <button>, so clicking it,
 * Enter and Space all open the file picker for keyboard users.
 */
export default function FileDropZone({
  onFile,
  onBrowse,
  disabled = false,
  describedBy,
  title = "Drop a file here",
  hint = ".txt, .docx or .pdf · up to 10 MB",
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  function handleDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault(); // needed so the browser allows dropping here
    if (!disabled) setIsDragging(true);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault(); // stop the browser opening the file itself
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && !disabled) onFile(file);
  }

  return (
    <button
      type="button"
      className={`drop-zone ${isDragging ? "drop-zone-active" : ""}`}
      onClick={onBrowse}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      disabled={disabled}
      aria-describedby={describedBy}
    >
      <span className="drop-zone-icon" aria-hidden="true">
        <FileUp size={20} />
      </span>
      <span className="drop-zone-text">
        <span className="drop-zone-title">{isDragging ? "Drop to upload" : title}</span>
        <span className="drop-zone-hint">{hint}</span>
      </span>
    </button>
  );
}
