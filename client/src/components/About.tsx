import {
  ArrowLeft,
  AudioLines,
  Briefcase,
  FileText,
  GraduationCap,
  HeartHandshake,
  Languages,
  MessageSquareText,
  Mic,
  Presentation,
  RotateCcw,
} from "lucide-react";
import type { ReactNode } from "react";
import "../Home.css"; // reuses Home's sections, cards, steps and banner
import "./About.css";

interface AboutProps {
  /** Returns to the screen the user came from (nothing they entered is lost). */
  onBack: () => void;
  /** e.g. "Practise", so the button reads "Back to Practise". */
  backLabel: string;
  /** Goes to Step 1 (Add speech), keeping any speech already entered. */
  onStartPractising: () => void;
}

interface Card {
  icon: ReactNode;
  title: string;
  text: string;
}

const HELP_CARDS: Card[] = [
  {
    icon: <FileText size={18} aria-hidden="true" />,
    title: "Practise with your real script",
    text: "Upload a document or paste text, so you rehearse the exact words you'll say on the day.",
  },
  {
    icon: <AudioLines size={18} aria-hidden="true" />,
    title: "See your speech as you say it",
    text: "A live transcript follows along, so you can see what was heard without needing someone to listen.",
  },
  {
    icon: <MessageSquareText size={18} aria-hidden="true" />,
    title: "Get feedback after each run",
    text: "See your pace, filler words and which key points you covered, with clear next steps.",
  },
  {
    icon: <RotateCcw size={18} aria-hidden="true" />,
    title: "Practise again, as often as you like",
    text: "Hit “Record again” anytime. Repetition in a low-pressure space is how confidence grows.",
  },
];

const STEPS = [
  "Upload your speech (PDF, Word or text) or paste it in, then add your aims.",
  "Press Start and read it aloud.",
  "Watch the live transcript follow along, or follow your script line by line in Practice mode.",
  "Open your feedback and see what to work on.",
  "Record again whenever you're ready.",
];

const WHO_CARDS: Card[] = [
  {
    icon: <HeartHandshake size={18} aria-hidden="true" />,
    title: "People who stutter",
    text: "Practise in a patient space with no interruptions or rushing. Stutterbox is a practice companion, not a treatment, and works alongside support from a speech and language therapist if you have one.",
  },
  {
    icon: <Presentation size={18} aria-hidden="true" />,
    title: "Nervous public speakers",
    text: "Rehearse until the words feel familiar, so the real moment feels less daunting.",
  },
  {
    icon: <GraduationCap size={18} aria-hidden="true" />,
    title: "Students",
    text: "Prepare for presentations, oral exams and class talks.",
  },
  {
    icon: <Languages size={18} aria-hidden="true" />,
    title: "Language learners",
    text: "Read aloud and compare the live transcript with your script, a useful hint for pronunciation practice.",
  },
  {
    icon: <Briefcase size={18} aria-hidden="true" />,
    title: "Professionals",
    text: "Rehearse pitches, interviews, toasts and meeting updates.",
  },
];

function CardGrid({ cards, className }: { cards: Card[]; className: string }) {
  return (
    <ul className={className}>
      {cards.map((card) => (
        <li key={card.title} className="feature-card">
          <span className="feature-icon">{card.icon}</span>
          <h3>{card.title}</h3>
          <p>{card.text}</p>
        </li>
      ))}
    </ul>
  );
}

/** About Us page. Reachable from the header at any time without losing progress. */
export default function About({ onBack, backLabel, onStartPractising }: AboutProps) {
  return (
    <div className="home about-page">
      <main>
        {/* ---------- Hero ---------- */}
        <section className="home-container about-hero" aria-labelledby="about-heading">
          <button type="button" className="text-link about-back" onClick={onBack}>
            <ArrowLeft size={14} aria-hidden="true" /> Back to {backLabel}
          </button>
          <h1 id="about-heading">About Stutterbox</h1>
          <p className="about-subtitle">A calm space to practise speaking out loud, at your own pace.</p>
        </section>

        {/* ---------- 1. What is Stutterbox? ---------- */}
        <section className="home-container about-section" aria-labelledby="what-heading">
          <h2 id="what-heading">What is Stutterbox?</h2>
          <div className="about-prose">
            <p>
              Stutterbox is a speech practice tool. You upload or paste a speech, read it aloud, and the
              app listens along with you. As you speak, a live transcript follows your words, or Practice
              mode scrolls through your script line by line. When you're done, you get feedback to help
              you see what to work on next.
            </p>
            <p>
              There's no audience, no time pressure and no judgement, just you and your words.
            </p>
            <p className="about-small">
              Your browser's speech service turns your voice into text (Chrome uses an online service),
              and your transcript is sent to our server to create your feedback. Stutterbox never records
              or uploads audio.
            </p>
          </div>
        </section>

        {/* ---------- 2. How we can help ---------- */}
        <section className="features" aria-labelledby="help-heading">
          <div className="home-container">
            <h2 id="help-heading">How we can help</h2>
            <CardGrid cards={HELP_CARDS} className="feature-grid" />

            <h3 className="about-subheading" id="how-heading">
              How it works
            </h3>
            <ol className="step-grid about-steps" aria-labelledby="how-heading">
              {STEPS.map((step, index) => (
                <li key={step} className="step-card">
                  <span className="step-number" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- 3. Who we can help ---------- */}
        <section className="home-container about-section" aria-labelledby="who-heading">
          <h2 id="who-heading">Who we can help</h2>
          <CardGrid cards={WHO_CARDS} className="about-who-grid" />
          <p className="about-note">
            Speech recognition isn't perfect. Accents, background noise and unusual words can affect the
            transcript, so treat the transcript and feedback as a guide, not a grade.
          </p>
        </section>

        {/* ---------- Start practising ---------- */}
        <section className="home-container" aria-labelledby="about-cta-heading">
          <div className="cta-banner">
            <h2 id="about-cta-heading">Ready when you are</h2>
            <p>Take it at your own pace. You can practise as many times as you like.</p>
            <button type="button" className="cta-button cta-button-light" onClick={onStartPractising}>
              <Mic size={16} aria-hidden="true" />
              Start practising
            </button>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-container home-footer-inner">
          <p>Built at a hackathon on 7 November 2026 by the Stutterbox team.</p>
        </div>
      </footer>
    </div>
  );
}
