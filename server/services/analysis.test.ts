import assert from "node:assert/strict";
import test from "node:test";
import {
  buildUserMessage,
  COACH_SYSTEM_PROMPT,
  validateFeedback,
  type AnalysisInput,
} from "./analysis.js";

const request: AnalysisInput = {
  presentation: {
    title: "Safer streets for everyone",
    audience: "City councillors",
    purpose: "Persuade the council to improve road safety",
    keyPoints: ["Add protected cycle lanes"],
    desiredDurationMinutes: 2,
    tone: "Persuasive but respectful",
  },
  transcript: "protected cycle lanes help families travel more safely",
  statistics: {
    durationSeconds: 90,
    wordCount: 8,
    wordsPerMinute: 5.33,
    fillerWords: {},
  },
  intendedSpeech: "Protected lanes make safer journeys for children and families.",
};

const validFeedback = {
  formattedTranscript: "Protected cycle lanes help families travel more safely.",
  overallAssessment: "A focused attempt.",
  planningAssessment: "The plan is focused on a relevant outcome for councillors.",
  executionAssessment: "The transcript connects protected lanes with safer travel.",
  strengths: [{ title: "Clear benefit", explanation: "You connect the idea to safety.", evidence: "travel more safely" }],
  improvements: [{
    title: "Develop the case",
    explanation: "The transcript does not explain how the lanes help.",
    evidence: "Protected cycle lanes",
    recommendation: "Add one concrete example.",
  }],
  keyPointCoverage: [{
    keyPoint: "Add protected cycle lanes",
    status: "partial",
    explanation: "The transcript names the lanes but does not explain the proposal.",
  }],
  nextSteps: ["Add one example."],
  suggestedRewrite: "Protected cycle lanes can help families travel more safely.",
};

test("requires and preserves planning and execution assessments", () => {
  const result = validateFeedback(validFeedback, request);
  assert.equal(typeof result, "object");
  if (typeof result === "string") return;
  assert.equal(result.planningAssessment, validFeedback.planningAssessment);
  assert.equal(result.executionAssessment, validFeedback.executionAssessment);
  assert.deepEqual(result.keyPointCoverage, [{
    ...validFeedback.keyPointCoverage[0],
    keyPoint: request.presentation.keyPoints[0],
  }]);
});

test("rejects a formatted transcript that changes or drops original words", () => {
  assert.equal(
    validateFeedback({ ...validFeedback, formattedTranscript: "Protected lanes help families travel safely." }, request),
    "formattedTranscript changed or omitted words from the original transcript",
  );
  assert.equal(
    validateFeedback({ ...validFeedback, formattedTranscript: undefined }, request),
    "missing formattedTranscript",
  );
});

test("short transcript fallback preserves the original transcript as formattedTranscript", async () => {
  const { analyseSpeech } = await import("./analysis.js");
  const shortRequest = { ...request, transcript: "um hello" };
  const result = await analyseSpeech(shortRequest);
  assert.equal(result.formattedTranscript, shortRequest.transcript);
  assert.ok(result.planningAssessment);
  assert.ok(result.executionAssessment);
});

test("rejects missing or blank planning and execution assessments", () => {
  assert.equal(validateFeedback({ ...validFeedback, planningAssessment: undefined }, request), "missing planningAssessment");
  assert.equal(validateFeedback({ ...validFeedback, planningAssessment: "  " }, request), "missing planningAssessment");
  assert.equal(validateFeedback({ ...validFeedback, executionAssessment: undefined }, request), "missing executionAssessment");
  assert.equal(validateFeedback({ ...validFeedback, executionAssessment: "  " }, request), "missing executionAssessment");
});

test("builds a prompt containing the prepared script, transcript and server statistics", () => {
  const message = buildUserMessage(request);
  assert.match(message, /<intended_speech>[\s\S]*Protected lanes make safer journeys for children and families\.[\s\S]*<\/intended_speech>/);
  assert.match(message, /<transcript>[\s\S]*protected cycle lanes help families travel more safely[\s\S]*<\/transcript>/);
  assert.match(message, /Desired duration: 2 min/);
  assert.match(message, /Actual duration: 1 min 30 s/);
  assert.match(message, /Key points to cover[\s\S]*Add protected cycle lanes/);
  assert.match(message, /Words per minute: 5/);
});

test("prompt separates plan quality from execution and limits claims to text evidence", () => {
  assert.match(COACH_SYSTEM_PROMPT, /planningAssessment evaluates the plan itself/i);
  assert.match(COACH_SYSTEM_PROMPT, /executionAssessment evaluates the actual attempt/i);
  assert.match(COACH_SYSTEM_PROMPT, /cannot be determined from text alone/i);
  assert.match(COACH_SYSTEM_PROMPT, /Do not infer vocal confidence, enthusiasm, pitch, emotion/i);
  assert.match(COACH_SYSTEM_PROMPT, /preserve the original words in the same order/i);
  assert.match(COACH_SYSTEM_PROMPT, /including repeated words and fillers/i);
  assert.match(COACH_SYSTEM_PROMPT, /formattedTranscript is only for display/i);
});
