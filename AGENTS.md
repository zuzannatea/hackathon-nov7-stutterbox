# AGENTS.md --- Instructions for Coding Agents

## 1. Project context

This repository contains Stutterbox, a hackathon web application that helps users practise speeches and presentations. Read `PROJECT.md` before substantial changes; it defines product scope, architecture, API contracts, and known limitations. `TODO.md` coordinates team work.

Prioritise a reliable end-to-end MVP. Prefer the smallest change that solves the task, preserve existing conventions, and do not add dependencies or infrastructure without a clear need.

## 2. Working principles

- Explain the approach, likely files, and meaningful trade-offs before substantial changes. Follow explicit user authorization and do not ask again for approval already given.
- Inspect relevant files and documentation before editing.
- Do not overwrite uncommitted user work or make unrelated stylistic rewrites.
- Keep TypeScript strict, use explicit contracts, and avoid `any` without a clear reason.
- Do not claim work is verified unless the relevant command was run; report limitations accurately.
- Do not commit, push, or change remotes unless explicitly requested.

## 3. Repository structure

```text
presentation-feedback/
├── client/                 # React + TypeScript + Vite frontend
├── server/                 # Express + TypeScript backend
├── PROJECT.md
├── AGENTS.md
└── TODO.md
```

Inspect the current tree; it may change as features are added.

## 4. Architecture and ownership

The MVP uses the browser Web Speech API for live recognition. The browser displays provisional interim results, assembles the final transcript from finalised results, measures duration, and submits transcript and presentation details as JSON. Audio is not uploaded and speech recognition does not run on the server. Web Speech API browser support and transcript accuracy vary; provide clear errors and do not claim it is always offline or private.

- **Member 1 — Frontend:** React UI, presentation form, Web Speech API, live and final transcript handling, timer, API client, results UI, and frontend loading/error states.
- **Member 2 — Backend:** Express API and `POST /api/analyze`, JSON validation, transcript handling, deterministic statistics, safe errors, and orchestration.
- **Member 3 — AI integration:** Claude API integration, prompts, AI analysis service, feedback schema, and parsing/validation of Claude output.

Member 2 owns the HTTP route and calls Member 3's agreed service interface. Member 2 must not implement Claude prompts or direct Claude SDK calls. Member 3 must not take ownership of the Express route. Keep `ANTHROPIC_API_KEY` on the backend. Do not invent mock feedback to disguise a missing AI service.

## 5. Statistics status and limitations

`server/services/statistics.ts` implements `SpeechStatistics` and `calculateSpeechStatistics(transcript, durationSeconds)`. It has passed the backend TypeScript build and has been reviewed. Word count uses trimmed whitespace-separated tokens; sentence count uses punctuation; filler words are counted case-insensitively from `um`, `uh`, `erm`, and `er`; invalid, zero, or negative durations normalize to zero. WPM uses word count divided by duration in minutes.

The team accepted these MVP limitations: sentence counts can be affected by abbreviations, decimals, and punctuation patterns; literal uses of filler words may be counted; very short positive durations can produce unusually high WPM; and WPM is not rounded. Do not change these rules merely to improve sophistication. Change the service only to fix a functional bug, explaining it first.

The JSON `POST /api/analyze` route is implemented with request validation and server-side statistics. Member 3's callable analysis service is not yet in the repository, so valid requests currently receive `503 Service Unavailable`; completing that service integration is the next backend task.

## 6. Contracts, privacy, and errors

Keep frontend and backend contracts aligned with `PROJECT.md` and `TODO.md`. The backend calculates statistics itself and does not trust client-supplied statistics. Validate request bodies, transcript length, and required presentation fields. Return safe, useful status codes and messages; never expose stack traces, secrets, or internal details.

Never hardcode or expose API keys, commit `.env` files, log secrets, or retain unnecessary transcript data. Do not add real recordings or transcripts to the repository. Do not add authentication, a database, payment flows, deployment infrastructure, live AI coaching, or body-language analysis unless explicitly requested.

## 7. Development workflow

Use scripts that exist in the relevant `package.json`. After changes, run the appropriate requested checks, inspect the final diff, and report changed files, commands/results, and remaining integration work. Do not install dependencies without user approval.
