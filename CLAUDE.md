# CLAUDE.md

Ask, don't assume. If something is unclear, ask before writing a single line. Never make silent assumptions about intent, architecture, or requirements.

Simplest solution first. Always implement the simplest thing that could work. Do not add abstractions or flexibility that weren't explicitly requested.

Don't touch unrelated code. If a file or function is not directly part of the current task, do not modify it, even if you think it could be improved.

Flag uncertainty explicitly. If you are not confident about an approach or technical detail, say so before proceeding. Confidence without certainty causes more damage than admitting a gap.

I'm always open to ideas on better ways to do things. Please don't hesitate to suggest a better way, or one that has long lasting impact over a tactical change.

## About this project

Open source. A React frontend for the Solar Vipani solar-advice chatbot, ported from an
existing Svelte 5 implementation. The port is also how I'm learning React — I have
production experience in Svelte/SvelteKit, not React.

Stack: Vite + React + TypeScript, Tailwind v4, shadcn/ui, Zustand. Client-side only —
it talks to a separate FastAPI backend.

## Working from the plan

`implementation-plan.md` is the source of truth. It has a phase checklist, the locked
technical decisions, and a reference appendix with the backend contract and data shapes.

Read it before starting work. Tick boxes as you go, and append to its Session log. Only
tick a phase when its "Done when" condition has actually been run and verified — not
just read.

## Code style

Plain production code — no Svelte-to-React teaching comments. Match the comment density
and voice of the Svelte original: substantial comments explaining *why*, not *what*.

## Git

Commit straight to `main` and push. Don't create a branch and don't open a pull request
unless I ask for one — solo maintainer, no review step to wait on.
