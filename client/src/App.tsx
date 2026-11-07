import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "./App.css";
import {
  AnalysisApiError,
  submitAnalysis,
  type AnalysisApiErrorInfo,
} from "./services/analysisApi";
import About from "./components/About";
import Header from "./components/Header";
import FeedbackStep from "./components/FeedbackStep";
import Home from "./components/Home";
import PractiseStep from "./components/PractiseStep";
import PresentationForm from "./components/PresentationForm";
import SpeechStep from "./components/SpeechStep";
import StepProgress from "./components/StepProgress";
import type {
  AnalysisResponse,
  AnalyzeRequestBody,
  PractiseAttempt,
  Presentation,
  SpeechDraft,
} from "./types";
import { celebrate } from "./utils/celebrate";
import { createFormDraft, type FormDraft } from "./utils/formDraft";

// Which screen is showing.
// Flow: Home → 1 Add speech → 2 Your aims → 3 Practise → 4 Feedback.
type Screen =
  | "home" // landing page
  | "speech" // Step 1: type, paste or upload the speech
  | "aims" // Step 2: presentation details form
  | "practise" // Step 3: record the speech
  | "feedback" // Step 4: analysis results
  | "about"; // About Us (not a step; reachable any time from the header)

// Names used for the About page's "Back to …" button.
const SCREEN_NAMES: Record<Screen, string> = {
  home: "Home",
  speech: "Add speech",
  aims: "Your aims",
  practise: "Practise",
  feedback: "Feedback",
  about: "About Us",
};

const AIMS_TIPS = [
  "Write 3–5 key points. These are what your feedback checks for.",
  "Be specific about your audience, e.g. 'first-year students'.",
  "Most speeches land well at 130–160 words per minute.",
];

