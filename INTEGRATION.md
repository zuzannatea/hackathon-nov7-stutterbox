# Stutterbox integration guide

This guide records the current contracts for connecting the frontend,
backend, and AI analysis service. The backend route and statistics service
are implemented. The frontend analysis flow is not connected yet. Member 3's
Claude service is connected to the Express route. Live Claude-backed feedback
still requires a configured API key and provider verification.

## 1. Current status and source of truth

- The HTTP request and response are implemented in
  `server/routes/analyze.ts`; validation limits and error handling there
  are authoritative.
- `SpeechStatistics` is exported from `server/services/statistics.ts`.
- `server/index.ts` injects `analyseSpeech` into `createAnalyzeRouter`.
  Short transcripts return the AI service's deterministic short-speech
  feedback without calling Claude.
- With a longer transcript, missing AI configuration returns `503`, provider
  or unexpected service failures return `502`, and the route deadline returns
  `504`.
- `client/src/services/speechRecognition.ts` provides a standalone Web
  Speech API utility. It is not yet wired into the React app.
- `client/src/App.tsx` currently checks only `/api/health`. There is no
  frontend analysis request client or results UI yet.
- The Vite development server proxies `/api` to `http://localhost:3000`;
  the frontend can use relative paths such as `/api/analyze`.

## 2. Member 1: speech recognition and HTTP contract

### Web Speech API utility

The utility is exported from
`client/src/services/speechRecognition.ts`. It does not depend on React or
render UI. Its factory signature is:

```ts
createSpeechRecognition(
  callbacks?: SpeechRecognitionCallbacks,
  options?: SpeechRecognitionOptions,
): SpeechRecognitionController
```

The exported `SpeechRecognitionCallbacks` names and arguments are:

```ts
interface SpeechRecognitionCallbacks {
  onInterimTranscript?: (transcript: string) => void;
  onFinalTranscript?: (segment: string, completeTranscript: string) => void;
  onStateChange?: (
    state: "starting" | "listening" | "ended",
    finalTranscript: string,
  ) => void;
  onError?: (failure: SpeechRecognitionFailure) => void;
  onEnd?: (finalTranscript: string) => void;
}
```

`SpeechRecognitionFailure` contains `code`, optional `message`, and
`finalTranscript`. Its code is the browser's `SpeechRecognitionErrorCode`
or one of `unsupported`, `start-failed`, `stop-failed`, or `abort-failed`.
`SpeechRecognitionOptions` accepts `language`, `continuous`, and
`interimResults`; defaults are `en-US`, `true`, and `true`.

The returned controller has this API:

```ts
interface SpeechRecognitionController {
  readonly isSupported: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  getFinalTranscript(): string;
}
```

The utility prefers `window.SpeechRecognition` and falls back to
`window.webkitSpeechRecognition`. If neither is available,
`isSupported` is false and calling `start()` reports an `unsupported`
failure through `onError`.

Interim transcript callbacks contain only provisional text. It may be
revised by later recognition events and must be used for live display
only. Final results are accumulated by result index so repeat result
events do not append duplicate text. `onFinalTranscript` receives the
newly finalized segment and the complete finalized transcript so far.
`getFinalTranscript()` returns that complete finalized transcript at any
time; it excludes provisional text. `onEnd` also receives the final
transcript after recognition ends.

`start()` creates no additional recognition instance: one instance is
created when the factory is called. Calling `start()` while it is active
does nothing and does not reset its transcript. Starting after it has
ended starts a new session and clears the previous finalized transcript.
`stop()` asks recognition to stop and the final end callback arrives when
the browser ends the session. `abort()` asks recognition to abort but
does not clear already-finalized text. On recognition errors and
unexpected end events, finalized text remains available from
`getFinalTranscript()` and is included in the error/end callback data.

There is no separate `dispose()` or callback-detachment method. If the
React owner unmounts during recognition, call `abort()` and guard its
callbacks from updating unmounted component state; aborting may still
lead to browser end/error callbacks.

