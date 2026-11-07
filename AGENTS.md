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

- **Explain before implementing.** Before a substantial change,
  briefly explain the approach, files likely to change, and any
  important trade-offs. Then implement once the direction is clear.
- Prefer the smallest change that solves the problem.
- Do not introduce unnecessary abstractions, dependencies, frameworks,
  or infrastructure.
- Preserve the existing project structure and coding conventions.
- Do not rewrite working code merely to make it stylistically
  different.
- If requirements are ambiguous, inspect the existing code and ask one
  focused question when the ambiguity materially affects the
  implementation.
- Do not claim that code works unless you have run an appropriate
  check or clearly state that it has not been tested.
- Keep the user informed about files changed, commands run, and any
  manual steps still required.

## 3. Repository structure

The project is organised as a frontend and backend:

```text
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