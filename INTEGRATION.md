# Stutterbox integration guide

This guide records the current contracts for connecting the frontend,
backend, and AI analysis service. The backend route and statistics service
are implemented. The frontend analysis flow and Claude service are not yet
connected.

## 1. Current status and source of truth

- The HTTP request and response are implemented in
  `server/routes/analyze.ts`; validation limits and error handling there
  are authoritative.
- `SpeechStatistics` is exported from `server/services/statistics.ts`.
- The backend currently mounts `createAnalyzeRouter()` without an AI
  service, so every valid analysis request returns `503` until Member 3's
  function is connected.
- `client/src/App.tsx` currently checks only `/api/health`. There is no
  frontend analysis request client or results UI yet.
- The Vite development server proxies `/api` to `http://localhost:3000`;
  the frontend can use relative paths such as `/api/analyze`.

## 2. Member 1: HTTP contract

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
  "inspiration": "Optional reference text"
}
```

`inspiration` is optional. Do not send audio or client-calculated
statistics. The backend calculates statistics from `transcript` and
`durationSeconds`.

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

Successful response JSON (once the AI service is connected):

```json
{
  "transcript": "Hello team. Our goal is to improve access.",
  "statistics": {
    "durationSeconds": 30,
    "wordCount": 8,
    "wordsPerMinute": 16,
    "fillerWords": {},
    "sentenceCount": 2
  },
  "feedback": {
    "overallAssessment": "The speech states a clear goal and stays concise.",
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

The statistics example follows the current whitespace-token word count and
punctuation sentence count. WPM is not rounded. Filler counts and sentence
counts have the documented transcript-based limitations in `PROJECT.md`.

The results UI should handle each HTTP error below and display
`response.error` when present rather than assuming every response is a
success object.

## 3. Member 3: AI service contract

The backend exports these types from `server/routes/analyze.ts`:

```ts
export type AnalyseSpeech = (input: AnalysisRequest) => Promise<Feedback>;
```

`AnalysisRequest` contains:

```ts
interface AnalysisRequest {
  presentation: Presentation;
  transcript: string;
  statistics: SpeechStatistics;
  inspiration?: string;
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
  sentenceCount: number;
}
```

The function must return the `Feedback` shape used in the successful
response above: `overallAssessment`, `strengths`, `improvements`,
`keyPointCoverage`, `nextSteps`, and optional `suggestedRewrite`. Coverage
statuses are exactly `covered`, `partial`, or `missing`. Member 3 owns
Claude calls, prompt design, and runtime validation of Claude's output.
The function should reject/throw on API failure or invalid model output;
the route converts a thrown error to a safe `502` response.

Member 3 should tell Member 2 the importable function name and file path.
Member 2 then imports that function and passes it to
`createAnalyzeRouter(analyseSpeech)` in `server/index.ts`. The Anthropic
SDK and `ANTHROPIC_API_KEY` setup belong to Member 3; the key must remain
backend-only. Do not change the route or shared types without coordinating
with Member 2 and Member 1.

## 4. Error responses

Errors are JSON objects with an `error` string.

| Status | Current cause | Example |
|---|---|---|
| `400 Bad Request` | Non-object body, missing/empty transcript, invalid presentation, invalid duration/inspiration, or malformed JSON | `{"error":"Transcript cannot be empty."}` |
| `413 Payload Too Large` | Request exceeds 1 MB, or transcript exceeds 20,000 characters | `{"error":"Request body is too large."}` |
| `502 Bad Gateway` | Connected `AnalyseSpeech` function throws or rejects | `{"error":"Speech analysis failed. Please try again."}` |
| `503 Service Unavailable` | Current state: no AI service passed to the route | `{"error":"AI analysis is not available yet. Please try again later."}` |
| `500 Internal Server Error` | Unexpected backend error | `{"error":"An unexpected server error occurred."}` |

The current `503` is expected while Member 3's service is not connected;
it does not mean the request was invalid. The frontend should explain that
analysis is temporarily unavailable and allow a retry.

## 5. Integration checklist

### Member 1 + Member 2

- [ ] Submit a final transcript with the exact JSON fields above through
  the Vite `/api` proxy.
- [ ] Verify the backend ignores any extra client-supplied statistics
  and returns its own calculated statistics.
- [ ] Verify success rendering for transcript, statistics, all feedback
  collections, every coverage status, and optional rewrite.
- [ ] Verify loading, empty-input, `400`, `413`, `502`, `503`, and network
  failure states.
- [ ] Check transcript and presentation field limits and ensure elapsed
  duration is greater than zero.
- [ ] Test the final transcript from Web Speech API results; do not submit
  provisional interim text as the final transcript.

### Member 2 + Member 3

- [ ] Confirm Member 3's exported function satisfies
  `AnalyseSpeech = (input: AnalysisRequest) => Promise<Feedback>`.
- [ ] Pass the real function to `createAnalyzeRouter` and confirm valid
  requests no longer return `503`.
- [ ] Verify the AI function receives the exact presentation, final
  transcript, server-calculated statistics, and optional inspiration.
- [ ] Test representative Claude output and verify the full response
  schema, including coverage enums and optional fields.
- [ ] Make Claude/API errors and invalid model output reject safely and
  produce the route's generic `502`; confirm no key or internal details
  appear in the response.

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
