# Member 3 — AI Integration Handoff

## 1. Purpose

This document describes the backend integration requirements for Member 3, who is responsible for implementing the AI-powered speech analysis using the Claude API.

The backend API and statistics service have already been implemented by Member 2. The remaining task is to implement the AI analysis service and connect it to the existing backend route.

**The main objective:** provide a function that receives presentation information, a transcript, and calculated speech statistics, then returns structured AI feedback.

---

## 2. Team responsibilities

The team has divided the work into three separate areas:

| Member | Responsibility |
|---|---|
| Member 1 | Frontend: React UI, Web Speech API, transcript capture and results display |
| Member 2 | Backend: Express API, request validation, statistics, routing and integration |
| Member 3 | AI integration: Claude API, prompts, analysis and feedback generation |

### Your responsibility as Member 3

You own:
- Claude API integration.
- Prompt engineering and analysis instructions.
- Sending presentation information and transcript data to Claude.
- Processing and validating Claude's response.
- Returning feedback in the agreed TypeScript structure.
- Handling AI-specific errors.

You do not need to:
- Implement or redesign Express routes.
- Implement speech recognition.
- Calculate speech statistics.
- Build frontend components.
- Handle audio recording or audio transcription.

Please coordinate with Member 2 before changing any shared interfaces.

---

## 3. Current architecture

The application uses the following architecture:

1. The frontend captures speech using the browser's Web Speech API.
2. The frontend sends the final transcript and presentation details to the backend as JSON.
3. The backend validates the request.
4. The backend calculates speech statistics.
5. The backend passes the transcript, presentation details and statistics to your AI analysis service.
6. Your service calls Claude and returns structured feedback.
7. The backend combines the feedback with the transcript and statistics.
8. The frontend displays the results.

**Important:** Claude must only be called from the backend. Never expose the Anthropic API key to the frontend.

The frontend sends text, not audio files. There is no audio upload or server-side transcription step in the current architecture.

---

## 4. Your required integration interface

Member 2 has implemented the route with the following integration boundary:

```ts
type AnalyseSpeech = (
  input: AnalysisRequest
) => Promise<Feedback>;
```

Your service must provide a function compatible with this type.

The exact interface definitions in `server/routes/analyze.ts` are the source of truth. Please inspect that file before implementing your service and coordinate with Member 2 if anything differs from the definitions below.

### Input: AnalysisRequest

The service receives:

```ts
interface AnalysisRequest {
  presentation: Presentation;
  transcript: string;
  statistics: SpeechStatistics;
  inspiration?: string;
}
```

The presentation information is:

```ts
interface Presentation {
  title: string;
  audience: string;
  purpose: string;
  keyPoints: string[];
  desiredDurationMinutes: number;
  tone: string;
}
```

The statistics are calculated by Member 2's backend service. The exported
`SpeechStatistics` type in `server/services/statistics.ts` is the source of
truth; use it directly rather than redefining or adding fields to it:

```ts
interface SpeechStatistics {
  durationSeconds: number;
  wordCount: number;
  wordsPerMinute: number;
  fillerWords: Record<string, number>;
  sentenceCount: number;
}
```

### What the input means

| Field | Purpose |
|---|---|
| `presentation.title` | Presentation topic or title |
| `presentation.audience` | Intended audience |
| `presentation.purpose` | What the speaker wants to achieve |
| `presentation.keyPoints` | Points the presentation should cover |
| `presentation.desiredDurationMinutes` | Intended presentation length |
| `presentation.tone` | Desired communication style |
| `transcript` | Final speech transcript |
| `statistics` | Server-calculated speech statistics |
| `inspiration` | Optional additional context or reference material |

Use all relevant presentation context when evaluating the transcript. For example, a presentation intended to persuade an audience should be assessed differently from one intended to explain a technical topic.

---

## 5. Required output: Feedback

Your service must return a `Feedback` object with the following structure:

```ts
interface Feedback {
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
}
```

### Expected meaning of each field

**`overallAssessment`**

A concise overall evaluation of the presentation. It should consider the presentation's purpose, audience, content and delivery statistics.

**`strengths`**