Example integration pattern (adapt callbacks to Member 1's component
state; this is not an existing component API):

```ts
const recognition = createSpeechRecognition(
  {
    onInterimTranscript: setInterimTranscript,
    onFinalTranscript: (_segment, transcript) => setFinalTranscript(transcript),
    onStateChange: (state, transcript) => {
      setRecognitionState(state);
      if (state === "starting") setFinalTranscript(transcript);
    },
    onError: (failure) => {
      setSpeechError(failure.code);
      setFinalTranscript(failure.finalTranscript);
    },
    onEnd: setFinalTranscript,
  },
  { language: "en-US" },
);

recognition.start();
// Later, when the user stops:
recognition.stop();
// The current finalized text is also synchronously retrievable:
const transcript = recognition.getFinalTranscript();
```

Keep the controller instance stable across React renders (for example, in a
ref); recreating it creates a new recognition instance and a new transcript
session. The frontend should measure elapsed duration separately. When
speech ends, use the finalized transcript and measured duration in the
backend JSON request below. Do not upload audio or submit interim text as
the final transcript.

### Backend HTTP contract

Send the final transcript, not interim Web Speech API text. Send JSON to:

```http
POST /api/analyze
Content-Type: application/json
```

Request JSON:

```json
{
  "presentation": {
    "title": "Improving access to public transport",
    "audience": "City council members",
    "purpose": "Persuade the council to improve access",
    "keyPoints": [
      "Improve access for wheelchair users"
    ],
    "desiredDurationMinutes": 2,
    "tone": "Persuasive and clear"
  },
  "transcript": "Hello team. Our goal is to improve access.",
  "durationSeconds": 30,
  "inspiration": "Optional reference text",
  "intendedSpeech": "Optional prepared script"
}
```

`inspiration` and `intendedSpeech` are optional. Omit an empty prepared
script; `intendedSpeech` is limited to 20,000 characters. Do not send audio
or client-calculated statistics. The backend calculates statistics from
`transcript` and `durationSeconds`.

Validation constraints in the current route:

- `transcript`: required, non-whitespace text, at most 20,000 characters.
- `durationSeconds`: required finite number greater than zero. The timer
  should not submit a zero-length attempt.
- `presentation`: required object. `title`, `audience`, `purpose`, and
  `tone` must be non-empty strings no longer than 500 characters.
  `keyPoints` must contain 1–20 non-empty strings, each no longer than
  500 characters. `desiredDurationMinutes` must be a finite positive
  number.
- `inspiration`: optional string, at most 5,000 characters.
- Total JSON body: at most 1 MB.

Illustrative successful AI response shape (live Claude-backed output has not
yet been verified):

```json
{
  "transcript": "Hello team. Our goal is to improve access.",
  "formattedTranscript": "Hello, team. Our goal is to improve access.",
  "statistics": {
    "durationSeconds": 30,
    "wordCount": 8,
    "wordsPerMinute": 16,
    "fillerWords": {}
  },
  "feedback": {
    "overallAssessment": "The speech states a clear goal and stays concise.",
    "planningAssessment": "The title, audience, purpose and key point form a focused plan.",
    "executionAssessment": "The transcript states the goal; the actual delivery cannot be judged from text.",
    "strengths": [
      {
        "title": "Clear purpose",
        "explanation": "The goal is stated directly.",
        "evidence": "Our goal is to improve access."
      }
    ],
    "improvements": [
      {
        "title": "Add a concrete example",
        "explanation": "The transcript does not explain what improved access would involve.",
        "evidence": "Our goal is to improve access.",
        "recommendation": "Add one specific barrier and the change that would address it."
      }
    ],
    "keyPointCoverage": [
      {
        "keyPoint": "Improve access for wheelchair users",
        "status": "partial",
        "explanation": "Access is mentioned, but wheelchair users are not named."
      }
    ],
    "nextSteps": [
      "Add a specific example of an access barrier."
    ],
    "suggestedRewrite": "Our goal is to make public transport easier to use for wheelchair users."
  }
}
```