const EMPTY_SPEECH: SpeechDraft = { title: "", text: "", file: null, source: null };

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  // Where the user was before opening About Us, so they can go straight back.
  const [screenBeforeAbout, setScreenBeforeAbout] = useState<Screen>("home");

  // ---- Everything the user has entered, kept here so nothing is lost between steps ----
  // Step 1 speech: frontend-only reference text. It is NOT sent to the backend.
  // TODO: the team may add a "script" field to the API contract later.
  const [speech, setSpeech] = useState<SpeechDraft>(EMPTY_SPEECH);
  // Step 2: what's typed in the form (even if not saved yet)...
  const [aimsDraft, setAimsDraft] = useState<FormDraft>(() => createFormDraft(null));
  // ...and the saved, validated aims.
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  // Step 3 finished attempt (transcript + duration).
  const [attempt, setAttempt] = useState<PractiseAttempt | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysisError, setAnalysisError] = useState<AnalysisApiErrorInfo | null>(null);
  // The feedback result we've already celebrated (see the confetti effect below).
  const celebratedAnalysisRef = useRef<AnalysisResponse | null>(null);

  const [serverStatus, setServerStatus] = useState("checking…");

  // Quick check that the backend is running (shown in the footer).
  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then((data: { status?: string }) =>
        setServerStatus(data.status === "ok" ? "connected" : "not responding"),
      )
      .catch(() => setServerStatus("not reachable — is the server running?"));
  }, []);

  // Every time the screen changes, jump back to the top of the page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  // A small confetti burst when a NEW feedback result is shown. Remembering the
  // result we celebrated means it fires once per recording: not again after
  // visiting About Us and coming back, and not twice from React StrictMode's
  // double-run in development.
  useEffect(() => {
    if (screen !== "feedback" || !analysis || celebratedAnalysisRef.current === analysis) return;
    celebratedAnalysisRef.current = analysis;
    celebrate();
  }, [screen, analysis]);

  function goHome() {
    if (isSubmitting) return;
    setScreen("home");
    window.scrollTo(0, 0); // also scroll up if we were already on Home
  }

  /** Opens About Us without clearing anything the user has entered. */
  function goToAbout() {
    if (isSubmitting) return;
    if (screen !== "about") setScreenBeforeAbout(screen);
    setScreen("about");
  }

  function startFlow() {
    if (isSubmitting) return;
    setAnalysis(null);
    setAnalysisError(null);
    setAttempt(null);
    setScreen("speech");
  }

  /** Go to Step 2, filling its Title from the Step 1 title if Title is empty. */
  function goToAims() {
    const speechTitle = speech.title.trim();
    if (speechTitle) {
      setAimsDraft((draft) => (draft.title.trim() === "" ? { ...draft, title: speechTitle } : draft));
    }
    setScreen("aims");
  }

  function handleAimsSubmit(newPresentation: Presentation) {
    setPresentation(newPresentation);
    setAttempt(null);
    setAnalysis(null);
    setAnalysisError(null);
    setScreen("practise");
  }

  function handleAttemptChange(newAttempt: PractiseAttempt | null) {
    setAttempt(newAttempt);
    if (newAttempt === null) {
      setAnalysis(null);
      setAnalysisError(null);
    }
  }

  async function handleGetFeedback() {
    if (isSubmitting) return;
    if (!presentation || !attempt || !attempt.transcript.trim()) {
      setAnalysisError({
        kind: "request",
        message: "Your presentation details and a transcript are needed before analysis.",
      });
      return;
    }

    setIsSubmitting(true);
    setAnalysisError(null);

    const request: Pick<AnalyzeRequestBody, "presentation" | "transcript" | "durationSeconds" | "intendedSpeech"> = {
      presentation,
      transcript: attempt.transcript,
      durationSeconds: attempt.durationSeconds,
      ...(speech.text.trim() ? { intendedSpeech: speech.text } : {}),
    };

    try {
      const response = await submitAnalysis(request);
      setAnalysis(response);
      setScreen("feedback");
    } catch (error) {
      if (error instanceof AnalysisApiError) {
        setAnalysisError({ kind: error.kind, message: error.message, status: error.status });
      } else {
        setAnalysisError({
          kind: "request",
          message: "Something went wrong while requesting feedback. Please try again.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // Step 1 counts as skipped if there's no speech text.
  const skippedSteps = speech.text.trim() ? [] : [1];

  return (
    <>
      <Header
        isHome={screen === "home"}
        isAbout={screen === "about"}
        onGoAbout={goToAbout}
        showStartButton={screen !== "speech"}
        onGoHome={goHome}
        onStart={startFlow}
      />

      {screen === "home" && <Home onStart={startFlow} />}

      {screen === "about" && (
        <About
          onBack={() => setScreen(screenBeforeAbout)}
          backLabel={SCREEN_NAMES[screenBeforeAbout]}
          onStartPractising={() => setScreen("speech")}
        />
      )}

      {screen !== "home" && screen !== "about" && (
        <div className="app">
          <main>
            {screen === "speech" && (
              <>
                <StepProgress currentStep={1} />
                <div className="page-heading">
                  <h1>Add your speech</h1>
                  <p>Type or paste it below, upload a document, or describe it and we'll write one. You can edit it here at any time.</p>
                </div>
                <SpeechStep
                  speech={speech}
                  onSpeechChange={setSpeech}
                  onContinue={goToAims}
                  onSkip={goToAims}
                />
                <div className="step-nav">
                  <button type="button" className="button-back" onClick={goHome}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    Back
                  </button>
                </div>
              </>
            )}

            {screen === "aims" && (
              <>
                <StepProgress currentStep={2} skippedSteps={skippedSteps} />
                <div className="page-heading">
                  <h1>What are your aims?</h1>
                  <p>
                    Tell us who you're speaking to and what you want them to think, feel or do
                    afterwards.
                  </p>
                </div>

                <div className="form-layout">
                  <PresentationForm
                    draft={aimsDraft}
                    onDraftChange={setAimsDraft}
                    onSubmit={handleAimsSubmit}
                  />

                  <aside className="tips-card" aria-labelledby="tips-heading">
                    <h2 id="tips-heading">Quick tips</h2>
                    <ul className="tips-list">
                      {AIMS_TIPS.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </aside>
                </div>
                <div className="step-nav">
                  <button type="button" className="button-back" onClick={() => setScreen("speech")}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    Back
                  </button>
                </div>
              </>
            )}

            {screen === "practise" && (
              <>
                <StepProgress currentStep={3} skippedSteps={skippedSteps} />
                <div className="page-heading">
                  <h1>Practise your speech</h1>
                  <p>
                    {presentation ? <>Practising “{presentation.title}”. </> : null}
                    Press Start and give your speech out loud. Choose Live transcript to see your words as you speak, or Practice mode to follow your speech line by line.
                  </p>
                </div>
                <PractiseStep
                  speechTitle={speech.title}
                  speechText={speech.text}
                  attempt={attempt}
                  onAttemptChange={handleAttemptChange}
                  onBack={() => setScreen("aims")}
                  onGetFeedback={handleGetFeedback}
                  isSubmitting={isSubmitting}
                  analysisError={analysisError}
                  onEditSpeech={() => setScreen("speech")}
                />
              </>
            )}

            {screen === "feedback" && analysis && (
              <>
                <StepProgress currentStep={4} skippedSteps={skippedSteps} />
                <div className="page-heading">
                  <h1>Your feedback</h1>
                  <p>Review your speech statistics and suggestions for your next practice.</p>
                </div>
                {presentation && (
                  <FeedbackStep
                    analysis={analysis}
                    presentation={presentation}
                    onBack={() => setScreen("practise")}
                  />
                )}
              </>
            )}
          </main>

          <footer className="app-footer">Server: {serverStatus}</footer>
        </div>
      )}
    </>
  );
}

export default App;
