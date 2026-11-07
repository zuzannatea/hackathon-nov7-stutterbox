import { ArrowLeft } from "lucide-react";
import type { AnalysisResponse } from "../types";

interface FeedbackStepProps {
  analysis: AnalysisResponse;
  onBack: () => void;
}

export default function FeedbackStep({ analysis, onBack }: FeedbackStepProps) {
  const { feedback, statistics } = analysis;
  const fillerEntries = Object.entries(statistics.fillerWords);

  return (
    <>
      <div className="practise-main">
        <section className="card summary-card" aria-labelledby="analysis-transcript-heading">
          <h2 id="analysis-transcript-heading" className="card-heading-small">
            Formatted transcript
          </h2>
          <div className="transcript-box">{analysis.formattedTranscript}</div>
        </section>

        <section className="card summary-card" aria-labelledby="statistics-heading">
          <h2 id="statistics-heading" className="card-heading-small">
            Speech statistics
          </h2>
          <ul className="chip-row" aria-label="Speech statistics">
            <li className="chip">Duration: {statistics.durationSeconds.toFixed(1)} seconds</li>
            <li className="chip">Words: {statistics.wordCount}</li>
            <li className="chip">Speaking pace: {statistics.wordsPerMinute.toFixed(1)} WPM</li>
          </ul>
          <h3 className="card-heading-small">Filler words</h3>
          {fillerEntries.length > 0 ? (
            <ul>
              {fillerEntries.map(([word, count]) => (
                <li key={word}>
                  {word}: {count}
                </li>
              ))}
            </ul>
          ) : (
            <p>No filler words detected.</p>
          )}
        </section>

        <section className="card summary-card" aria-labelledby="assessment-heading">
          <h2 id="assessment-heading" className="card-heading-small">
            Overall assessment
          </h2>
          <p>{feedback.overallAssessment}</p>
        </section>

        <section className="card summary-card" aria-labelledby="planning-assessment-heading">
          <h2 id="planning-assessment-heading" className="card-heading-small">
            Presentation plan
          </h2>
          <p>{feedback.planningAssessment}</p>
        </section>

        <section className="card summary-card" aria-labelledby="execution-assessment-heading">
          <h2 id="execution-assessment-heading" className="card-heading-small">
            Presentation execution
          </h2>
          <p>{feedback.executionAssessment}</p>
        </section>

        <section className="card summary-card" aria-labelledby="strengths-heading">
          <h2 id="strengths-heading" className="card-heading-small">
            Strengths
          </h2>
          {feedback.strengths.length > 0 ? (
            <ul>
              {feedback.strengths.map((strength, index) => (
                <li key={`${strength.title}-${index}`}>
                  <h3>{strength.title}</h3>
                  <p>{strength.explanation}</p>
                  {strength.evidence && <blockquote>“{strength.evidence}”</blockquote>}
                </li>
              ))}
            </ul>
          ) : (
            <p>No strengths were returned for this attempt.</p>
          )}
        </section>

        <section className="card summary-card" aria-labelledby="improvements-heading">
          <h2 id="improvements-heading" className="card-heading-small">
            Areas to improve
          </h2>
          {feedback.improvements.length > 0 ? (
            <ul>
              {feedback.improvements.map((improvement, index) => (
                <li key={`${improvement.title}-${index}`}>
                  <h3>{improvement.title}</h3>
                  <p>{improvement.explanation}</p>
                  {improvement.evidence && <blockquote>“{improvement.evidence}”</blockquote>}
                  <p>
                    <strong>Try this:</strong> {improvement.recommendation}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No improvements were returned for this attempt.</p>
          )}
        </section>

        <section className="card summary-card" aria-labelledby="coverage-heading">
          <h2 id="coverage-heading" className="card-heading-small">
            Key-point coverage
          </h2>
          {feedback.keyPointCoverage.length > 0 ? (
            <ul>
              {feedback.keyPointCoverage.map((item, index) => (
                <li key={`${item.keyPoint}-${index}`}>
                  <p>
                    <strong>{item.keyPoint}</strong> — {item.status}
                  </p>
                  <p>{item.explanation}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No key-point coverage results were returned.</p>
          )}
        </section>

        <section className="card summary-card" aria-labelledby="next-steps-heading">
          <h2 id="next-steps-heading" className="card-heading-small">
            Next steps
          </h2>
          {feedback.nextSteps.length > 0 ? (
            <ol>
              {feedback.nextSteps.map((step, index) => (
                <li key={`${step}-${index}`}>{step}</li>
              ))}
            </ol>
          ) : (
            <p>No next steps were returned for this attempt.</p>
          )}
        </section>

        {feedback.suggestedRewrite?.trim() && (
          <section className="card summary-card" aria-labelledby="rewrite-heading">
            <h2 id="rewrite-heading" className="card-heading-small">
              Suggested rewrite
            </h2>
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