Identify what the speaker did well. Each strength should include:
- `title`: short description.
- `explanation`: why this is a strength.
- `evidence`: optional supporting example from the transcript.

**`improvements`**

Identify specific areas that could be improved. Each improvement should include:
- `title`: short description.
- `explanation`: what could be improved and why.
- `evidence`: optional example from the transcript.
- `recommendation`: an actionable suggestion.

**`keyPointCoverage`**

Evaluate whether the speaker addressed each key point supplied in the presentation details.

Use exactly one of:
- `covered`
- `partial`
- `missing`

Do not invent additional key points.

**`nextSteps`**

Provide a short list of practical actions the speaker can take to improve their next attempt.

**`suggestedRewrite`**

Optional rewritten version of a section or passage from the transcript. It should preserve the speaker's intended meaning while improving clarity, structure or wording.

---

## 6. AI analysis requirements

The feedback should be:

- Specific to the actual transcript and presentation context.
- Constructive rather than discouraging.
- Actionable, with practical recommendations.
- Supported by evidence where possible.
- Consistent with the supplied statistics.
- Structured according to the agreed TypeScript interface.

Avoid generic feedback such as "speak more clearly" without explaining what the speaker could do differently.

### Important limitations

The AI receives a transcript and numerical statistics, not the original audio.

Therefore, it cannot reliably evaluate:
- Vocal confidence.
- Pitch or intonation.
- Volume.
- Speaking tone.
- Actual emotional expression.
- Non-verbal communication.
- Body language.

Do not claim to have measured these characteristics.

The statistics are also approximations. In particular:
- Web Speech API transcription may omit or normalise filler words.
- Filler-word counts are based on the transcript received by the backend.
- Sentence counting has known limitations around abbreviations and decimal numbers.

Do not present these statistics as perfectly accurate measurements.

---

## 7. Claude integration and technical requirements

Use the Anthropic Claude API from the backend.

Requirements:
- Keep `ANTHROPIC_API_KEY` in the backend environment.
- Load secrets through environment variables.
- Never hardcode API keys.
- Never expose API keys or raw internal errors to the frontend.
- Use the existing TypeScript project configuration.
- Handle API failures, timeouts and invalid model responses.
- Validate the returned object before passing it back to the backend.

If you need to install the Anthropic SDK or add environment configuration, coordinate with Member 2 so that the changes are compatible with the existing server setup.

Do not assume the existing OpenAI dependency is intended for this integration.

---

## 8. Integration with Member 2's backend

The existing endpoint is:

`POST /api/analyze`

Member 2 has already implemented:
- Request validation.
- Transcript and presentation data handling.
- Statistics calculation.
- The `AnalyseSpeech` integration type.
- JSON body limits.
- Error handling.
- The response structure.

At present, valid requests return `503 Service Unavailable` because the AI service has not yet been supplied.

Your deliverable is the analysis function that Member 2 can connect to the route.

Please communicate:
1. The function's exported name.
2. The file path.
3. The exact input and return types.
4. Any dependencies or environment variables required.
5. Any errors the function can throw.

**Do not independently rewrite `POST /api/analyze`.** Member 2 owns that route and will handle the final integration.

---

## 9. Definition of done

Your work is ready for integration when:

- [ ] Claude API integration works from the backend.
- [ ] The service accepts the agreed `AnalysisRequest`.
- [ ] The service uses presentation context when analysing the transcript.
- [ ] The service returns the complete `Feedback` structure.
- [ ] The returned structure is validated.
- [ ] API failures and invalid responses are handled.
- [ ] No API keys are exposed to the frontend.
- [ ] The service has been tested with a sample presentation and transcript.
- [ ] Member 2 has the function name, path and integration instructions.

After this, Member 2 can connect your function to the existing endpoint and the team can test the complete frontend-to-backend-to-Claude workflow.

---

## 10. Communication with Member 2

Before changing shared interfaces, discuss the proposed change with Member 2.

The most important thing is that the following contract remains consistent:

`AnalysisRequest → AnalyseSpeech → Feedback`

Member 2 owns the API route and orchestration. Member 3 owns the Claude analysis service. Both should work together on integration without duplicating responsibilities.
