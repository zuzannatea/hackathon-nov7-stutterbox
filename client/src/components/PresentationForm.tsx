import { ArrowRight, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Presentation } from "../types";

// Limits that match the backend's validation in server/routes/analyze.ts.
// If we let something through here, the server would reject it anyway.
const MAX_TEXT_LENGTH = 500;
const MAX_KEY_POINTS = 20;

// Our own sensible limits for the demo.
const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 60;

const TONE_OPTIONS = ["Friendly", "Professional", "Persuasive", "Informative", "Inspiring"];
const OTHER_TONE = "Other";

/**
 * What the user is typing right now. This is kept separate from the final
 * `Presentation` because, while typing, the duration is still text and the
 * tone is split into "dropdown choice" + "custom text".
 */
interface FormDraft {
  title: string;
  audience: string;
  purpose: string;
  keyPoints: string[];
  duration: string;
  toneChoice: string;
  customTone: string;
}

type FieldName = "title" | "audience" | "purpose" | "keyPoints" | "duration" | "tone";
type FormErrors = Partial<Record<FieldName, string>>;

interface PresentationFormProps {
  /** Pre-fill the form (used when the user comes back to edit). */
  initialValue: Presentation | null;
  /** Called with clean, validated data when the user submits. */
  onSubmit: (presentation: Presentation) => void;
}

/** Turn a saved Presentation back into form draft values. */
function toDraft(presentation: Presentation | null): FormDraft {
  if (!presentation) {
    return {
      title: "",
      audience: "",
      purpose: "",
      keyPoints: [""],
      duration: "5",
      toneChoice: TONE_OPTIONS[0],
      customTone: "",
    };
  }
  const isPresetTone = TONE_OPTIONS.includes(presentation.tone);
  return {
    title: presentation.title,
    audience: presentation.audience,
    purpose: presentation.purpose,
    keyPoints: presentation.keyPoints.length > 0 ? [...presentation.keyPoints] : [""],
    duration: String(presentation.desiredDurationMinutes),
    toneChoice: isPresetTone ? presentation.tone : OTHER_TONE,
    customTone: isPresetTone ? "" : presentation.tone,
  };
}

/** Returns an error message for a required text field, or undefined if it's fine. */
function checkText(value: string, label: string): string | undefined {
  if (value.trim() === "") return `Please enter ${label}.`;
  if (value.length > MAX_TEXT_LENGTH) {
    return `This must be ${MAX_TEXT_LENGTH} characters or fewer.`;
  }
  return undefined;
}

/**
 * Check every field. Returns the errors found, plus the clean Presentation
 * if there were no errors.
 */
function validate(draft: FormDraft): { errors: FormErrors; presentation: Presentation | null } {
  const errors: FormErrors = {};

  errors.title = checkText(draft.title, "a title or topic");
  errors.audience = checkText(draft.audience, "who your audience is");
  errors.purpose = checkText(draft.purpose, "the purpose of your presentation");

  // Blank key-point rows are simply ignored; at least one real point is required.
  const keyPoints = draft.keyPoints.map((point) => point.trim()).filter((point) => point !== "");
  if (keyPoints.length === 0) {
    errors.keyPoints = "Please add at least one key point.";
  } else if (keyPoints.some((point) => point.length > MAX_TEXT_LENGTH)) {
    errors.keyPoints = `Each key point must be ${MAX_TEXT_LENGTH} characters or fewer.`;
  }

  const duration = Number(draft.duration);
  if (draft.duration.trim() === "" || !Number.isFinite(duration)) {
    errors.duration = "Please enter a number of minutes.";
  } else if (duration < MIN_DURATION_MINUTES || duration > MAX_DURATION_MINUTES) {
    errors.duration = `Please choose between ${MIN_DURATION_MINUTES} and ${MAX_DURATION_MINUTES} minutes.`;
  }

  const tone = draft.toneChoice === OTHER_TONE ? draft.customTone.trim() : draft.toneChoice;
  if (draft.toneChoice === OTHER_TONE) {
    errors.tone = checkText(draft.customTone, "the tone you want");
  }

  // Remove entries that are undefined (fields with no problem).
  const realErrors: FormErrors = {};
  for (const [field, message] of Object.entries(errors) as Array<[FieldName, string | undefined]>) {
    if (message) realErrors[field] = message;
  }

  if (Object.keys(realErrors).length > 0) {
    return { errors: realErrors, presentation: null };
  }

  return {
    errors: {},
    presentation: {
      title: draft.title.trim(),
      audience: draft.audience.trim(),
      purpose: draft.purpose.trim(),
      keyPoints,
      desiredDurationMinutes: duration,
      tone,
    },
  };
}

