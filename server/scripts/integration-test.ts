const baseUrl = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const JSON_LIMIT_BYTES = 1_048_576;

interface TestResult {
  name: string;
  passed: boolean;
}

const results: TestResult[] = [];

const presentation = {
  title: "Improving access to public transport",
  audience: "City council members",
  purpose: "Persuade the council to improve access",
  keyPoints: ["Improve access for wheelchair users"],
  desiredDurationMinutes: 2,
  tone: "Persuasive and clear",
};

const validRequest = {
  presentation,
  transcript: "Um, hello council members. We can improve access for wheelchair users.",
  durationSeconds: 35,
  inspiration: "Optional reference text",
};

function report(name: string, passed: boolean, detail?: string): void {
  results.push({ name, passed });
  const label = passed ? "PASS" : "FAIL";
  console.log(`${label} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function sendJson(body: unknown): Promise<Response> {
  return fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function checkResponse(
  name: string,
  expectedStatus: number,
  request: () => Promise<Response>,
  validateBody: (body: unknown) => boolean = () => true,
): Promise<void> {
  try {
    const response = await request();
    const body: unknown = await response.json().catch(() => null);
    const statusMatches = response.status === expectedStatus;
    const bodyMatches = validateBody(body);

    report(
      name,
      statusMatches && bodyMatches,
      statusMatches && bodyMatches
        ? undefined
        : `expected HTTP ${expectedStatus}, got ${response.status}; body: ${JSON.stringify(body)}`,
    );
  } catch (error) {
    report(name, false, error instanceof Error ? error.message : String(error));
  }
}

async function checkHealth(name: string): Promise<void> {
  await checkResponse(
    name,
    200,
    () => fetch(`${baseUrl}/api/health`),
    (body) =>
      typeof body === "object" &&
      body !== null &&
      "status" in body &&
      body.status === "ok",
  );
}

async function main(): Promise<void> {
  try {
    const response = await fetch(`${baseUrl}/api/health`);
    if (!response.ok) {
      console.error(
        `Cannot run integration tests: backend at ${baseUrl} returned HTTP ${response.status} from /api/health. Start it with: cd server && npm run dev`,
      );
      process.exitCode = 1;
      return;
    }
  } catch {
    console.error(
      `Cannot reach backend at ${baseUrl}. Start it in another terminal with: cd server && npm run dev`,
    );
    process.exitCode = 1;
    return;
  }

  await checkHealth("GET /api/health returns healthy status");

  await checkResponse(
    "Missing transcript is rejected",
    400,
    () => sendJson({ presentation, durationSeconds: 35 }),
    (body) =>
      typeof body === "object" && body !== null && "error" in body &&
      body.error === "A transcript is required.",
  );

  await checkResponse(
    "Empty transcript is rejected",
    400,
    () => sendJson({ ...validRequest, transcript: "" }),
    (body) =>
      typeof body === "object" && body !== null && "error" in body &&
      body.error === "Transcript cannot be empty.",
  );

  await checkResponse(
    "Whitespace-only transcript is rejected",
    400,
    () => sendJson({ ...validRequest, transcript: " \n\t " }),
    (body) =>
      typeof body === "object" && body !== null && "error" in body &&
      body.error === "Transcript cannot be empty.",
  );

  await checkResponse(
    "Invalid presentation is rejected",
    400,
    () => sendJson({ ...validRequest, presentation: { title: "" } }),
    (body) =>
      typeof body === "object" && body !== null && "error" in body &&
      body.error === "Presentation details are missing or invalid.",
  );

  await checkResponse(
    "Invalid zero duration is rejected",
    400,
    () => sendJson({ ...validRequest, durationSeconds: 0 }),
    (body) =>
      typeof body === "object" && body !== null && "error" in body &&
      body.error === "durationSeconds must be a positive finite number.",
  );

  await checkResponse(
    "Transcript over 20,000 characters is rejected",
    413,
    () => sendJson({ ...validRequest, transcript: "Long speech. ".repeat(1_600) }),
    (body) =>
      typeof body === "object" && body !== null && "error" in body &&
      body.error === "Transcript must be 20000 characters or fewer.",
  );

  await checkResponse(
    "Malformed JSON is rejected safely",
    400,
    () =>
      fetch(`${baseUrl}/api/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"transcript": ',
      }),
    (body) =>
      typeof body === "object" && body !== null && "error" in body &&
      body.error === "Request body contains invalid JSON.",
  );
  await checkHealth("Health endpoint responds after malformed JSON");

  const oversizedBody = JSON.stringify({ padding: "x".repeat(JSON_LIMIT_BYTES) });
  if (Buffer.byteLength(oversizedBody, "utf8") <= JSON_LIMIT_BYTES) {
    report("Oversized test fixture exceeds the 1 MB parser limit", false);
  } else {
    await checkResponse(
      "JSON body over 1 MB is rejected safely",
      413,
      () =>
        fetch(`${baseUrl}/api/analyze`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: oversizedBody,
        }),
      (body) =>
        typeof body === "object" && body !== null && "error" in body &&
        body.error === "Request body is too large.",
    );
  }
  await checkHealth("Health endpoint responds after oversized JSON");

  await checkResponse(
    "Valid request receives expected 503 while AI service is missing",
    503,
    () => sendJson(validRequest),
    (body) =>
      typeof body === "object" && body !== null && "error" in body &&
      body.error === "AI analysis is not available yet. Please try again later.",
  );

  await checkHealth("Health endpoint responds after all integration requests");

  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;
  console.log(`\nIntegration test summary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

await main();
