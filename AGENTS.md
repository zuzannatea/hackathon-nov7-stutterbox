# AGENTS.md --- Instructions for Coding Agents

## 1. Project context

This repository contains **Stutterbox**, a hackathon web application
that helps users practise speeches and presentations.

Read `PROJECT.md` before making substantial changes. It describes the
product goal, MVP boundaries, architecture, API contract, and known
limitations.

The priority is a reliable, demonstrable end-to-end MVP. Do not expand
scope without checking whether the core user journey already works.

## 2. Working principles

-   **Explain before implementing.** Before a substantial change,
    briefly explain the approach, files likely to change, and any
    important trade-offs. Then implement once the direction is clear.
-   Prefer the smallest change that solves the problem.
-   Do not introduce unnecessary abstractions, dependencies, frameworks,
    or infrastructure.
-   Preserve the existing project structure and coding conventions.
-   Do not rewrite working code merely to make it stylistically
    different.
-   If requirements are ambiguous, inspect the existing code and ask one
    focused question when the ambiguity materially affects the
    implementation.
-   Do not claim that code works unless you have run an appropriate
    check or clearly state that it has not been tested.
-   Keep the user informed about files changed, commands run, and any
    manual steps still required.

## 3. Repository structure

The project is organised as a frontend and backend:

``` text
presentation-feedback/
├── client/                 # React + TypeScript + Vite frontend
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── server/                 # Express + TypeScript backend
│   ├── index.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── package-lock.json
├── .gitignore
├── PROJECT.md
└── AGENTS.md
```

Inspect the actual repository before assuming every path exists. The
structure may evolve as features are added.

## 4. Technology constraints

### Frontend

-   React with TypeScript.
-   Vite for local development and bundling.
-   Browser APIs such as `MediaRecorder` for audio recording.
-   Use the existing styling approach unless there is a clear reason to
    change it.

### Backend

-   Node.js with TypeScript.
-   Express for HTTP routes.
-   Multer for multipart file uploads when needed.
-   OpenAI official JavaScript SDK for transcription and text analysis.
-   dotenv for local environment variables.

Do not move OpenAI API calls into frontend code.

## 5. Secrets and privacy

-   The OpenAI API key must remain on the backend.
-   Read secrets from environment variables, for example
    `process.env.OPENAI_API_KEY`.
-   Never hardcode secrets, commit `.env` files, print secret values, or
    expose them through API responses.
-   Keep `.env` ignored by Git. A `.env.example` may contain variable
    names and safe placeholders only.
-   Do not add real user recordings or transcripts to the repository.
-   Avoid logging raw audio, API keys, or unnecessary personal
    information.
-   Validate uploaded file type and size and handle malformed requests
    safely.

If a secret appears to have been committed, tell the user immediately.
Removing it from the latest commit alone may not remove it from Git
history; advise rotating the exposed key.

## 6. Product boundaries

The MVP should focus on:

1.  presentation context and intended key points;
2.  browser audio recording;
3.  audio upload;
4.  speech transcription;
5.  basic measurable statistics;
6.  structured feedback comparing the transcript with the intended
    content; and
7.  a clear results view.

Do not independently add authentication, a database, payment flows,
real-time coaching, or deployment infrastructure unless explicitly
requested.

Do not implement facial, posture, or body-language analysis.

Do not claim that transcript-only analysis can reliably measure
confidence, enthusiasm, tone, pitch, vocal variety, or emotional
delivery. Keep feedback grounded in evidence available to the
application.

## 7. API and shared contracts

The intended analysis flow is:

``` text
Browser -> POST /api/analyze -> Express
                              -> transcription
                              -> statistics
                              -> AI analysis
                              -> validated JSON response
Browser <- results response <-
```

The intended endpoint uses `multipart/form-data` with:

-   `audio`: audio file;
-   `presentation`: JSON-encoded presentation details;
-   `inspiration`: optional text.

Keep frontend and backend types aligned. If a shared contract changes:

1.  identify every consumer;
2.  update the relevant types and implementation together;
3.  update error handling and UI states;
4.  run the available checks.

Prefer deterministic application code for simple calculations such as
word count and words per minute. Use an AI model for tasks requiring
semantic interpretation, such as assessing whether key points were
covered.

Validate model output before returning it to the frontend. Do not assume
generated JSON is valid merely because the prompt requested JSON.

## 8. Error handling and user experience

Handle at least these cases:

-   microphone permission denied;
-   browser does not support the required recording API;
-   user submits without a recording;
-   unsupported or oversized audio file;
-   failed upload;
-   transcription API failure;
-   analysis API failure;
-   missing or malformed presentation details;
-   unexpected or invalid AI response.

Return useful HTTP status codes and safe, understandable error messages.
Do not send stack traces, secrets, or internal implementation details to
the browser.

The frontend should show clear recording, uploading, processing,
success, and error states. Avoid leaving the user with a permanently
spinning loading indicator.

## 9. TypeScript and code quality

-   Keep TypeScript strict; avoid `any` unless there is a clear,
    documented reason.
-   Prefer explicit types for API requests and responses.
-   Keep functions focused and reasonably small.
-   Avoid duplicating business logic between frontend and backend.
-   Use clear names and straightforward control flow.
-   Do not add a dependency for functionality that can be implemented
    simply with existing tools or browser APIs.
-   Follow the formatting and naming style already present in the file
    being edited.

## 10. Development workflow

Before making changes:

1.  inspect the relevant files;
2.  read the relevant parts of `PROJECT.md`;
3.  identify the smallest coherent implementation;
4.  explain the plan for substantial work.

After making changes:

1.  run the relevant development command or type check;
2.  run tests if they exist;
3.  inspect the final diff;
4.  report what changed and what was verified;
5.  list any remaining manual steps or known limitations.

Useful local commands (run from the relevant directory):

``` bash
# Frontend
cd client
npm install
npm run dev

# Backend, in a separate terminal
cd server
npm install
npm run dev
```

Use scripts that actually exist in the relevant `package.json`; do not
assume a test or lint script is configured.

## 11. Git collaboration

-   Do not run destructive Git commands such as `reset --hard`,
    `clean -fd`, force-push, or history rewriting unless the user
    explicitly requests the operation and understands the consequences.
-   Do not overwrite uncommitted user work.
-   Check `git status` before operations that could affect files or
    history.
-   Do not commit or push unless the user explicitly asks.
-   Use focused commits with descriptive messages when asked to commit.
-   Do not change the configured Git remote without the user's
    instruction.

## 12. Hackathon execution

Optimise for a working demo, not production-scale architecture.

When prioritising work, prefer:

1.  a complete recording-to-feedback path;
2.  reliable error handling for the demo;
3.  clear presentation of useful feedback;
4.  visual polish;
5.  optional stretch goals.

If time is short, recommend cutting optional features rather than
weakening the core flow.

## 13. Communication style

-   Be a patient technical collaborator.
-   Explain unfamiliar concepts in plain language without talking down
    to the user.
-   Give commands that match the user's current directory and operating
    system when known.
-   When asking the user to run commands, provide a small, coherent
    batch and explain what success should look like.
-   Distinguish clearly between completed work, proposed work, and work
    that still needs testing.
