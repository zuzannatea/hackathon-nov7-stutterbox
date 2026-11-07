# Stutterbox --- Project Brief

## 1. Overview

**Stutterbox** is a web-based speech and presentation coach. It helps a
user practise a speech, compare what they intended to say with what they
actually said, and receive specific, actionable feedback.

The user provides information about their presentation, records a short
practice attempt, and receives an analysis based on the transcript and
measurable speech statistics.

The product should feel like a supportive coach: clear, constructive,
specific, and encouraging rather than judgemental.

## 2. Problem

Preparing a speech is not only about writing good content. Speakers also
need to practise communicating it clearly, staying on topic, covering
the intended points, and managing their time.

It can be difficult to evaluate your own delivery objectively.
Stutterbox aims to make practice more useful by showing the speaker what
worked, what was missed, and what to try next.

## 3. Target user and use cases

The initial target user is someone preparing a short presentation,
speech, pitch, class presentation, or public-speaking exercise.

Typical flow:

1.  Describe the presentation and its purpose.
2.  Add the key points the speech should cover.
3.  Optionally provide an example speech or text whose rhetorical
    techniques they admire.
4.  Record a short practice attempt.
5.  Receive a transcript, basic speech statistics, and AI-generated
    feedback.
6.  Use the feedback to improve and practise again.

## 4. MVP scope

The hackathon MVP should prioritise one complete, reliable end-to-end
flow over a large feature set.

### Required

-   A form for presentation context:
    -   title or topic
    -   audience
    -   purpose
    -   key points to cover
    -   desired duration
    -   preferred tone (if useful)
-   Browser-based live speech recognition using the Web Speech API, with words displayed while the user speaks.
-   A complete final transcript assembled from recognition results when the user stops.
-   Submission of the final transcript and presentation context to the backend for analysis; no audio upload is required for the MVP.
-   Basic statistics calculated from the recording/transcript:
    -   recording duration
    -   word count
    -   words per minute
    -   selected filler-word counts
    -   sentence count, if practical
-   AI analysis comparing the intended content with the transcript.
-   Results screen showing:
    -   concise overall assessment
    -   strengths
    -   areas to improve, supported by examples from the transcript
    -   key-point coverage (covered, partially covered, or missing)
    -   a short list of actionable recommendations
-   Clear loading, empty, and error states.

### Optional stretch goals

Only attempt these after the complete MVP works:

-   Accept an inspirational speech or excerpt and identify techniques
    the user could adapt.
-   Suggest a rewritten version of one weak or unclear section.
-   Allow a second practice attempt and compare it with the first.
-   Provide additional transcript navigation or timestamps, if supported
    by the transcription output.

### Explicitly out of scope for the hackathon MVP

-   AI-generated coaching or feedback while the user speaks (live transcription is in scope; live analysis is not).
-   Speaker identification or multi-speaker diarisation.
-   Facial-expression, posture, or body-language analysis.
-   Reliable emotion, confidence, enthusiasm, or vocal-variety scoring.
-   User accounts, authentication, persistent user profiles, or a
    database.
-   Payments, deployment infrastructure, or production-scale file
    storage.
-   Complex editing of audio or transcripts.

Do not add features at the expense of the core recording-to-feedback
flow.

## 5. Important product and AI limitations

The first version primarily analyses a transcript and basic recording
metadata.

A transcript can support analysis of wording, structure, clarity,
relevance, key-point coverage, repetition, and some filler words. It
cannot, by itself, reliably establish vocal confidence, enthusiasm,
pitch variation, tone, pace variation, or emotional delivery.

Do not present unsupported impressions as objective measurements. If an
audio-derived measure is not implemented and validated, omit it or label
it clearly as an estimate.

Feedback must be constructive, concrete, and grounded in the user's
actual transcript. Avoid generic advice that could apply to any speech.

The system should distinguish between: - **Observed evidence:**
something directly visible in the transcript or calculated statistics. -
**Interpretation:** a reasoned assessment based on that evidence. -
**Suggestion:** a practical action the speaker can take.

## 6. Proposed technology