The backend calculates statistics from the original `transcript` and uses
that original for analysis and evidence validation. `formattedTranscript`
is display-only and must preserve every word in order. WPM is not rounded;
filler counts have the documented transcript-based limitations in
`PROJECT.md`.

The results UI should handle each HTTP error below and display
`response.error` when present rather than assuming every response is a
success object.

## 3. Member 3: AI service contract

The backend exports these types from `server/routes/analyze.ts`:

```ts
export type AnalyseSpeech = (input: AnalysisRequest) => Promise<AnalysisResult>;
```

`AnalysisResult` contains all `Feedback` fields plus `formattedTranscript`.
The route moves `formattedTranscript` to the top level of the HTTP response.

`AnalysisRequest` contains:

```ts
interface AnalysisRequest {
  presentation: Presentation;
  transcript: string;
  statistics: SpeechStatistics;
  inspiration?: string;
  intendedSpeech?: string;
}
```

`SpeechStatistics` must be imported from
`server/services/statistics.ts`; it contains exactly:

```ts
interface SpeechStatistics {
  durationSeconds: number;
  wordCount: number;
  wordsPerMinute: number;
  fillerWords: Record<string, number>;
}
```

The function must return the `Feedback` shape used in the successful
response above: `overallAssessment`, `planningAssessment`,
`executionAssessment`, `strengths`, `improvements`, `keyPointCoverage`,
`nextSteps`, and optional `suggestedRewrite`. Coverage
statuses are exactly `covered`, `partial`, or `missing`. Member 3 owns
Claude calls, prompt design, and runtime validation of Claude's output.
`server/services/analysis.ts` exports `analyseSpeech` and uses
`AnalysisUnavailableError` and `AnalysisProviderError` from
`server/services/analysisErrors.ts` for failures. Short transcripts still
return legitimate feedback without calling Claude.

The function is imported by `server/index.ts` and passed to
`createAnalyzeRouter(analyseSpeech)`. The Anthropic SDK and
`ANTHROPIC_API_KEY` setup belong to Member 3; the key must remain
backend-only. Do not change the shared API types without coordinating with
Member 1 and Member 3.

## 4. Error responses

Errors are JSON objects with an `error` string.

| Status | Current cause | Example |
|---|---|---|
| `400 Bad Request` | Non-object body, missing/empty transcript, invalid presentation, invalid duration/inspiration, or malformed JSON | `{"error":"Transcript cannot be empty."}` |
| `413 Payload Too Large` | Request exceeds 1 MB, or transcript exceeds 20,000 characters | `{"error":"Request body is too large."}` |
| `502 Bad Gateway` | `AnalysisProviderError` or unexpected service failure | `{"error":"Speech analysis failed. Please try again."}` |
| `504 Gateway Timeout` | AI analysis does not settle within the route timeout (30 seconds by default) | `{"error":"Speech analysis timed out. Please try again."}` |
| `503 Service Unavailable` | `AnalysisUnavailableError` (for example, missing API key); also returned if no service is injected | `{"error":"AI analysis is not available yet. Please try again later."}` |
| `500 Internal Server Error` | Unexpected backend error | `{"error":"An unexpected server error occurred."}` |

The route checks its timeout before mapping service errors, preserving `504`
when its 30-second deadline wins. The frontend should explain unavailable
analysis and allow a retry; it should display `response.error` for all error
statuses.

The Anthropic SDK timeout is 35 seconds with retries disabled, while the
route responds at 30 seconds. This bounds an uncancelled provider operation
to roughly five seconds after a route timeout. The `AnalyseSpeech` interface
does not pass an `AbortSignal`, so the route cannot cancel the underlying
request at its deadline.

## 5. Backend verification commands

Start the backend in one terminal:

```sh
cd server
npm run dev
```

In another terminal, run the route-level tests and the HTTP integration
script from `server/`:

```sh
cd server
npm run build
npm test
npm run test:integration
```

`npm test` runs `tsx --test routes/analyze.test.ts`. The timeout test
injects a short timeout so it does not wait for the 30-second production
default.

`npm run test:integration` sends HTTP requests to the running Express
server. It covers health, request validation, malformed and oversized
JSON, and a short-transcript `200` response with deterministic feedback.
The short transcript does not call Claude, so this test does not spend API
credit. Set `BASE_URL` to target another server,
for example `BASE_URL=http://localhost:3000 npm run test:integration`.
This script does not start or stop the server. It reports an actionable
message and exits if the server cannot be reached.

Route tests use injected fake services for success, typed error mappings,
unexpected failures, and the timeout path. These tests do not call Claude.
The separate `npm run test:ai` script performs real provider requests when
`ANTHROPIC_API_KEY` is configured and may use API credit; it is not part of
the deterministic test suite.

## 6. Integration checklist

### Member 1 + Member 2

- [ ] Submit a final transcript with the exact JSON fields above through
  the Vite `/api` proxy.
- [ ] Verify the backend ignores any extra client-supplied statistics
  and returns its own calculated statistics.
- [ ] Verify success rendering for transcript, statistics, all feedback
  collections, every coverage status, and optional rewrite.
- [ ] Verify loading, empty-input, `400`, `413`, `502`, `503`, `504`, and network
  failure states.
- [ ] Check transcript and presentation field limits and ensure elapsed
  duration is greater than zero.
- [ ] Test the final transcript from Web Speech API results; do not submit
  provisional interim text as the final transcript.

### Member 2 + Member 3

- [x] Confirm Member 3's exported function satisfies
  `AnalyseSpeech = (input: AnalysisRequest) => Promise<AnalysisResult>`.
- [x] Pass the real function to `createAnalyzeRouter`; the deterministic
  HTTP test exercises the short-transcript response without calling Claude.
- [x] Verify the route passes presentation, transcript, and server-calculated
  statistics to its injected analysis function.
- [ ] Test representative Claude output and verify the full response
  schema, including coverage enums and optional fields.
- [x] Verify `AnalysisUnavailableError` maps to `503`, `AnalysisProviderError`
  and unexpected failures map to `502`, and timeout maps to `504`; confirm no
  raw error details appear in HTTP responses.

### Whole flow

- [ ] Run frontend and backend together from a fresh page load.
- [ ] Complete a browser speech attempt and verify its final transcript,
  positive duration, backend statistics, and Claude feedback reach the
  results screen.
- [ ] Repeat with empty/short input, an unsupported or failing speech
  recognition browser state, and an AI failure.
- [ ] Confirm no audio file is uploaded and no Anthropic key is sent to
  the browser.

Do not describe the complete app as integrated until the real frontend
request/results flow and Member 3's Claude service both pass these checks.

## Speech generation (Step 1 "Generate a speech")

Added by Member 1 with the team's agreement; route and prompt owners should review.

- Route: `server/routes/generateSpeech.ts`, mounted at `POST /api/generate-speech`.
- Service: `server/services/speechGeneration.ts` (Claude call and system prompt). It uses
  `ANTHROPIC_API_KEY` and its own model setting `ANTHROPIC_SPEECH_MODEL`
  (default `claude-sonnet-5-5`, separate from the analysis model), `effort: "low"`,
  no retries, and the server-side refusal fallback (`fallbacks: "default"`).
- Request: `{ "brief": string }`, trimmed, 1–3,000 characters.
- Response: `{ "speech": string }`, plain text with paragraphs separated by blank lines.
- Errors (`{ "error": string }`): `400` invalid or too long, `422` the model declined,
  `502` provider failure, `503` no API key configured, `504` over the 45-second deadline.
- The generated speech is frontend-only after this call: it becomes the Step 1 speech
  text, exactly like an uploaded document. It is not added to `/api/analyze`.
