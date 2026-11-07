import confetti from "canvas-confetti";

// The app's sage palette (CSS variables in index.css), with fallbacks in case
// a variable can't be read.
const THEME_COLOURS: Array<[variable: string, fallback: string]> = [
  ["--sage-200", "#cad6ca"],
  ["--sage-300", "#a9c3a7"],
  ["--sage-500", "#7a9877"],
  ["--sage-700", "#5a7058"],
  ["--sage-900", "#36443a"],
];

function readThemeColours(): string[] {
  const styles = getComputedStyle(document.documentElement);
  return THEME_COLOURS.map(([variable, fallback]) => styles.getPropertyValue(variable).trim() || fallback);
}

/**
 * A small, quick confetti burst from the bottom-left and bottom-right corners.
 * Skipped entirely for people who prefer reduced motion. The confetti canvas
 * never blocks clicks (canvas-confetti sets pointer-events: none).
 */
export function celebrate(): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const burst: confetti.Options = {
    particleCount: 40,
    spread: 55,
    startVelocity: 45,
    ticks: 90, // how long each piece lives: about 1.5 seconds
    gravity: 1.1,
    scalar: 0.9,
    colors: readThemeColours(),
    disableForReducedMotion: true,
  };

  void confetti({ ...burst, angle: 60, origin: { x: 0, y: 1 } }); // bottom-left, aiming up-right
  void confetti({ ...burst, angle: 120, origin: { x: 1, y: 1 } }); // bottom-right, aiming up-left
}