### Frontend

-   React
-   TypeScript
-   Vite
-   Browser Web Speech API (`SpeechRecognition`, with the
    `webkitSpeechRecognition` fallback where needed) for live speech-to-text
-   A frontend timer to measure the presentation duration
-   CSS for styling

### Backend

-   Node.js
-   Express
-   TypeScript
-   `express.json()` for receiving the transcript and presentation data
-   Anthropic official TypeScript/JavaScript SDK for Claude analysis
-   dotenv for local environment configuration

### AI workflow

1.  The browser starts speech recognition and displays interim words
    while the user speaks.
2.  The frontend collects finalised recognition results into a complete
    transcript. Interim results are provisional and must not be appended
    repeatedly to the final transcript.
3.  When the user stops, the frontend sends the final transcript,
    presentation context, recording duration, and optional inspiration
    text to the Express backend.
4.  The backend calculates deterministic statistics in application code
    where practical.
5.  The backend sends the presentation context, transcript, statistics,
    and optional inspiration text to Claude.
6.  Request structured feedback that the frontend can render
    consistently, validate the response, and return it to the frontend.

Keep the Claude API key on the backend in `ANTHROPIC_API_KEY`. Configure
the Claude model centrally rather than scattering its name through the
code. Confirm model availability and API requirements against current
Anthropic documentation when implementing. The frontend must never call
Claude directly.

The Web Speech API has uneven browser support and may rely on a remote
browser/vendor speech-recognition service; it should not be described as
necessarily offline or fully private. Test the exact demo browser early
(Chrome is the intended first test target). Provide a clear unsupported-
browser/error state and, if time permits, a manual transcript fallback.
Speech recognition can mishear words or omit disfluencies, so transcript
accuracy and filler-word statistics are estimates rather than guaranteed
measurements.

### Data and persistence

The hackathon MVP does not require a database. Keep the current attempt
and transcript in frontend state. The backend receives transcript text,
not raw audio, and does not need to retain the transcript after returning
the analysis response.

## 7. High-level architecture

``` text
React frontend
    |
    +--> Web Speech API (live interim + final speech results)
    |
    +--> Assemble complete transcript + measure duration
    |
    | JSON: transcript + presentation + duration + optional inspiration
    v
Express backend
    |
    +--> Deterministic statistics
    |
    +--> Claude analysis (server-side API call)
    |
    v
Validated JSON response
    |
    v
React results dashboard
```

The frontend handles speech recognition; the backend does not receive raw
audio in the MVP. The frontend must not call Claude directly. All API
calls that use the secret API key must happen on the backend.

## 8. API contract

The intended main endpoint is:

`POST /api/analyze`

Request: `application/json`

-   `transcript`: complete final transcript assembled by the browser
    speech-recognition client
-   `presentation`: `Presentation` object
-   `durationSeconds`: elapsed presentation duration measured by the frontend
-   `inspiration`: optional text

The backend validates this payload, caps the JSON body at 1 MB and the
transcript at 20,000 characters, and calculates statistics itself. The
route is implemented, but Member 3's callable Claude analysis service is
not yet available in the repository; valid requests currently receive a
safe `503 Service Unavailable` response until that integration is added.

Example presentation object:

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

Suggested internal statistics type:

``` ts
interface SpeechStatistics {
  durationSeconds: number;
  wordCount: number;
  wordsPerMinute: number;
  fillerWords: Record<string, number>;
  sentenceCount: number;
}
```

The statistics service is implemented in `server/services/statistics.ts`
and has passed the backend TypeScript build. Its MVP rules count
whitespace-separated words, punctuation-based sentences, and the
case-insensitive fillers `um`, `uh`, `erm`, and `er`. Invalid or
non-positive durations normalize to zero. The team reviewed and accepted
these limitations: abbreviations, decimals, and punctuation patterns can
affect sentence counts; literal uses of filler terms may be counted;
very short durations can produce unusually high WPM; and WPM is not
rounded. Do not expand sentence segmentation without a demonstrated MVP
need.

Suggested internal analysis input:

