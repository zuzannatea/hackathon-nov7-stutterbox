import { ArrowRight, AudioLines, ChartColumn, ClipboardList, MessageSquareText, Mic } from "lucide-react";
import type { ReactNode } from "react";
import "../Home.css";

interface HomeProps {
  /** Called when the user clicks any "Input Speech" button. */
  onStart: () => void;
}

// Only features the MVP really has (see PROJECT.md section 4).
const FEATURES: Array<{ icon: ReactNode; title: string; text: string }> = [
  {
    icon: <ClipboardList size={18} aria-hidden="true" />,
    title: "Plan what you want to say",
    text: "Add your topic, audience, purpose, key points, target length and tone, so the feedback is about the speech you meant to give.",
  },
  {
    icon: <AudioLines size={18} aria-hidden="true" />,
    title: "See your words as you speak",
    text: "Talk into your microphone and watch your words appear on screen, using your browser's speech recognition. Your full transcript is ready when you stop.",
  },
  {
    icon: <ChartColumn size={18} aria-hidden="true" />,
    title: "Know your numbers",
    text: 'See how long you spoke, your word count, words per minute, and filler words like "um" and "uh".',
  },
  {
    icon: <MessageSquareText size={18} aria-hidden="true" />,
    title: "Feedback on your key points",
    text: "AI checks which key points you covered, partly covered or missed, and gives strengths, examples from your transcript and clear next steps.",
  },
];

const STEPS: Array<{ title: string; text: string }> = [
  {
    title: "Describe your talk",
    text: "Tell us your topic, who you're speaking to, why, and the key points you want to get across.",
  },
  {
    title: "Practise out loud",
    text: "Press start and speak. Your words appear on screen as you go, with a timer running so you can keep track.",
  },
  {
    title: "Get your feedback",
    text: "See your speech statistics and which key points landed, plus the top things to try in your next practice.",
  },
];

/** The "Input Speech" button. Used in several places on the page. */
function StartButton({ onStart, variant = "primary" }: HomeProps & { variant?: "primary" | "light" }) {
  return (
    <button type="button" className={`cta-button cta-button-${variant}`} onClick={onStart}>
      <Mic size={16} aria-hidden="true" />
      Input Speech
    </button>
  );
}

/** Drawing of a speaker with a live transcript card. Purely decorative. */
function HeroIllustration() {
  return (
    <div
      className="hero-illustration"
      role="img"
      aria-label="Illustration of a person speaking, with their words appearing in a live transcript"
    >
      <svg viewBox="0 0 400 380" className="hero-svg" aria-hidden="true">
        {/* background circles */}
        <circle cx="215" cy="175" r="150" fill="#DCE5DC" />
        <circle cx="215" cy="175" r="98" fill="#A9C3A7" opacity="0.75" />

        {/* sound waves */}
        <path d="M318 120 Q340 150 318 182" stroke="#A9C3A7" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M338 102 Q372 150 338 200" stroke="#CAD6CA" strokeWidth="7" fill="none" strokeLinecap="round" />

        {/* body / suit */}
        <path d="M120 380 L130 270 Q135 238 175 230 L255 230 Q295 238 300 270 L310 380 Z" fill="#36443A" />
        {/* shirt and tie */}
        <path d="M195 230 L215 262 L235 230 Z" fill="#FFFFFF" />
        <path d="M209 244 L221 244 L224 300 L215 312 L206 300 Z" fill="#5A7058" />

        {/* raised arm */}
        <path d="M282 246 Q318 228 322 168" stroke="#36443A" strokeWidth="28" fill="none" strokeLinecap="round" />
        <circle cx="324" cy="160" r="17" fill="#C08457" />

        {/* microphone */}
        <line x1="150" y1="226" x2="150" y2="300" stroke="#2A2F2B" strokeWidth="5" />
        <rect x="140" y="204" width="20" height="30" rx="10" fill="#2A2F2B" />

        {/* neck and head */}
        <rect x="203" y="200" width="24" height="34" rx="8" fill="#A9714A" />
        <ellipse cx="215" cy="165" rx="43" ry="47" fill="#B9794E" />
        {/* hair */}
        <path d="M172 160 Q168 112 215 110 Q262 112 258 158 Q246 132 215 134 Q186 134 172 160 Z" fill="#1F1F1F" />
        {/* face */}
        <circle cx="200" cy="165" r="4" fill="#1F1F1F" />
        <circle cx="230" cy="165" r="4" fill="#1F1F1F" />
        <path d="M200 184 Q215 196 230 184" stroke="#1F1F1F" strokeWidth="3.5" fill="none" strokeLinecap="round" />

        {/* lectern */}
        <rect x="122" y="300" width="176" height="16" rx="5" fill="#5A7058" />
        <rect x="136" y="316" width="148" height="70" fill="#4A5F48" />
      </svg>

      {/* example live-transcript card */}
      <div className="transcript-card" aria-hidden="true">
        <div className="transcript-card-top">
          <span className="transcript-card-label">Live transcript</span>
          <span className="transcript-card-badge">
            <span className="listening-dot" /> 0:42
          </span>
        </div>
        <p className="transcript-line-done">Thank you all for being here tonight.</p>
        <p className="transcript-line-current">I want to share a story about the first time I spoke on stage</p>
        <p className="transcript-line-interim">and why it almost didn't happen…</p>
        <div className="transcript-progress">
          <div className="transcript-progress-fill" />
        </div>
      </div>
    </div>
  );
}

export default function Home({ onStart }: HomeProps) {
  return (
    <div className="home" id="top">
      <main>
        {/* ---------- Hero ---------- */}
        <section className="home-container hero" aria-labelledby="hero-heading">
          <div className="hero-text">
            <p className="eyebrow-pill">Your personal speech coach</p>
            <h1 id="hero-heading">Speak with confidence.</h1>
            <p className="hero-intro">
              Describe your talk, practise it out loud while your words appear on screen, and get specific,
              encouraging feedback on what you covered. No pressure, just progress.
            </p>
            <div className="hero-actions">
              <StartButton onStart={onStart} />
              <a href="#how-it-works" className="text-link">
                See how it works <ArrowRight size={14} aria-hidden="true" />
              </a>
            </div>
            <p className="hero-small">Free to use · No sign-up needed</p>
          </div>
          <HeroIllustration />
        </section>

        {/* ---------- Features ---------- */}
        <section className="features" aria-labelledby="features-heading">
          <div className="home-container">
            <p className="eyebrow">Features</p>
            <h2 id="features-heading">Everything you need to nail your speech</h2>
            <ul className="feature-grid">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="feature-card">
                  <span className="feature-icon">{feature.icon}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section className="home-container steps" id="how-it-works" aria-labelledby="steps-heading">
          <p className="eyebrow">How it works</p>
          <h2 id="steps-heading">Three steps to a better speech</h2>
          <ol className="step-grid">
            {STEPS.map((step, index) => (
              <li key={step.title} className="step-card">
                <span className="step-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- Call to action ---------- */}
        <section className="home-container" aria-labelledby="cta-heading">
          <div className="cta-banner">
            <h2 id="cta-heading">Ready to find your voice?</h2>
            <p>Your next great speech is just a few clicks away.</p>
            <StartButton onStart={onStart} variant="light" />
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-container home-footer-inner">
          <p>Stutterbox · Practise your speech. Find your voice.</p>
          <p>Built at Hackathon · Nov 2026</p>
        </div>
      </footer>
    </div>
  );
}
