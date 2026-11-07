import assert from "node:assert/strict";
import test from "node:test";
import { submitAnalysis } from "../src/services/analysisApi.ts";
import type { AnalysisResponse, AnalyzeRequestBody } from "../src/types.ts";

const baseRequest: AnalyzeRequestBody = {
  presentation: {
    title: "Safer streets",
    audience: "City councillors",
    purpose: "Improve road safety",
    keyPoints: ["Protected cycle lanes"],
    desiredDurationMinutes: 2,
    tone: "Persuasive",
  },
  transcript: "Protected lanes help families travel safely.",
  durationSeconds: 30,
};

const responseBody: AnalysisResponse = {
  transcript: baseRequest.transcript,
  formattedTranscript: "Protected lanes help families travel safely.",
  statistics: {
    durationSeconds: 30,
    wordCount: 7,
    wordsPerMinute: 14,
    fillerWords: {},
  },
  feedback: {
    overallAssessment: "A focused attempt.",
    planningAssessment: "The plan has a clear audience and purpose.",
    executionAssessment: "The transcript supports the purpose.",
    strengths: [],
    improvements: [],
    keyPointCoverage: [],
    nextSteps: [],
  },
};

async function captureRequestBody(request: AnalyzeRequestBody): Promise<Record<string, unknown>> {
  const originalFetch = globalThis.fetch;
  let captured: Record<string, unknown> | undefined;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    captured = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await submitAnalysis(request);
    assert.ok(captured);
    return captured;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("sends intendedSpeech when non-empty", async () => {
  const body = await captureRequestBody({ ...baseRequest, intendedSpeech: "The prepared script." });
  assert.equal(body.intendedSpeech, "The prepared script.");
});

test("omits intendedSpeech when absent or empty", async () => {
  for (const request of [baseRequest, { ...baseRequest, intendedSpeech: "" }, { ...baseRequest, intendedSpeech: "  " }]) {
    const body = await captureRequestBody(request);
    assert.equal(Object.hasOwn(body, "intendedSpeech"), false);
  }
});

test("rejects prepared scripts over the backend limit before sending", async () => {
  await assert.rejects(
    submitAnalysis({ ...baseRequest, intendedSpeech: "x".repeat(20_001) }),
    /20000 characters or fewer/,
  );
});
