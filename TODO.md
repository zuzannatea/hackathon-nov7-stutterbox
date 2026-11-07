# TODO.md --- Stutterbox Hackathon Checklist

> **Team rule:** `PROJECT.md` and `AGENTS.md` are the source of truth
> for product scope and engineering conventions. This checklist
> coordinates today's work.
>
> **Schedule:** Code freeze 4:00 · Submit by 5:00 · Hard deadline 6:00.
>
> Tick items as they are completed. Push small, working changes
> regularly.

## 0. Important decisions and conflict resolution

This plan is adapted from the team's proposed `PLAN.md`. Where the two
plans conflict, the existing Stutterbox project plan takes priority.

### Decisions we are keeping

-   Three parallel workstreams: frontend, backend, and AI.
-   Build against agreed data contracts and use mock data while
    integrations are unfinished.
-   Keep the first version small and prioritise a complete demo.
-   Test the full user journey before the code freeze.
-   Keep API keys out of GitHub.
-   Cut stretch goals if the core flow is at risk.

### Decisions that are overridden

-   **Live transcription:** Use the browser Web Speech API
    (`SpeechRecognition`, with `webkitSpeechRecognition` fallback where
    needed) to display words while the user speaks. Collect finalised
    recognition results into a complete transcript when the user stops.
    Interim results are provisional and must not be appended repeatedly.
    The browser submits the final transcript and duration to the backend;
    no audio upload or server-side transcription is required for the MVP.
    Test the intended demo browser early because support varies and the
    recognition service may be remote.
-   **Backend architecture:** Use the existing Node + Express +
    TypeScript backend. Do not create a separate Vercel serverless
    `api/` architecture or duplicate endpoints.
-   **Main endpoint:** Use `POST /api/analyze`, not a separate
    `/api/feedback` endpoint. The backend receives the final transcript,
    presentation context, and duration; it calculates statistics and
    calls Claude for analysis.
-   **AI input:** AI analysis receives the presentation context,
    transcript, statistics, and optional inspiration text---not just a
    prebuilt `session` and `results` object.
-   **Statistics:** Calculate measurable statistics in backend
    application code. Key-point coverage should be semantic AI analysis,
    not just a percentage of intended words found in the transcript.
-   **Deployment and storage:** No database or progress-storage feature
    is required for the MVP. Do not spend early time on Vercel
    deployment or localStorage history. Deploy only after the local
    end-to-end flow works and only if time allows.
-   **Framework/language:** Keep the existing React + TypeScript + Vite
    client and Express + TypeScript server. Do not convert files to
    `.jsx` or `.js` just to match the other plan.

## 1. Team ownership

  --------------------------------------------------------------------------------
  Member                  Workstream              Primary ownership
  ----------------------- ----------------------- --------------------------------
  **Member 1**            Frontend                `client/src/`, React UI, Web Speech API,
                                                  live/final transcript, timer,
                                                  frontend API client, results UI

  **Member 2**            Backend                 `server/index.ts`, `POST /api/analyze`,
                                                  JSON validation, transcript handling,
                                                  statistics, error handling, orchestration

  **Member 3**            AI integration          Claude SDK, prompts, AI analysis service,
                                                  feedback schema, model response parsing
  --------------------------------------------------------------------------------

**Collaboration rule:** Work primarily in your owned files. Agree on
interfaces before integration. If a shared contract or another person's
file needs to change, tell the owner and coordinate the change rather
than silently editing it.

## 2. Shared contracts --- agree before parallel implementation

Keep these shapes aligned across frontend, backend, and AI. Put shared
types in the existing project structure where the team agrees; do not
create duplicate competing definitions.

### Presentation context

``` ts
interface Presentation {
  title: string;
  audience: string;
  purpose: string;
  keyPoints: string[];
  desiredDurationMinutes: number;
  tone: string;
}
```

### Speech statistics

``` ts
interface SpeechStatistics {
  durationSeconds: number;
  wordCount: number;
  wordsPerMinute: number;
  fillerWords: Record<string, number>;
  sentenceCount: number;
}
```

### AI analysis input

