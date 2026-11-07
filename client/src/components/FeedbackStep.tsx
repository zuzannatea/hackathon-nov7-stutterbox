import { ArrowLeft } from "lucide-react";
import type { AnalysisResponse, Presentation } from "../types";

interface FeedbackStepProps {
  analysis: AnalysisResponse;
  presentation: Presentation;
  onBack: () => void;
}

const COVERAGE_LABELS = {
  covered: "Covered",
  partial: "Partially covered",
  missing: "Not covered",
} as const;

export default function FeedbackStep({ analysis, presentation, onBack }: FeedbackStepProps) {
  const { feedback, statistics } = analysis;
  const fillerEntries = Object.entries(statistics.fillerWords);

  return (
    <>
      <div className="feedback-report">
        <section className="feedback-overview" aria-labelledby="assessment-heading">
          <p className="feedback-eyebrow">Your coaching summary</p>
          <h2 id="assessment-heading">A thoughtful review of this practice</h2>
          <p className="feedback-overall">{feedback.overallAssessment}</p>
        </section>

        <section className="feedback-statistics" aria-labelledby="statistics-heading">
          <h2 id="statistics-heading" className="feedback-section-title">Speech at a glance</h2>
          <dl className="statistics-grid">
            <div className="statistic-item">
              <dt>Words spoken</dt>
              <dd>{statistics.wordCount}</dd>
            </div>
            <div className="statistic-item statistic-pace">
              <dt>Speaking pace</dt>
              <dd>{statistics.wordsPerMinute.toFixed(1)} <span>WPM</span></dd>
            </div>
            <div className="statistic-item">
              <dt>Duration</dt>
              <dd>{statistics.durationSeconds.toFixed(1)} <span>sec</span></dd>
            </div>
            <div className="statistic-item statistic-fillers">
              <dt>Filler words</dt>
              <dd>{fillerEntries.reduce((total, [, count]) => total + count, 0)}</dd>
              {fillerEntries.length > 0 ? (
                <ul className="filler-list">
                  {fillerEntries.map(([word, count]) => <li key={word}>{word} <span>× {count}</span></li>)}
                </ul>
              ) : <p className="feedback-muted">None detected</p>}
            </div>
          </dl>
        </section>

        <section className="feedback-assessments" aria-label="Planning and execution assessments">
          <article className="assessment-panel planning-panel" aria-labelledby="planning-assessment-heading">
            <p className="feedback-eyebrow">Before you speak</p>
            <h2 id="planning-assessment-heading">The plan</h2>
            <p>{feedback.planningAssessment}</p>
            <dl className="presentation-context">
              <div><dt>Title</dt><dd>{presentation.title}</dd></div>
              <div><dt>Audience</dt><dd>{presentation.audience}</dd></div>
              <div><dt>Purpose</dt><dd>{presentation.purpose}</dd></div>
              <div><dt>Intended tone</dt><dd>{presentation.tone}</dd></div>
              <div className="context-key-points">
                <dt>Key points</dt>
                {presentation.keyPoints.length > 0 ? (
                  <ul>{presentation.keyPoints.map((point, index) => <li key={`${point}-${index}`}>{point}</li>)}</ul>
                ) : <dd>None provided</dd>}
              </div>
            </dl>
          </article>

          <article className="assessment-panel execution-panel" aria-labelledby="execution-assessment-heading">
            <p className="feedback-eyebrow">In this practice</p>
            <h2 id="execution-assessment-heading">The delivery</h2>
            <p>{feedback.executionAssessment}</p>
          </article>
        </section>

        <section className="feedback-columns" aria-label="Strengths and opportunities">
          <section className="feedback-list-section strengths-section" aria-labelledby="strengths-heading">
            <p className="feedback-eyebrow">What worked</p>
            <h2 id="strengths-heading" className="feedback-section-title">Strengths</h2>
            {feedback.strengths.length > 0 ? (
              <ul className="coaching-list">
                {feedback.strengths.map((strength, index) => (
                  <li key={`${strength.title}-${index}`}>
                    <h3>{strength.title}</h3>
                    <p>{strength.explanation}</p>
                    {strength.evidence && <blockquote>“{strength.evidence}”</blockquote>}
                  </li>
                ))}
              </ul>
            ) : <p className="feedback-muted">No strengths were returned for this attempt.</p>}
          </section>

          <section className="feedback-list-section improvements-section" aria-labelledby="improvements-heading">
            <p className="feedback-eyebrow">A place to grow</p>
            <h2 id="improvements-heading" className="feedback-section-title">Areas to improve</h2>
            {feedback.improvements.length > 0 ? (
              <ul className="coaching-list">
                {feedback.improvements.map((improvement, index) => (
                  <li key={`${improvement.title}-${index}`}>
                    <h3>{improvement.title}</h3>
                    <p>{improvement.explanation}</p>
                    {improvement.evidence && <blockquote>“{improvement.evidence}”</blockquote>}
                    <p className="recommendation"><strong>Try this</strong> {improvement.recommendation}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="feedback-muted">No improvements were returned for this attempt.</p>}
          </section>
        </section>

        <section className="coverage-section" aria-labelledby="coverage-heading">
          <div className="coverage-heading-row">
            <div>
              <p className="feedback-eyebrow">Your intended content</p>
              <h2 id="coverage-heading" className="feedback-section-title">Key-point coverage</h2>
            </div>
            <p className="feedback-muted">Status is written out as well as marked.</p>
          </div>
          {feedback.keyPointCoverage.length > 0 ? (
            <ul className="coverage-list">
              {feedback.keyPointCoverage.map((item, index) => (
                <li className={`coverage-item coverage-${item.status}`} key={`${item.keyPoint}-${index}`}>
                  <span className="coverage-mark" aria-hidden="true">{item.status === "covered" ? "✓" : item.status === "partial" ? "◐" : "—"}</span>
                  <div className="coverage-copy">
                    <h3>{item.keyPoint}</h3>
                    <p>{item.explanation}</p>
                  </div>
                  <span className="coverage-label">{COVERAGE_LABELS[item.status]}</span>
                </li>
              ))}
            </ul>
          ) : <p className="feedback-muted">No key-point coverage results were returned.</p>}
          <ul className="coverage-legend" aria-label="Coverage status key">
            <li><span aria-hidden="true">✓</span> Covered</li>
            <li><span aria-hidden="true">◐</span> Partially covered</li>
            <li><span aria-hidden="true">—</span> Not covered</li>
          </ul>
        </section>

        <section className="next-steps-section" aria-labelledby="next-steps-heading">
          <p className="feedback-eyebrow">Take into your next practice</p>
          <h2 id="next-steps-heading" className="feedback-section-title">Next steps</h2>
          {feedback.nextSteps.length > 0 ? (
            <ol className="next-steps-list">{feedback.nextSteps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}</ol>
          ) : <p className="feedback-muted">No next steps were returned for this attempt.</p>}
        </section>

        <section className="transcript-section" aria-labelledby="analysis-transcript-heading">
          <p className="feedback-eyebrow">Your words, gently punctuated</p>
          <h2 id="analysis-transcript-heading" className="feedback-section-title">Formatted transcript</h2>
          <article className="transcript-editorial">{analysis.formattedTranscript}</article>
        </section>

        {feedback.suggestedRewrite?.trim() && (
          <section className="rewrite-section" aria-labelledby="rewrite-heading">
            <p className="feedback-eyebrow">An alternative to try</p>
            <h2 id="rewrite-heading" className="feedback-section-title">Suggested rewrite</h2>
            <p>{feedback.suggestedRewrite}</p>
          </section>
        )}
      </div>

      <div className="step-nav">
        <button type="button" className="button-back" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to transcript
        </button>
      </div>
    </>
  );
}
