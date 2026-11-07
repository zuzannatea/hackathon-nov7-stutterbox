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

-   **Recording/transcription:** Use browser `MediaRecorder` to record
    audio, then upload the audio to the Express backend for
    transcription. Do not make browser `SpeechRecognition` / live
    transcription the primary path. Browser speech recognition has
    inconsistent support and would bypass the planned transcription
    pipeline.
-   **Backend architecture:** Use the existing Node + Express +
    TypeScript backend. Do not create a separate Vercel serverless
    `api/` architecture or duplicate endpoints.
-   **Main endpoint:** Use `POST /api/analyze`, not a separate
    `/api/feedback` endpoint. The backend should orchestrate
    transcription, statistics, and AI analysis in one request.
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
  **Member 1**            Frontend                `client/src/`, recording UI,
                                                  presentation form, results UI,
                                                  styling

  **Member 2**            Backend                 `server/index.ts`, routes,
                                                  upload handling, transcription,
                                                  statistics

  **Member 3**            AI                      `server/services/analysis.ts`,
                                                  prompts, AI response schema and
                                                  validation
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

`POST /api/analyze` using `multipart/form-data`:

-   `audio`: recorded audio file
-   `presentation`: JSON-encoded `Presentation`
-   `inspiration`: optional text

The backend performs the following sequence:

1.  Validate the request and audio file.
2.  Transcribe the audio.
3.  Calculate statistics.
4.  Call the AI analysis service with `AnalysisRequest`.
5.  Validate and return the combined result.

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
    billing/access works. Never commit the key.
-   [ ] Agree who will integrate and resolve conflicts near the merge
    checkpoints.

### 11:20--1:00 --- Build the MVP pieces in parallel

**Goal by 1:00:** frontend works with mock results; backend can accept
audio and produce a transcript/statistics; AI service can analyse sample
text independently.

-   [ ] Member 1: build presentation-context form.
-   [ ] Member 1: build recording component with `MediaRecorder`.
-   [ ] Member 1: show recording state, elapsed time, stop control, and
    useful permission/error messages.
-   [ ] Member 1: build results screen using mock `AnalysisResponse`
    data.
-   [ ] Member 1: implement the API client function for
    `POST /api/analyze` (integration can wait).
-   [ ] Member 2: create `POST /api/analyze` route and Multer upload
    handling.
-   [ ] Member 2: parse and validate presentation form data.
-   [ ] Member 2: implement transcription service using the OpenAI audio
    transcription API.
-   [ ] Member 2: implement deterministic statistics: duration, word
    count, WPM, filler-word counts, and sentence count where practical.
-   [ ] Member 2: return a temporary/mock feedback object until Member
    3's service is ready.
-   [ ] Member 3: define the AI feedback schema and prompt.
-   [ ] Member 3: implement
    `analyseSpeech({ presentation, transcript, statistics, inspiration })`.
-   [ ] Member 3: test the prompt with at least three different sample
    transcripts.
-   [ ] Member 3: ensure feedback is specific, constructive, and
    grounded in transcript evidence.
-   [ ] Everyone: commit and push working increments.

### 1:00--1:30 --- First integration checkpoint

**Goal by 1:30:** a recording can travel from the browser to the backend
and produce a real transcript and statistics. AI can be temporarily
mocked if necessary.

-   [ ] Member 1 + Member 2: connect the recording form to
    `POST /api/analyze`.
-   [ ] Member 2: verify audio upload, transcription, and statistics end
    to end.
-   [ ] Member 3: connect the AI service to the backend route, or agree
    a precise integration point.
-   [ ] Everyone: resolve request/response type mismatches.
-   [ ] Everyone: test one complete request using a short sample
    recording.
-   [ ] Agree on a fallback if the transcription or AI API is
    unavailable.

### 1:30--3:15 --- Complete the experience and improve reliability

**Goal by 3:15:** complete local user journey, useful feedback, and no
critical integration blockers.

**Member 1 --- Frontend** - \[ \] Improve form layout and validation. -
\[ \] Add recording timer and clear recording/upload/analysis states. -
\[ \] Add results cards for duration, word count, WPM, and filler
words. - \[ \] Display transcript. - \[ \] Display strengths,
improvements, key-point coverage, and next steps. - \[ \] Add a clear
"Try again" action. - \[ \] Make the UI readable at
presentation/projector size and on a narrow screen. - \[ \] Show
understandable errors for microphone permission, unsupported recording,
and failed analysis.

**Member 2 --- Backend** - \[ \] Handle empty transcript and
zero-duration edge cases. - \[ \] Validate audio file presence, type,
and size. - \[ \] Return useful status codes and safe error messages. -
\[ \] Ensure temporary audio files/buffers are not retained
unnecessarily. - \[ \] Add sensible request timeout/error handling where
practical. - \[ \] Confirm API key is read only from backend environment
variables. - \[ \] Help integrate and debug the complete flow.

**Member 3 --- AI** - \[ \] Ensure output follows the agreed response
schema. - \[ \] Validate or safely parse the model response. - \[ \]
Make coverage statuses explicit: `covered`, `partial`, or `missing`. -
\[ \] Require examples/evidence from the transcript for improvement
feedback where possible. - \[ \] Avoid generic advice and unsupported
claims about confidence, emotion, tone, or vocal variety. - \[ \] Add a
friendly fallback if the AI call fails or times out. - \[ \] Hand the
working AI service to Member 2 for route integration and Member 1 for
display.

**Everyone** - \[ \] Test at least three different sample speeches. - \[
\] Fix critical bugs before adding stretch features. - \[ \] Push
integrated changes to GitHub regularly.

### 3:15--4:00 --- Polish and code freeze

-   [ ] Freeze feature development at 4:00.
-   [ ] Test the full flow from a fresh page load.
-   [ ] Test microphone permission granted and denied.
-   [ ] Test a short recording and a longer recording.
-   [ ] Test missing/empty input and API failure behaviour.
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

-   **Transcription API unavailable:** use a clearly labelled demo
    transcript or a text-entry fallback. Do not pretend it came from the
    microphone.
-   **AI analysis unavailable:** show deterministic statistics and
    prewritten, clearly labelled general tips. Mention AI analysis as
    unavailable in the demo rather than fabricating AI output.
-   **Microphone/recording unreliable:** use a pre-recorded sample audio
    file or a clearly labelled pasted transcript for the demo.
-   **Integration blocked:** use the agreed mock `AnalysisResponse` so
    the frontend demo remains presentable.
-   **A task is blocked for more than 20--30 minutes:** tell the team,
    reduce scope, and agree on a fallback instead of silently losing
    time.
-   **At 3:15:** no new architecture or major features. Stabilise the
    complete flow.

## 6. Final demo checklist

-   [ ] The app opens successfully.
-   [ ] The user can enter the topic, audience, purpose, and key points.
-   [ ] The user can record a short speech or use the documented demo
    fallback.
-   [ ] The app produces a transcript.
-   [ ] The app displays real, correctly labelled statistics.
-   [ ] The app provides useful feedback tied to the intended key points
    and transcript.
-   [ ] The app gives the user clear next steps.
-   [ ] Errors do not leave the app stuck or crash the demo.
-   [ ] No secrets are exposed in the repository or browser.
-   [ ] The team can explain the architecture and limitations honestly.