``` ts
interface AnalysisRequest {
  presentation: Presentation;
  transcript: string;
  statistics: SpeechStatistics;
  inspiration?: string;
}
```

### Main HTTP request

`POST /api/analyze` using `application/json`:

-   `transcript`: complete final transcript assembled by the frontend
-   `presentation`: `Presentation` object
-   `durationSeconds`: elapsed presentation duration measured by the frontend
-   `inspiration`: optional text

The backend performs the following sequence (Member 2 owns these steps):

1.  Validate the request, presentation, transcript, and duration.
2.  Calculate statistics from the transcript and duration.
3.  Call Member 3's AI analysis service through the agreed function
    interface, passing an `AnalysisRequest`.
4.  Combine the returned feedback with the transcript and statistics,
    then return the agreed response.

Member 3 owns the implementation of the AI analysis service and the
Claude-specific prompt / response handling. Member 2 owns the Express
route and calls that service; Member 2 should not implement a second
Claude client or duplicate Member 3's AI logic.

The frontend uses Web Speech API for live/interim display and stores
finalised recognition results for the final transcript. Do not send
interim text as the final transcript or upload audio to the backend in
this MVP. The API key for Claude remains in the backend environment.

### Response shape

``` ts
interface AnalysisResponse {
  transcript: string;
  statistics: SpeechStatistics;
  feedback: {
    overallAssessment: string;
    strengths: Array<{
      title: string;
      explanation: string;
      evidence?: string;
    }>;
    improvements: Array<{
      title: string;
      explanation: string;
      evidence?: string;
      recommendation: string;
    }>;
    keyPointCoverage: Array<{
      keyPoint: string;
      status: "covered" | "partial" | "missing";
      explanation: string;
    }>;
    nextSteps: string[];
    suggestedRewrite?: string;
  };
}
```

If the team simplifies this response to meet the deadline, update all
three workstreams together. Do not let each person invent a different
shape.

------------------------------------------------------------------------

## 3. Timeline and shared milestones

### 11:00--11:20 --- Setup and coordination

-   [x] Create the React + TypeScript + Vite frontend.
-   [x] Create the Express + TypeScript backend.
-   [x] Confirm the frontend and backend run locally.
-   [x] Confirm Vite proxy works (`/api/health` returns
    `{ "status": "ok" }`).
-   [x] Create the GitHub repository and push the initial code.
-   [ ] Add all team members as GitHub collaborators and confirm they
    can clone/push.
-   [ ] Add `PROJECT.md`, `AGENTS.md`, and this `TODO.md` to the
    repository.
-   [ ] Confirm the shared contracts in section 2.
-   [ ] Member 3: arrange access to an API key and confirm API
    billing/access works. Coordinate backend environment setup with
    Member 2; never commit the key.
-   [ ] Agree who will integrate and resolve conflicts near the merge
    checkpoints.

### 11:20--1:00 --- Build the MVP pieces in parallel

**Goal by 1:00:** frontend can display live speech-recognition text;
backend accepts a transcript and produces statistics; AI service can
analyse sample text independently.

-   [ ] Member 1: build presentation-context form.
-   [ ] Member 1: implement browser Web Speech API recognition
    (`SpeechRecognition` / `webkitSpeechRecognition`) with continuous
    recognition and interim results.
-   [ ] Member 1: display live interim text and accumulate finalised
    results without duplicating words.
-   [ ] Member 1: show listening state, elapsed-time timer, stop control,
    and useful microphone/unsupported-browser/error messages.
-   [ ] Member 1: confirm the full final transcript remains available
    after recognition stops; add manual transcript fallback if time allows.
-   [ ] Member 1: build results screen using mock `AnalysisResponse`
    data.
-   [ ] Member 1: implement the API client function for
    `POST /api/analyze` (integration can wait).
-   [x] Member 2: create `POST /api/analyze` using JSON request parsing
    (no audio upload or server-side transcription).
-   [x] Member 2: validate presentation, transcript, duration, optional
    inspiration, malformed JSON, and request size.
