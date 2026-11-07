import { useEffect, useState } from "react";
import "./App.css";
import {
  AnalysisApiError,
  submitAnalysis,
  type AnalysisApiErrorInfo,
} from "./services/analysisApi";
import Header from "./components/Header";
import FeedbackStep from "./components/FeedbackStep";
import Home from "./components/Home";
import PractiseStep from "./components/PractiseStep";
import PresentationForm from "./components/PresentationForm";
import StepProgress from "./components/StepProgress";
import type { AnalysisResponse, AnalyzeRequestBody, PractiseAttempt, Presentation } from "./types";

// Which screen is showing. Flow: Home → 1 Your speech → 2 Your aims → 3 Practise → 4 Feedback.
// TODO (part a): add the "speech" screen (Step 1) and point Input Speech at it.
type Screen =
  | "home" // landing page
  | "aims" // Step 2: presentation details form
  | "practise" // Step 3: record the speech
  | "feedback"; // Step 4: analysis results

const QUICK_TIPS = [
  "Write 3–5 key points. These are what your feedback checks for.",
  "Be specific about your audience, e.g. 'first-year students'.",
  "Most speeches land well at 130–160 words per minute.",
];

function App() {
  const [screen, setScreen] = useState<Screen>("home");

  // ---- Everything the user has entered, kept here so nothing is lost between steps ----
  // Step 1 speech: frontend-only reference text. It is NOT sent to the backend.
  // TODO: the team may add a "script" field to the API contract later.
  // Empty until Step 1 is built (part a).
  const [speechTitle] = useState("");
  const [speechText] = useState("");
  // Step 2 aims (saved, validated form data).
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  // Step 3 finished attempt (transcript + duration).
  const [attempt, setAttempt] = useState<PractiseAttempt | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysisError, setAnalysisError] = useState<AnalysisApiErrorInfo | null>(null);

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

  function goHome() {
    if (isSubmitting) return;
    setScreen("home");
    window.scrollTo(0, 0); // also scroll up if we were already on Home
  }

  function startFlow() {
    if (isSubmitting) return;
    setAnalysis(null);
    setAnalysisError(null);
    setAttempt(null);
    setScreen("aims"); // TODO (part a): go to Step 1 "speech" instead
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

    const request: Pick<AnalyzeRequestBody, "presentation" | "transcript" | "durationSeconds"> = {
      presentation,
      transcript: attempt.transcript,
      durationSeconds: attempt.durationSeconds,
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

  // Step 1 is skipped until it exists (or when the user skips it).
  const skippedSteps = speechText.trim() ? [] : [1];

  return (
    <>
      <Header
        isHome={screen === "home"}
        showStartButton={screen !== "aims"} /* TODO (part a): hide on "speech" instead */
        onGoHome={goHome}
        onStart={startFlow}
      />

      {screen === "home" && <Home onStart={startFlow} />}

      {screen !== "home" && (
        <div className="app">
          <main>
            {screen === "aims" && (
              <>
                <StepProgress currentStep={2} skippedSteps={skippedSteps} />
                <div className="page-heading">
                  <h1>Tell us about your presentation</h1>
                  <p>
                    Stutterbox uses these details to compare what you planned to say with what you
                    actually say. All fields are required.
                  </p>
                </div>

                <div className="form-layout">
                  <PresentationForm initialValue={presentation} onSubmit={handleAimsSubmit} />

                  <aside className="tips-card" aria-labelledby="tips-heading">
                    <h2 id="tips-heading">Quick tips</h2>
                    <ul className="tips-list">
                      {QUICK_TIPS.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </aside>
                </div>
              </>
            )}

            {screen === "practise" && (
              <>
                <StepProgress currentStep={3} skippedSteps={skippedSteps} />
                <div className="page-heading">
                  <h1>Practise your speech</h1>
                  <p>Press Start and give your speech out loud. Your words appear as you speak.</p>
                </div>
                <PractiseStep
                  speechTitle={speechTitle}
                  speechText={speechText}
                  attempt={attempt}
                  onAttemptChange={handleAttemptChange}
                  onBack={() => setScreen("aims")}
                  onGetFeedback={handleGetFeedback}
                  isSubmitting={isSubmitting}
                  analysisError={analysisError}
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
                <FeedbackStep analysis={analysis} onBack={() => setScreen("practise")} />
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
