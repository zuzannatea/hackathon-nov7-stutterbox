import { Mic, Zap } from "lucide-react";
import type { MouseEvent } from "react";
import "./Header.css";

interface HeaderProps {
  /** True when the Home page is showing (marks the Home link as the current page). */
  isHome: boolean;
  /** Whether to show the "Input Speech" button (hidden when already on the form). */
  showStartButton: boolean;
  onGoHome: () => void;
  onStart: () => void;
}

/** The navigation bar shown at the top of every screen. */
export default function Header({ isHome, showStartButton, onGoHome, onStart }: HeaderProps) {
  function handleHomeClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault(); // stay in the app instead of reloading the page
    onGoHome();
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a href="/" className="site-logo" onClick={handleHomeClick}>
          <span className="site-logo-mark" aria-hidden="true">
            <Zap size={14} fill="currentColor" />
          </span>
          Stutterbox
        </a>
        <nav aria-label="Main" className="site-nav">
          <a
            href="/"
            className="site-nav-link"
            onClick={handleHomeClick}
            aria-current={isHome ? "page" : undefined}
          >
            Home
          </a>
          {showStartButton && (
            <button type="button" className="cta-button cta-button-primary" onClick={onStart}>
              <Mic size={16} aria-hidden="true" />
              Input Speech
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