-   [x] Member 2: implement `calculateSpeechStatistics` in
    `server/services/statistics.ts` and confirm the server TypeScript
    build succeeds.
-   [x] Member 2: review the statistics edge cases and accept the MVP
    limitations recorded in `PROJECT.md` and `AGENTS.md`.
-   [x] Member 2: calculate statistics on the server and return a safe
    unavailable response while Member 3's analysis service is missing.
    Do not return mock feedback.
-   [ ] Member 3: define the AI feedback schema and prompt.
-   [ ] Member 3: implement the agreed AI service function (for example,
    `analyseSpeech({ presentation, transcript, statistics, inspiration })`
    matching the backend `AnalyseSpeech` type and returning `Feedback`,
    using the Anthropic Claude SDK and a backend-only
    `ANTHROPIC_API_KEY`. Agree the exact export and file location with
    Member 2 before implementation.
-   [ ] Member 3: test the prompt with at least three different sample
    transcripts.
-   [ ] Member 3: ensure feedback is specific, constructive, and
    grounded in transcript evidence.
-   [ ] Everyone: commit and push working increments.

### 1:00--1:30 --- First integration checkpoint

**Goal by 1:30:** the browser displays live speech recognition, produces
a complete transcript, and submits it to the backend for statistics. AI
can be temporarily mocked if necessary.

-   [ ] Member 1 + Member 2: connect the final transcript submission to
    `POST /api/analyze`.
-   [ ] Member 1 + Member 2: verify final transcript submission and
    statistics end to end.
-   [ ] Member 2 + Member 3: connect Member 2's route to Member 3's
    AI service using the agreed function interface. Member 2 owns the
    route; Member 3 owns the AI service implementation.
-   [ ] Everyone: resolve request/response type mismatches.
-   [ ] Everyone: test one complete request using a short live speech.
-   [ ] Agree on a fallback if browser speech recognition or the Claude
    API is unavailable.

### 1:30--3:15 --- Complete the experience and improve reliability

**Goal by 3:15:** complete local user journey, useful feedback, and no
critical integration blockers.

**Member 1 --- Frontend**

- \[ \] Improve form layout and validation.
- \[ \] Add a clear listening state, elapsed-time timer, and stop control.
- \[ \] Show live interim transcript text and preserve finalised results.
- \[ \] Add results cards for duration, word count, WPM, and filler words.
- \[ \] Display the complete transcript, strengths, improvements, key-point coverage, and next steps.
- \[ \] Add a clear "Try again" action.
- \[ \] Make the UI readable at presentation/projector size and on a narrow screen.
- \[ \] Show understandable errors for microphone permission, unsupported speech recognition, recognition interruption, and failed analysis.

**Member 2 --- Backend**

- \[x\] Implement deterministic statistics and review edge cases; accepted limitations are recorded in the project docs.
- \[x\] Implement `POST /api/analyze` with malformed-JSON handling and validation for transcript, presentation data, duration, and optional inspiration.
- \[x\] Calculate statistics from submitted transcript/duration; never trust client-supplied statistics.
- \[x\] Return useful status codes and safe error messages, including a clear unavailable response while Member 3's AI service is missing.
- \[x\] Add a 30-second AI-service timeout with safe `504` handling and retain safe `502` handling for ordinary failures.
- \[x\] Test service success, timeout, provider failure, validation/statistics preservation, and server responsiveness after timeout.
- \[ \] Coordinate possible `AbortSignal` support with Member 3; the current timeout does not cancel an in-flight provider request.
- \[ \] Read Member 3's AI service through the agreed interface and
  handle its returned result/errors; do not implement Claude calls here.
- \[ \] Help integrate and debug the complete flow.

**Member 3 --- AI**

- \[ \] Ensure output follows the agreed response schema.
- \[ \] Validate or safely parse the model response.
- \[ \] Make coverage statuses explicit: `covered`, `partial`, or `missing`.
- \[ \] Require examples/evidence from the transcript for improvement feedback where possible.
- \[ \] Avoid generic advice and unsupported claims about confidence, emotion, tone, or vocal variety.
- \[ \] Add a friendly fallback if the Claude call fails or times out.
- \[ \] Provide Member 2 with the agreed callable AI-service interface
  and response type; support integration without taking ownership of
  the Express route or frontend.

**Everyone**

- \[ \] Test at least three different sample speeches.
- \[ \] Fix critical bugs before adding stretch features.
- \[ \] Push integrated changes to GitHub regularly.

### 3:15--4:00 --- Polish and code freeze

-   [ ] Freeze feature development at 4:00.
-   [ ] Test the full flow from a fresh page load.
-   [ ] Test microphone permission granted and denied.
-   [ ] Test live interim text and final transcript assembly.
-   [ ] Test a short speech and a longer speech.
-   [ ] Test unsupported browser/recognition errors, missing input, and
    Claude API failure behaviour.
-   [ ] Check that no API key or `.env` file is tracked by Git.
-   [ ] Check the browser console and backend terminal for critical
    errors.
-   [ ] Fix only bugs that affect the demo or submission.
-   [ ] Capture screenshots for the README/slides.
-   [ ] Confirm the demo laptop/browser and microphone work.

### 4:00--5:00 --- Submission preparation

-   [ ] Prepare slides: problem, solution, how it works, demo, and next
    steps.
-   [ ] Prepare and rehearse a concise demo script.
-   [ ] Add setup instructions and screenshots to `README.md`.
-   [ ] Add the live link if deployment is ready and verified.
-   [ ] Record a backup demo video.
-   [ ] Verify the submission requirements and submitted files/links.
-   [ ] **Submit by 5:00.**

### 5:00--6:00 --- Emergency buffer only

-   [ ] Do not start new features.
-   [ ] Fix only submission-blocking or demo-breaking issues.
-   [ ] Keep a known-good local version available.
-   [ ] Confirm the submission was received before the hard deadline.

------------------------------------------------------------------------

## 4. Stretch goals --- only after the MVP works

Do these in order of likely value. Stop as soon as they threaten
stability or the deadline.

-   [ ] Highlight detected filler words in the transcript.
-   [ ] Show repeated words, excluding common stopwords.
-   [ ] Add a simple volume meter using the Web Audio API. Label it as
    an input-level indicator, not a confidence or speaking-quality
    score.
-   [ ] Add an AI rewrite of one weak section.
-   [ ] Accept optional inspirational text and ask the AI to identify
    transferable rhetorical techniques.
-   [ ] Compare a second attempt with the first.
-   [ ] Save session history in localStorage (only if there is time and
    a clear demo benefit).
-   [ ] Deploy the finished app (only after local integration works).

## 5. Fallback plan

-   **Browser speech recognition unavailable:** use a clearly labelled
    demo transcript or a manual text-entry fallback. Do not pretend it
    came from the microphone.
-   **AI analysis unavailable:** show deterministic statistics and
    prewritten, clearly labelled general tips. Mention AI analysis as
    unavailable in the demo rather than fabricating AI output.
-   **Microphone/speech recognition unreliable:** use a clearly labelled
    pasted transcript for the demo. Do not imply that it was transcribed
    live.
-   **AI integration blocked:** use a clearly labelled frontend-only
    fixture for UI development if needed. The backend must not return
    fabricated feedback as an analysis result.
-   **A task is blocked for more than 20--30 minutes:** tell the team,
    reduce scope, and agree on a fallback instead of silently losing
    time.
-   **At 3:15:** no new architecture or major features. Stabilise the
    complete flow.

## 6. Final demo checklist

-   [ ] The app opens successfully.
-   [ ] The user can enter the topic, audience, purpose, and key points.
-   [ ] The user can speak into the microphone and see live words, or use
    the documented demo fallback.
-   [ ] The app retains and displays the complete final transcript.
-   [ ] The app displays real, correctly labelled statistics.
-   [ ] The app provides useful feedback tied to the intended key points
    and transcript.
-   [ ] The app gives the user clear next steps.
-   [ ] Errors do not leave the app stuck or crash the demo.
-   [ ] No secrets are exposed in the repository or browser.
-   [ ] The team can explain the architecture and limitations honestly.