/** The HTML id of the input to focus when a field has an error. */
function inputIdFor(field: FieldName, draft: FormDraft): string {
  if (field === "keyPoints") return "key-point-0";
  if (field === "tone") return draft.toneChoice === OTHER_TONE ? "custom-tone" : "tone";
  return field;
}

const FIELD_ORDER: FieldName[] = ["title", "audience", "purpose", "keyPoints", "duration", "tone"];

export default function PresentationForm({ initialValue, onSubmit }: PresentationFormProps) {
  const [draft, setDraft] = useState<FormDraft>(() => toDraft(initialValue));
  // Only show errors after the user has tried to submit once, so the form
  // doesn't shout at them before they've started typing.
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);

  const errors = hasTriedSubmit ? validate(draft).errors : {};
  const errorCount = Object.keys(errors).length;

  /** Update one simple text field in the draft. */
  function updateField(field: "title" | "audience" | "purpose" | "duration" | "toneChoice" | "customTone", value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateKeyPoint(index: number, value: string) {
    setDraft((current) => ({
      ...current,
      keyPoints: current.keyPoints.map((point, i) => (i === index ? value : point)),
    }));
  }

  function addKeyPoint() {
    setDraft((current) => ({ ...current, keyPoints: [...current.keyPoints, ""] }));
    // Move keyboard focus to the new, empty box once React has drawn it.
    const newIndex = draft.keyPoints.length;
    setTimeout(() => document.getElementById(`key-point-${newIndex}`)?.focus(), 0);
  }

  function removeKeyPoint(index: number) {
    setDraft((current) => ({
      ...current,
      keyPoints: current.keyPoints.filter((_, i) => i !== index),
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // stop the browser reloading the page
    setHasTriedSubmit(true);

    const result = validate(draft);
    if (result.presentation) {
      onSubmit(result.presentation);
      return;
    }

    // Put the cursor in the first field that needs fixing.
    const firstBadField = FIELD_ORDER.find((field) => result.errors[field]);
    if (firstBadField) {
      document.getElementById(inputIdFor(firstBadField, draft))?.focus();
    }
  }

  /** Props that link an input to its error message for screen readers. */
  function errorProps(field: FieldName, hintId?: string) {
    const describedBy = [hintId, errors[field] ? `${field}-error` : undefined].filter(Boolean).join(" ");
    return {
      "aria-invalid": errors[field] ? true : undefined,
      "aria-describedby": describedBy || undefined,
    };
  }

  /** Shows the error message under a field, if it has one. */
  function renderError(field: FieldName) {
    if (!errors[field]) return null;
    return (
      <p id={`${field}-error`} className="field-error">
        {errors[field]}
      </p>
    );
  }

  const canAddKeyPoint = draft.keyPoints.length < MAX_KEY_POINTS;

  return (
    // The page heading and intro text are shown above this form, in App.tsx.
    <form className="card presentation-form" onSubmit={handleSubmit} noValidate>
      {errorCount > 0 && (
        <div className="error-summary" role="alert">
          Please fix {errorCount === 1 ? "1 problem" : `${errorCount} problems`} below.
        </div>
      )}

      <div className="field">
        <label htmlFor="title">Title or topic</label>
        <input
          id="title"
          type="text"
          value={draft.title}
          maxLength={MAX_TEXT_LENGTH}
          onChange={(e) => updateField("title", e.target.value)}
          {...errorProps("title")}
        />
        {renderError("title")}
      </div>

      <div className="field">
        <label htmlFor="audience">Audience</label>
        <p id="audience-hint" className="hint">
          Who will be listening? For example: "classmates", "investors", "a job interview panel".
        </p>
        <input
          id="audience"
          type="text"
          value={draft.audience}
          maxLength={MAX_TEXT_LENGTH}
          onChange={(e) => updateField("audience", e.target.value)}
          {...errorProps("audience", "audience-hint")}
        />
        {renderError("audience")}
      </div>

      <div className="field">
        <label htmlFor="purpose">Purpose</label>
        <p id="purpose-hint" className="hint">
          What do you want your audience to think, feel or do afterwards?
        </p>
        <textarea
          id="purpose"
          rows={3}
          value={draft.purpose}
          maxLength={MAX_TEXT_LENGTH}
          onChange={(e) => updateField("purpose", e.target.value)}
          {...errorProps("purpose", "purpose-hint")}
        />
        {renderError("purpose")}
      </div>

      <fieldset className="field">
        <legend>Key points</legend>
        <p id="keyPoints-hint" className="hint">
          The main ideas your speech should cover (up to {MAX_KEY_POINTS}). Empty boxes are ignored.
        </p>
        <ol className="key-point-list">
          {draft.keyPoints.map((point, index) => (
            <li key={index} className="key-point-row">
              <label htmlFor={`key-point-${index}`} className="visually-hidden">
                Key point {index + 1}
              </label>
              <input
                id={`key-point-${index}`}
                type="text"
                value={point}
                maxLength={MAX_TEXT_LENGTH}
                onChange={(e) => updateKeyPoint(index, e.target.value)}
                {...(index === 0 ? errorProps("keyPoints", "keyPoints-hint") : {})}
              />
              <button
                type="button"
                className="button-secondary"
                onClick={() => removeKeyPoint(index)}
                disabled={draft.keyPoints.length === 1}
                aria-label={`Remove key point ${index + 1}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ol>
        {renderError("keyPoints")}
        <button type="button" className="button-secondary" onClick={addKeyPoint} disabled={!canAddKeyPoint}>
          <Plus size={16} aria-hidden="true" />
          Add key point
        </button>
        {!canAddKeyPoint && <p className="hint">You've reached the maximum of {MAX_KEY_POINTS} key points.</p>}
      </fieldset>

      <div className="field-row">
        <div className="field">
          <label htmlFor="duration">Desired duration (minutes)</label>
          <p id="duration-hint" className="hint">
            Between {MIN_DURATION_MINUTES} and {MAX_DURATION_MINUTES}.
          </p>
          <input
            id="duration"
            type="number"
            inputMode="decimal"
            min={MIN_DURATION_MINUTES}
            max={MAX_DURATION_MINUTES}
            step={0.5}
            value={draft.duration}
            onChange={(e) => updateField("duration", e.target.value)}
            {...errorProps("duration", "duration-hint")}
          />
          {renderError("duration")}
        </div>

        <div className="field">
          <label htmlFor="tone">Tone</label>
          <p id="tone-hint" className="hint">
            How do you want to come across?
          </p>
          <select
            id="tone"
            value={draft.toneChoice}
            onChange={(e) => updateField("toneChoice", e.target.value)}
            aria-describedby="tone-hint"
          >
            {TONE_OPTIONS.map((tone) => (
              <option key={tone} value={tone}>
                {tone}
              </option>
            ))}
            <option value={OTHER_TONE}>Other…</option>
          </select>

          {draft.toneChoice === OTHER_TONE && (
            <>
              <label htmlFor="custom-tone" className="sub-label">
                Describe the tone
              </label>
              <input
                id="custom-tone"
                type="text"
                value={draft.customTone}
                maxLength={MAX_TEXT_LENGTH}
                onChange={(e) => updateField("customTone", e.target.value)}
                {...errorProps("tone")}
              />
            </>
          )}
          {renderError("tone")}
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="button-primary">
          Save and continue
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
