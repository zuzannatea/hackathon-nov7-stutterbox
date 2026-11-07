import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { createServer } from "vite";
import type { AnalysisResponse } from "../src/types.ts";

test("feedback screen displays planning and execution assessments separately", async () => {
  const vite = await createServer({
    configFile: "./vite.config.ts",
    server: { middlewareMode: true },
    appType: "custom",
  });

  try {
    const module = await vite.ssrLoadModule("/src/components/FeedbackStep.tsx") as {
      default: React.ComponentType<{ analysis: AnalysisResponse; onBack: () => void }>;
    };
    const analysis: AnalysisResponse = {
      transcript: "the original transcript text",
      formattedTranscript: "The original transcript text.",
      statistics: {
        durationSeconds: 60,
        wordCount: 6,
        wordsPerMinute: 6,
        fillerWords: {},
      },
      feedback: {
        overallAssessment: "Overall feedback.",
        planningAssessment: "Planning feedback is visible.",
        executionAssessment: "Execution feedback is visible.",
        strengths: [],
        improvements: [],
        keyPointCoverage: [],
        nextSteps: [],
      },
    };

    const markup = renderToStaticMarkup(React.createElement(module.default, { analysis, onBack: () => undefined }));
    assert.match(markup, /Formatted transcript/);
    assert.match(markup, /The original transcript text\./);
    assert.doesNotMatch(markup, /the original transcript text/);
    assert.match(markup, /Presentation plan/);
    assert.match(markup, /Planning feedback is visible\./);
    assert.match(markup, /Presentation execution/);
    assert.match(markup, /Execution feedback is visible\./);
  } finally {
    await vite.close();
  }
});
