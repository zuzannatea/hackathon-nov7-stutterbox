import assert from "node:assert/strict";
import { once } from "node:events";
import { type AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import test from "node:test";
import express from "express";
import {
  AnalysisProviderError,
  AnalysisUnavailableError,
} from "../services/analysisErrors.js";
import {
  createAnalyzeRouter,
  type AnalyseSpeech,
  type AnalysisResult,
  type AnalysisRequest,
} from "./analyze.js";

const presentation = {
  title: "A short talk",
  audience: "The team",
  purpose: "Share an update",
  keyPoints: ["Progress"],
  desiredDurationMinutes: 2,
  tone: "Clear",
};

const requestBody = {
  presentation,
  transcript: "um hello lets start",
  durationSeconds: 30,
};

const feedback: AnalysisResult = {
  formattedTranscript: "Um, hello, let's start.",
  overallAssessment: "A clear update.",
  planningAssessment: "The plan is clear for the intended audience.",
  executionAssessment: "The transcript explains the key point.",
  strengths: [],
  improvements: [],
  keyPointCoverage: [],
  nextSteps: [],
};

interface RunningServer {
  server: Server;
  baseUrl: string;
}

async function startTestServer(
  analyseSpeech?: AnalyseSpeech,
  timeoutMs?: number,
): Promise<RunningServer> {
  const app = express();
  app.use(express.json());
  app.use("/api/analyze", createAnalyzeRouter(analyseSpeech, timeoutMs));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopTestServer(server: Server): Promise<void> {
  const closed = new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  server.closeAllConnections();
  await closed;
}

test("returns feedback and unchanged server-calculated statistics before timeout", async () => {
  let receivedInput: AnalysisRequest | undefined;
  const analyseSpeech: AnalyseSpeech = async (input) => {
    receivedInput = input;
    return feedback;
  };
  const { server, baseUrl } = await startTestServer(analyseSpeech, 1_000);
  try {
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.transcript, requestBody.transcript);
    assert.equal(result.formattedTranscript, feedback.formattedTranscript);
    assert.equal(result.feedback.formattedTranscript, undefined);
    assert.deepEqual(result.feedback, {
      overallAssessment: feedback.overallAssessment,
      planningAssessment: feedback.planningAssessment,
      executionAssessment: feedback.executionAssessment,
      strengths: feedback.strengths,
      improvements: feedback.improvements,
      keyPointCoverage: feedback.keyPointCoverage,
      nextSteps: feedback.nextSteps,
    });
    assert.deepEqual(result.statistics, {
      durationSeconds: 30,
      wordCount: 4,
      wordsPerMinute: 8,
      fillerWords: { um: 1 },
    });
    assert.deepEqual(receivedInput, {
      presentation,
      transcript: requestBody.transcript,
      statistics: result.statistics,
    });
  } finally {
    await stopTestServer(server);
  }
});

test("passes optional intendedSpeech to the AI service", async () => {
  let receivedInput: AnalysisRequest | undefined;
  const analyseSpeech: AnalyseSpeech = async (input) => {
    receivedInput = input;
    return feedback;
  };
  const { server, baseUrl } = await startTestServer(analyseSpeech, 1_000);
  const intendedSpeech = "The script I planned to deliver.";

  try {
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...requestBody, intendedSpeech }),
    });

    assert.equal(response.status, 200);
    assert.equal(receivedInput?.intendedSpeech, intendedSpeech);
  } finally {
    await stopTestServer(server);
  }
});

test("rejects invalid intendedSpeech values with 400 before calling AI", async () => {
  let callCount = 0;
  const analyseSpeech: AnalyseSpeech = async () => {
    callCount += 1;
    return feedback;
  };
  const { server, baseUrl } = await startTestServer(analyseSpeech, 1_000);

  try {
    for (const intendedSpeech of [42, "x".repeat(20_001)]) {
      const response = await fetch(`${baseUrl}/api/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...requestBody, intendedSpeech }),
      });

      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), {
        error: "intendedSpeech must be text of 20000 characters or fewer.",
      });
    }

    assert.equal(callCount, 0);
  } finally {
    await stopTestServer(server);
  }
});

test("returns 504 at timeout while server stays responsive and work continues", async () => {
  let completedAfterTimeout = false;
  const slowService: AnalyseSpeech = async () => {
    await new Promise((resolve) => setTimeout(resolve, 80));
    completedAfterTimeout = true;
    throw new AnalysisUnavailableError();
  };
  const { server, baseUrl } = await startTestServer(slowService, 10);

  try {
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const body = await response.json();

    assert.equal(response.status, 504);
    assert.deepEqual(body, { error: "Speech analysis timed out. Please try again." });
    assert.equal(completedAfterTimeout, false);

    const healthResponse = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthResponse.status, 200);
    assert.deepEqual(await healthResponse.json(), { status: "ok" });

    await new Promise((resolve) => setTimeout(resolve, 90));
    assert.equal(completedAfterTimeout, true);
  } finally {
    await stopTestServer(server);
  }
});

test("maps AnalysisUnavailableError to a safe 503", async () => {
  const unavailableService: AnalyseSpeech = async () => {
    throw new AnalysisUnavailableError();
  };
  const { server, baseUrl } = await startTestServer(unavailableService, 1_000);

  try {
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.deepEqual(body, { error: "AI analysis is not available yet. Please try again later." });
  } finally {
    await stopTestServer(server);
  }
});

test("maps AnalysisProviderError to a safe 502", async () => {
  const providerFailure: AnalyseSpeech = async () => {
    throw new AnalysisProviderError();
  };
  const { server, baseUrl } = await startTestServer(providerFailure, 1_000);

  try {
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const body = await response.json();

    assert.equal(response.status, 502);
    assert.deepEqual(body, { error: "Speech analysis failed. Please try again." });
  } finally {
    await stopTestServer(server);
  }
});

test("maps unexpected AI-service errors to a safe 502", async () => {
  const failingService: AnalyseSpeech = async () => {
    throw new Error("provider secret detail");
  };
  const { server, baseUrl } = await startTestServer(failingService, 1_000);

  try {
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const body = await response.json();

    assert.equal(response.status, 502);
    assert.deepEqual(body, { error: "Speech analysis failed. Please try again." });
  } finally {
    await stopTestServer(server);
  }
});

test("keeps validation errors and missing-service 503 behavior", async () => {
  let callCount = 0;
  const service: AnalyseSpeech = async () => {
    callCount += 1;
    return feedback;
  };
  const { server, baseUrl } = await startTestServer(service, 1_000);

  try {
    const invalidResponse = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...requestBody, transcript: "  " }),
    });
    assert.equal(invalidResponse.status, 400);
    assert.equal(callCount, 0);
  } finally {
    await stopTestServer(server);
  }

  const { server: missingServer, baseUrl: missingBaseUrl } = await startTestServer();
  try {
    const response = await fetch(`${missingBaseUrl}/api/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    assert.equal(response.status, 503);
  } finally {
    await stopTestServer(missingServer);
  }
});