``` ts
interface AnalysisRequest {
  presentation: Presentation;
  transcript: string;
  statistics: SpeechStatistics;
  inspiration?: string;
}
```

The backend route exports the integration boundary
`AnalyseSpeech = (input: AnalysisRequest) => Promise<Feedback>`, where
`Feedback` is the response's `feedback` object below. Member 3 should
provide a function matching this contract; the route does not implement
Claude calls or substitute placeholder feedback.

Successful response shape:

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

Treat this as the target contract, not a reason to over-engineer. If the
team changes the contract, update the frontend, backend, and AI
implementation together.

### Team ownership and integration boundaries

The three team members have separate primary responsibilities. Keep these
boundaries clear so that parallel work does not create overlapping
implementations.

- **Member 1 — Frontend only:** owns the React interface, presentation
  form, browser Web Speech API integration, live/interim transcript
  display, final transcript assembly, recording controls and timer,
  results dashboard, frontend API client, and user-facing loading/error
  states. Member 1 does not implement Express routes or Claude calls.
- **Member 2 — Backend only:** owns the Express backend and
  `POST /api/analyze`, JSON request parsing, request validation,
  transcript handling, deterministic speech statistics, backend error
  handling, and orchestration of the request. Member 2 calls Member 3's
  agreed AI service; Member 2 does not implement Claude prompts or make
  direct Claude SDK calls.
- **Member 3 — AI integration only:** owns the Claude integration,
  prompts, AI analysis function/service, feedback schema, and parsing /
  validation of the model's response. Member 3 exposes an agreed
  function or service for Member 2 to call and does not redesign the
  Express route or take ownership of the frontend.

**Integration rule:** agree the request, response, and AI-service
interfaces before parallel implementation. Member 2 owns the HTTP route
and invokes Member 3's service. Member 3 owns the implementation behind
that service boundary. Member 1 consumes the HTTP response and renders
it. Coordinate any shared-type changes with all affected owners.

## 9. Quality requirements

-   The user must be able to understand what to do next at every stage.
-   Recording should have clear start, stop, and recording-state
    feedback.
-   Show recording duration and enforce a sensible maximum length for
    the demo.
-   Handle microphone permission denial and unsupported browsers
    gracefully.
-   Handle empty transcripts, speech-recognition errors, unsupported browsers, and recognition ending unexpectedly.
-   Show useful errors if speech recognition or analysis fails.
-   Validate incoming JSON request data and reasonable transcript length on the backend.
-   Never expose the Anthropic API key to the browser.
-   Do not log API keys, raw secrets, or unnecessary personal
    audio/transcript data.
-   Keep AI output structured and validate it before rendering.
-   Use accessible labels, readable contrast, and keyboard-operable
    controls.

## 10. Hackathon implementation priorities

Recommended order:

1.  Make the frontend and backend communicate.
2.  Build the presentation-context form.
3.  Implement browser speech recognition and live transcript display.
4.  Assemble the complete transcript and measure elapsed duration.
5.  Send transcript and presentation data to the backend.
6.  Calculate basic statistics.
7.  Generate structured feedback with Claude.
8.  Render the transcript, statistics, and results clearly.
9.  Test the full flow with several short speeches in the intended browser.
10. Add a stretch goal only if time remains.

A working end-to-end demonstration is more valuable than several
disconnected features.

## 11. Definition of done

The MVP is ready to demonstrate when a user can:

-   enter presentation context and key points;
-   speak into the browser microphone and see words appear while speaking;
-   stop and receive a complete final transcript;
-   submit the transcript successfully for analysis;
-   receive basic statistics;
-   receive feedback grounded in the transcript and intended key points;
    and
-   understand at least one concrete action to improve the next attempt.

The team should test the entire flow from a fresh page load, not only
individual functions.

## 12. Open decisions

Record decisions here as the implementation progresses:

-   Maximum recording duration:
-   Supported demo browser for Web Speech API: Chrome (test/confirm)
-   Exact Claude analysis model:
-   Final feedback schema:
-   Whether inspiration text is included in the demo:
-   Whether a second-attempt comparison is feasible:
