import { Check } from "lucide-react";

const STEPS = ["Add speech", "Your aims", "Practise", "Feedback"];

interface StepProgressProps {
  /** Which step the user is on: 1–4. */
  currentStep: 1 | 2 | 3 | 4;
  /** Earlier steps the user skipped (e.g. [1] if they skipped adding a speech). */
  skippedSteps?: number[];
}

/** The row of step pills at the top of each step screen. */
export default function StepProgress({ currentStep, skippedSteps = [] }: StepProgressProps) {
  return (
    <ol className="step-progress" aria-label="Progress">
      {STEPS.map((label, index) => {
        const stepNumber = index + 1;
        const isSkipped = stepNumber < currentStep && skippedSteps.includes(stepNumber);
        const status = isSkipped
          ? "skipped"
          : stepNumber < currentStep
            ? "done"
            : stepNumber === currentStep
              ? "current"
              : "upcoming";

        return (
          <li
            key={label}
            className={`step-pill step-pill-${status}`}
            aria-current={status === "current" ? "step" : undefined}
          >
            {status === "done" ? (
              <>
                <Check size={14} aria-hidden="true" />
                {label}
                <span className="visually-hidden"> (completed)</span>
              </>
            ) : (
              <>
                {stepNumber} · {label}
                {status === "skipped" && <span className="step-pill-note"> (skipped)</span>}
                {status === "current" && <span className="visually-hidden"> (current step)</span>}
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}
