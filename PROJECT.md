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
-   Browser-based audio recording.
-   Upload of the recording to the backend.
-   Speech-to-text transcription.
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

-   Real-time, live coaching while the user speaks.
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
-   Browser `MediaRecorder` API for recording
-   CSS for styling

### Backend

-   Node.js
-   Express
-   TypeScript
-   Multer for receiving multipart audio uploads
-   OpenAI official JavaScript SDK
-   dotenv for local environment configuration

### AI workflow

1.  Receive the audio file and presentation context.
2.  Transcribe the audio using an OpenAI audio transcription model
    available to the project.
3.  Calculate deterministic statistics in application code where
    practical.
4.  Send the presentation context, transcript, statistics, and optional
    inspiration text to an OpenAI text model.
5.  Request structured feedback that the frontend can render
    consistently.
6.  Validate the response before returning it to the frontend.

Model names should be configured centrally rather than scattered through
the code. Confirm model availability and API requirements against
current OpenAI documentation when implementing.

### Data and persistence

The hackathon MVP does not require a database. Keep the current attempt
in frontend state and process uploads in memory or temporary storage as
appropriate. Do not retain recordings longer than needed for the
request.

## 7. High-level architecture

``` text
React frontend
    |
    | multipart/form-data
    | audio + presentation context + optional inspiration
    v
Express backend
    |
    +--> Audio transcription
    |
    +--> Deterministic statistics
    |
    +--> AI feedback analysis
    |
    v
Validated JSON response
    |
    v
React results dashboard
```

The frontend should not call OpenAI directly. All API calls that use the
secret API key must happen on the backend.

## 8. API contract

The intended main endpoint is:

`POST /api/analyze`

Request: `multipart/form-data`

-   `audio`: recorded audio file
-   `presentation`: JSON-encoded presentation details
-   `inspiration`: optional text

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

Suggested internal analysis input:

``` ts
interface AnalysisRequest {
  presentation: Presentation;
  transcript: string;
  statistics: SpeechStatistics;
  inspiration?: string;
}
```

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

## 9. Quality requirements

-   The user must be able to understand what to do next at every stage.
-   Recording should have clear start, stop, and recording-state
    feedback.
-   Show recording duration and enforce a sensible maximum length for
    the demo.
-   Handle microphone permission denial and unsupported browsers
    gracefully.
-   Handle empty or invalid recordings.
-   Show useful errors if upload, transcription, or analysis fails.
-   Validate incoming request data and uploaded file type/size on the
    backend.
-   Never expose the OpenAI API key to the browser.
-   Do not log API keys, raw secrets, or unnecessary personal
    audio/transcript data.
-   Keep AI output structured and validate it before rendering.
-   Use accessible labels, readable contrast, and keyboard-operable
    controls.

## 10. Hackathon implementation priorities

Recommended order:

1.  Make the frontend and backend communicate.
2.  Build the presentation-context form.
3.  Implement recording and playback/recording-state controls.
4.  Upload audio to the backend.
5.  Get a real transcript from the transcription API.
6.  Calculate basic statistics.
7.  Generate structured feedback.
8.  Render the results clearly.
9.  Test the full flow with several short recordings.
10. Add a stretch goal only if time remains.

A working end-to-end demonstration is more valuable than several
disconnected features.

## 11. Definition of done

The MVP is ready to demonstrate when a user can:

-   enter presentation context and key points;
-   record a short speech in the browser;
-   submit the recording successfully;
-   receive a transcript and basic statistics;
-   receive feedback grounded in the transcript and intended key points;
    and
-   understand at least one concrete action to improve the next attempt.

The team should test the entire flow from a fresh page load, not only
individual functions.

## 12. Open decisions

Record decisions here as the implementation progresses:

-   Maximum recording duration:
-   Supported audio formats:
-   Exact transcription model:
-   Exact analysis model:
-   Final feedback schema:
-   Whether inspiration text is included in the demo:
-   Whether a second-attempt comparison is feasible:
