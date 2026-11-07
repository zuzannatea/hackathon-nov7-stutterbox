import type { Presentation } from "../types";

// Shared by PresentationForm (Step 2) and App.tsx, which keeps the draft so
// that unsaved typing survives going Back to Step 1 and returning.

export const TONE_OPTIONS = ["Friendly", "Professional", "Persuasive", "Informative", "Inspiring"];
export const OTHER_TONE = "Other";

/**
 * What the user is typing in the Step 2 form right now. This is kept separate
 * from the final `Presentation` because, while typing, the duration is still
 * text and the tone is split into "dropdown choice" + "custom text".
 */
export interface FormDraft {
  title: string;
  audience: string;
  purpose: string;
  keyPoints: string[];
  duration: string;
  toneChoice: string;
  customTone: string;
}

/** A blank draft, or a draft filled from a saved Presentation. */
export function createFormDraft(presentation: Presentation | null): FormDraft {
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
