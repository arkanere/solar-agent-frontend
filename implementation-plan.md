# Solar Agent Frontend — React Port: Implementation Plan

Porting the Solar Vipani chatbot UI from Svelte 5 to React, as a standalone Vite SPA
talking to the existing FastAPI backend.

**This document is the single source of truth for a cold start.** It carries enough
embedded context (backend contract, data shapes, source file map) that a fresh session
can resume from the checklist without re-reading the Svelte codebase.

---

## How to resume this work

1. Read **Progress** below to find the first unchecked phase.
2. Read that phase's section in full — goal, files, tasks, done-when.
3. Read **Reference** (§A–§E) for any contract detail you need.
4. Do the work, tick the boxes as you go, append a line to **Session log**.
5. Only tick a phase's header box when every task under it is done *and* its
   "Done when" condition has been verified by running it — not by reading it.

---

## Progress

- [x] **Phase 0** — Scaffold: Vite + React + TS + Tailwind v4 + shadcn/ui
- [x] **Phase 1** — Types and the NDJSON stream client (pure TS, no React)
- [x] **Phase 2** — Zustand store: messages, lead profile, persistence
- [x] **Phase 3** — Static chat UI: list, bubble, composer
- [ ] **Phase 4** — Wire streaming: send, stop, retry, regenerate
- [x] **Phase 5** — Markdown rendering and message metadata
- [x] **Phase 6** — Voice: recorder and speech playback
- [x] **Phase 7** — Tool-result widgets (13 components)
- [x] **Phase 8** — App shell: full-page chat + popup dialog
- [x] **Phase 9** — Tests: Vitest + React Testing Library
- [ ] **Phase 10** — Polish: accessibility, error states, README

---

## Locked decisions

Settled at planning time. Revisit only with a note in the Session log explaining why.

| Decision | Choice | Why |
| --- | --- | --- |
| Build tool | **Vite + React 19 + TypeScript** (SPA) | The widget is 100% client-side — no SSR or routing needed. Learning React, not a meta-framework. |
| State | **Zustand from the start** | Chosen over plain hooks. Closest to the Svelte `writable` mental model; keeps the streaming loop out of component-render concerns. |
| UI primitives | **shadcn/ui (React)** | Near 1:1 with the Svelte source, which uses shadcn-svelte. Radix replaces bits-ui. Pull in only: Button, Textarea, Card, Badge, Input, Label, Select, Dialog. |
| Styling | **Tailwind v4, CSS-first tokens** | `app.css` from the Svelte app is framework-agnostic CSS and ports nearly verbatim. |
| Phase ordering | **By React concept** | Each phase exercises one area cleanly. No teaching comments in the code itself. |
| Code comments | **Plain production code** | Match the Svelte repo's existing density and voice (substantial *why*-comments). No Svelte→React teaching asides. |
| Lead submission | **Mocked locally** | Real endpoint is a SvelteKit server route. See §E. |
| App shell | **Full-page chat + popup demo** | Mirrors `ChatBotBox` + `ChatbotPopup`. |
| Testing | **Vitest + React Testing Library** | Phase 9. |
| Markdown | **react-markdown + remark-gfm + rehype-raw** | Replaces `markdown-it` + `{@html}`. `rehype-raw` is required — the welcome message is raw HTML, not markdown. |

---

## Phase 0 — Scaffold

**Goal:** an empty React app that builds, lints, and renders the design tokens correctly
in light and dark mode.

- [x] `npm create vite@latest . -- --template react-ts` in the repo root
- [x] ~~`git init`~~ — not needed, the directory was already a git repo on `main`
- [x] Install Tailwind v4: `tailwindcss @tailwindcss/vite`, wire the Vite plugin
- [x] Copy `src/app.css` from the Svelte app → `src/index.css`. It is plain CSS
      (`@theme`, `:root`, `.dark`, `@layer`, `@keyframes`) and needs no translation.
      Strip only rules that target Svelte-only markup, if any survive a visual check.
      *No Svelte-only rules existed. The file now differs from the original by exactly
      one 8-line header; it is in `.prettierignore` to keep that diff readable.*
- [x] Set up `@/*` path alias in `tsconfig.json` **and** `vite.config.ts`
      (replaces SvelteKit's `$lib`). *Needed in `tsconfig.app.json` for the compiler
      and in `tsconfig.json` for the shadcn CLI — see Session log.*
- [x] `npx shadcn@latest init`, then add: `button textarea card badge input label select dialog`
- [x] Install runtime deps: `zustand react-markdown remark-gfm rehype-raw lucide-react`
- [x] Create `.env` with `VITE_API_BASE_URL=` (declared but **empty** — see §B).
      *Also `.env.example`, since `.gitignore` excludes `.env`. Typed in `src/env.d.ts`.*
- [x] Create `src/lib/api.ts` exporting `apiUrl(path)`, mirroring the Svelte helper
- [x] Configure the Vite dev proxy for `/api/chatbot`, `/api/transcribe`,
      `/api/speak`, `/api/generate-cad` → `http://localhost:8000` (see §B)
- [x] ~~Add ESLint~~ + Prettier — **oxlint** + Prettier instead; see Session log
- [x] Verify dark mode: the Svelte app toggles a `.dark` class on `<html>`.
      Add a minimal theme toggle or hardcode light for now; full theming is Phase 10.
      *Minimal toggle lives inline in `App.tsx`; `@custom-variant dark` added to
      `index.css` so shadcn's own `dark:` utilities follow the class too.*

**Done when:** `npm run dev` serves a page whose background is the warm cream
`--background: 40 33% 97%` and where a shadcn `<Button>` renders in Sun Orange
`--primary: 24 100% 50%`.

**Verified 2026-07-29** in the browser against `npm run dev`: computed `body`
background `rgb(250, 248, 245)` and default `<Button>` background `rgb(255, 102, 0)`
(= `#FF6600`). Light and dark both screenshotted. `npm run build`, `npm run lint` and
`npm run format:check` all clean.

---

## Phase 1 — Types and the NDJSON stream client

**Goal:** a pure-TypeScript module that turns a `fetch` Response into an async stream of
typed events. No React in this phase — this is the highest-risk logic and it should be
independently testable.

- [x] `src/lib/types.ts` — `ChatMessage`, `LeadProfile`, `StreamEvent` (see §C).
      *Also `EMPTY_LEAD_PROFILE`, `Source`, `HistoryTurn`, `RawStreamEvent`.*
- [x] Model `StreamEvent` as a **discriminated union on `type`**
- [x] `src/lib/stream.ts` — `parseNdjsonStream(response): AsyncGenerator<StreamEvent>`
  - [x] Buffer across chunk boundaries: chunk edges do not align with newlines.
        Split on `\n`, keep the trailing partial line in the buffer.
  - [x] A malformed line must be skipped with a warning, not thrown — one bad line
        must not kill an otherwise healthy stream
  - [x] Unknown `type` values pass through and are ignored downstream, so the backend
        can add events without breaking this client. *Wrapped as
        `{ type: 'unrecognised', raw }` — see Session log for why a bare catch-all
        could not be used.*
- [x] `src/lib/chatClient.ts` — `sendChatMessage({ userMessage, history, leadProfile, signal })`
      returning the event stream. Throws on non-OK or missing `response.body`.
- [x] Constant: history is capped at the **last 8 turns**, `{ role, content }` only.
      *`HISTORY_LIMIT` in `chatClient.ts`, applied in `sendChatMessage` so no caller
      can forget it. `toHistory()` reduces a transcript and drops failed turns.*

**Done when:** a scratch script feeds a hand-written multi-chunk NDJSON string
(deliberately splitting one JSON object across two chunks) through the parser and gets
the correct events out in order.

**Verified 2026-07-29.** Two scratch scripts, 27 assertions, all passing. Parser: object
split mid-token across chunks; splits one byte either side of a `\n`; byte-at-a-time
chunking; malformed line skipped; unknown type passed through; missing trailing newline;
blank lines; nothing delivered after `done`; a 3-byte `₹` split across chunks; empty
stream. Client: request shape, history capped to the *last* 8 in order, full profile
sent, non-OK throws. Narrowing was checked with `tsc` separately (a control case
confirms `ev` narrows to exactly `{ type: "delta"; text: string }`) — `tsx` strips types
without checking them, so the runtime pass alone proved nothing.

---

## Phase 2 — Zustand store

**Goal:** all chat state lives in one store with explicit actions. Components will only
read from it.

- [x] `src/store/chatStore.ts`
- [x] State: `messages`, `leadProfile`, `isLoading`, `isStreaming`, `voiceOutputEnabled`
- [x] Actions: `appendMessage`, `patchLastMessage`, `removeMessageAt`,
      `truncateFrom`, `setLeadProfile`, `applyContextUpdates`, `reset`, `greet`.
      *Plus `setLoading`, `setStreaming`, `setVoiceOutputEnabled` — the state above is
      listed without setters and is unusable from Phase 4/6 without them.*
- [x] `applyContextUpdates` maps backend camelCase keys → profile fields via
      `CONTEXT_TO_PROFILE` (§D). Unmapped keys warn in dev and are dropped.
      `false` is meaningful for `hasDocuments` — skip only `null` and `""`.
      *`undefined` is skipped too.*
- [x] Persist to localStorage under the **same keys as the Svelte app** so a session can
      be carried across: `chatMessages`, `leadProfile`, `chatVoiceOutput`.
      Use Zustand `persist` middleware with a `partialize` that excludes transient flags
      (`isLoading`, `isStreaming`). *Needed a custom `PersistStorage` — see Session log.*
- [x] Seed the welcome message when there is no stored transcript (§D)

**Done when:** store actions can be driven from a scratch test — append a message,
patch it, reset — and the localStorage keys round-trip.

**Verified 2026-07-31.** Scratch script, 50 assertions, all passing, over a fresh module
import per scenario so `persist` re-hydrates each time: cold start seeds the greeting and
writes all three keys; a stored transcript suppresses the greeting; a stored profile is
spread over `EMPTY_LEAD_PROFILE` so a field added later still comes back complete;
append/patch/remove/truncate including patch-on-empty as a no-op and a merge that leaves
untouched fields alone; `applyContextUpdates` remapping, `hasDocuments: false` kept,
`null`/`""` skipped without blanking an earlier value, unmapped key dropped; only the
three Svelte keys ever appear in storage and no transient flag reaches them; `reset`
clears the profile and flags but keeps `voiceOutputEnabled`, which is a user preference,
not conversation state; a corrupt `chatMessages` entry falls back to the greeting instead
of throwing at boot. `tsc -b`, `npm run lint` and `prettier --check` clean.

---

## Phase 3 — Static chat UI

**Goal:** the full visual layout, rendering messages from the store. No network yet.

- [x] `src/components/chat/ChatBox.tsx` — header (title, copy, close), scrollable
      history, composer, reset footer
- [x] `src/components/chat/MessageBubble.tsx` — avatar for assistant, card, timestamp,
      hover action row (copy / regenerate), `Stopped` badge. *Also the error state and
      its Retry button: `error` and `userMessage` are already on `ChatMessage`, and
      Phase 4 only wires the handler.*
- [x] `src/components/chat/Composer.tsx` — textarea with **auto-grow**
      (reset `height` to `auto`, then set to `scrollHeight`; capped by max-height in CSS)
- [x] Enter sends, Shift+Enter newlines. *Enter is ignored while `isComposing`, or an
      IME candidate window's commit keystroke sends the message mid-word.*
- [x] Starter prompt chips, shown only until the first user message (§D)
- [x] Typing indicator (three pulsing dots) while loading
- [x] Scroll anchoring: auto-scroll to bottom unless the user has scrolled up
      more than 100px; re-arm when they come back within 20px of the bottom
- [x] `src/lib/format.ts` — port `formatCurrency`, `formatNumber`, `formatLakh`,
      `formatThousand`, `humanizeToolName`, `formatTime` (plain TS, copies over directly)
      *— reimplemented, not copied; the Svelte tree is not on this machine. See log.*
- [x] Accessibility on the history container: `role="log"`, `aria-live="polite"`,
      `aria-atomic="false"`, `aria-busy`

**Done when:** seeding the store with a handful of fake messages renders a chat that is
visually indistinguishable from the Svelte version side by side.

**Verified 2026-07-31** in the browser against `npm run dev`, with a 20-message fixture
seeded into `localStorage` — but **not** side by side with the Svelte version, which is
not checked out here (see Session log). What was exercised: cold conversation shows the
greeting plus all four starter chips; clicking a chip sends it and the chips disappear;
Shift+Enter inserts a newline and the newline survives into the bubble, Enter sends and
clears; the textarea grows line by line and stops at the 8rem cap; `Stopped` badge and
the error bubble with Retry both render; the copy action appears on hover and Regenerate
is correctly absent on a message that is not the last; scrolled up, a new message does
**not** yank the view down, and after scrolling back to the bottom the next one does; the
typing indicator renders while `isLoading`; dark mode checked on the same transcript.
`npm run build`, `npm run lint`, `prettier --check src` clean, console clean on reload.

---

## Phase 4 — Wire streaming

**Goal:** a real conversation against the local backend.

- [x] `src/hooks/useChat.ts` — owns `runChat(text, { appendUser })` and an
      `AbortController` in a ref
- [x] Snapshot prior turns **before** appending the current message, so the server gets
      real multi-turn context. When `appendUser` is false (retry/regenerate), also drop
      the trailing user turn from the snapshot — it is sent separately as `userMessage`.
- [x] Buffer `intent`, `context`, `questions`, `tool` events that arrive **before** the
      first `delta` — there is no assistant message to attach them to yet. Flush on
      stream end. `sources` and `usage` arrive after the last delta.
      *`context` is not buffered — it is profile state, applied immediately.*
- [x] Deliberately **drop `questions` events.** They are slot-filling prompts for the
      *assistant* to ask the customer; rendering them as "you might also ask" chips
      offers the customer "May I have your name?" as something to ask us. The Svelte
      app removed this on purpose — do not reinstate it.
- [x] Stop: abort keeps the partial reply and marks the message `stopped: true`.
      `AbortError` is a user action, not a failure.
- [x] Error: append an assistant message with `error: true` and `userMessage: text`
      so Retry knows what to resend
- [x] Retry: drop the failed message, re-run with `appendUser: false`
- [x] Regenerate: truncate to before the last assistant turn, find the preceding user
      turn, re-run with `appendUser: false`
- [x] Reset: abort in flight, stop recorder and speech, clear localStorage, re-greet —
      so a late chunk cannot write into the fresh conversation
      *Recorder and speech do not exist until Phase 6 — noted in the hook.*

**Done when:** with `solar-agent-backend` running locally (`uv run uvicorn app.main:app
--reload`), a question streams in token by token, stop truncates cleanly, and retry and
regenerate both produce a fresh answer.

**Not yet run against the real backend** — hence the phase box above is still open.
Everything else was verified 2026-07-31 in the browser against a throwaway mock NDJSON
server on `:8000` speaking §C's contract through the same Vite proxy: deltas render token
by token and the starter chips clear; `intent` arriving before the first delta lands on
the message, `sources`/`usage` arriving after it land too; `context` updates reach the
lead profile and the profile then goes back up on the next request; a `questions` event
and an unknown event type are both ignored without incident; Stop keeps the partial reply
and marks it `stopped`; an `error` event produces the error bubble with Retry, and Retry
re-sends the same `userMessage` with the failed turn absent from `history`; Regenerate
replaces the last reply in place and leaves the question above it; a tool-only turn with
no delta at all still flushes its buffered metadata into a message; and Clear during a
live stream leaves exactly the greeting with no late chunk writing into it. Console clean
apart from the two deliberate failures. `tsc -b`, `npm run lint`, `prettier --check` and
`npm run build` all clean.

---

## Phase 5 — Markdown and message metadata

- [x] Replace plain-text rendering with `react-markdown` + `remark-gfm` + `rehype-raw`
      *in `Markdown.tsx`, hardened — see below and the Session log.*
- [x] Style the rendered output to match: `ul` disc / `ol` decimal with `pl-5`,
      `h4` semibold, `p` with `my-1`, links underlined in primary, `strong` semibold
- [x] `src/components/chat/IntentBadge.tsx` — intent label map + journey stage map,
      confidence badge only above 0.8 (§D)
      *Maps taken from the backend's own `app/schemas/intents.py` — see §D.*
- [x] `src/components/chat/TokenUsage.tsx` — in/out/total + `costINR` to 4 dp
- [x] Sources block: bordered top section, links `target="_blank" rel="noopener noreferrer"`
- [x] Per-message copy: copy the **markdown source**, not the rendered node
- [x] Conversation transcript export: strip HTML to plain text, append each assistant
      turn's citations, write to clipboard *(`stripHtml` in `format.ts`)*

**Done when:** a reply containing a list, bold text and a link renders correctly, and the
intent/usage rows appear beneath it.

**Verified 2026-07-31** in the browser against `npm run dev` with a seeded fixture: a
reply with an h3, bold, italics, inline code, a bulleted list, a numbered list, a link and
a GFM table renders correctly, with the sources block and the intent/usage row beneath it;
the welcome message renders as a paragraph rather than literal `<p>` tags; the customer's
own turn keeps its newlines and its literal asterisks (it is not run through markdown);
the confidence figure shows at 0.91 and is withheld at 0.42; an intent name absent from
the map falls back to a title-cased label. Dark mode checked on the same transcript.
Injection attempt — `<script>`, `<img onerror>`, `<a href="javascript:">`, `<a onclick>`
and `<iframe>` in one reply — produced no script/img/iframe elements, no `on*` attributes,
an emptied `href`, and no global set; the `<script>` body does not surface as text either.
`stripHtml` checked directly: entities decoded, block boundaries become newlines, plain
markdown passes through untouched. `tsc -b`, `npm run lint`, `prettier --check` and
`npm run build` clean; console clean on reload.

---

## Phase 6 — Voice

**Goal:** convert the two Svelte reactive classes into React hooks. These classes hold
imperative browser resources (`MediaRecorder`, `HTMLAudioElement`, object URLs) — the
interesting part is where that state lives in React.

- [x] `src/hooks/useAudioRecorder.ts`
  - [x] MIME type probing, in order: `audio/webm;codecs=opus`, `audio/webm`,
        `audio/mp4` (Safari only accepts this), `audio/ogg;codecs=opus`
  - [x] `isSupported`, `permission` (`prompt | checking | granted | denied`), `error`
  - [x] `syncPermission()` via the Permissions API, tolerating browsers without it
  - [x] `start()`, `stop(): Promise<Blob | null>`, `cancel()`
  - [x] **Always release the stream** (`getTracks().forEach(t => t.stop())`) or the
        browser's recording indicator stays lit
- [x] `src/hooks/useSpeechPlayer.ts`
  - [x] `stripMarkdown()` — ~~port verbatim~~ *reimplemented; the Svelte tree is not
        on this machine, same as `format.ts` in Phase 3*
  - [x] Request-ID guard against out-of-order responses: a newer `speak()` must win
  - [x] `URL.revokeObjectURL` on every exit path
  - [x] Normal end, error and explicit stop must all land in the same clean state,
        or the UI sticks on "speaking" forever
  - [x] Distinguish autoplay-policy rejection (`NotAllowedError`) from other failures
- [x] Wire into the composer: mic button (record → `/api/transcribe` → send as a normal
      turn), speaker toggle (a persisted **mode**, not a per-message action —
      `aria-pressed`, remembered in `chatVoiceOutput`)
- [x] Speaking must not start on failed or stopped turns
- [x] Starting a recording stops any playback — don't let the bot talk into the open mic
- [x] `src/lib/speechClient.ts` — `transcribeAudio` / `fetchSpeech`, alongside
      `chatClient.ts`. Not in the original phase list; the two hooks were both about
      to hand-roll the same two `fetch` calls.

**Done when:** recording a spoken question transcribes and answers it, and toggling the
speaker reads subsequent replies aloud.

**Verified 2026-08-01** in the browser against `npm run dev` — against a throwaway mock
on `:8000` again, not the real backend, and with a **synthetic microphone**:
`getUserMedia` was replaced with a real `MediaStream` carrying an oscillator tone, so the
browser's own `MediaRecorder` did the encoding and only the capture device was fake. What
that leaves untested is real speech through the real Whisper and TTS models; everything
between the mic and the transcript is real code.

Exercised: a 2s recording produced a 209 kB `audio/webm` upload named `audio.webm`, whose
transcript came back and was sent as an ordinary turn that streamed a reply. The speaker
toggle persists to `chatVoiceOutput` and reads the *next* reply — the text sent to
`/api/speak` was the reply with `##`, `**`, the bullet markers and the link target
stripped and the link text kept, which is `stripMarkdown` doing its job. A stopped turn
keeps its partial reply, shows `Stopped`, and is **not** spoken. With the speaker off
nothing is synthesised at all, and turning it back on does not read the reply already on
screen. Switching it off mid-playback pauses and revokes; switching it off *mid-synthesis*
discards the clip on arrival — nothing plays, no object URL is ever created, and the
button does not stick on its spinner. Starting a recording cut playback and revoked the
URL. `Clear conversation` during a recording cancelled it and released the track. Track
accounting across the whole session: every track handed to the app was stopped. A failing
`/api/transcribe` surfaced as a composer error with the mic released and the button back;
Escape discarded a recording and sent nothing; a `NotAllowedError` from `getUserMedia`
disabled the mic with an explanatory title. Dark mode checked. Console clean apart from
the one deliberate failure. `tsc -b`, `npm run lint`, `prettier --check` and
`npm run build` all clean.

---

## Phase 7 — Tool-result widgets

**Goal:** 13 components, mostly presentational. Composition and prop typing.

- [x] `WidgetShell.tsx` — bordered panel, emoji + title + subtitle, optional
      `actions` slot (Svelte snippet → React `ReactNode` prop)
- [x] `StatTile.tsx`, `StatRow.tsx`
- [x] `ToolResultDisplay.tsx` — dispatch map (§D). Render nothing for
      `collect_customer_info` and `scrape_website` — they run for the model's benefit.
- [x] `QuotationDisplay.tsx`
- [x] `RoiDisplay.tsx` — first 5 of 25 yearly milestones; environmental impact block
- [x] `BookingDisplay.tsx`
- [x] `SystemSizeDisplay.tsx`
- [x] `SubsidyDisplay.tsx`
- [x] `CadDrawingDisplay.tsx` — utilisation progress bar clamped 0–100;
      SVG offered as a **download only**, never injected into the page
- [x] `KnowledgeBaseDisplay.tsx` — content is plain text, render as text not HTML
- [x] `GenericToolDisplay.tsx` — fallback; guard `JSON.stringify` against circular payloads
- [x] `LeadFormCard.tsx` — prefill from tool result, validation, submit, success state
- [x] `src/lib/validation.ts` — port `validateLeadForm` (§D for the regexes)
- [x] **Mock lead submission** (§E): ~~MSW handler or~~ Vite middleware for
      `POST /api/submit-lead` returning `{ success: true, id: "MOCK-<n>" }`.
      *Middleware, in `vite.config.ts` — zero new dependencies, and `apply: 'serve'`
      makes it structurally impossible to ship.*
- [x] Wire `ToolResultDisplay` into `MessageBubble`, under the prose and above the
      intent/usage row.

**Done when:** each widget renders correctly from a fixture payload, and the lead form
validates, submits to the mock, and shows the confirmation state with a reference ID.

**Verified 2026-08-01** in the browser against `npm run dev` with a 20-message fixture in
`localStorage`, one turn per tool, every payload copied from the shapes
`app/services/tool_executor.py` actually returns. All nine widgets render; the two silent
tools render their prose and **no** panel, so exactly nine `<section>`s exist for eleven
tool turns. Quotation shows pricing, system, breakdown and savings; ROI shows exactly five
yearly milestones out of the seven sent, plus the CO₂ block; subsidies list all three
schemes with the computed total on the central one; the system-size widget shows the
coverage basis and the "enough space" line the roof area enables. The CAD payload's
deliberately impossible **118.4% clamped to 100%** on both the bar width and
`aria-valuenow`, and the drawing is nowhere in the DOM — no `img`, `object`, `embed`,
`iframe`, no payload `rect`, no `data:image/svg+xml` anywhere in the markup; the SVG
button was checked by intercepting the anchor click, which would have downloaded
`CAD-1785559000000.svg` from a blob URL. Lead form: prefill resolves tool-over-profile as
intended (name/phone/type from the tool, email/PIN from the profile, comment blank); a bad
phone, short PIN, malformed email and empty comment produce four errors and no submission;
fixing them clears the errors, `98765 43210` is accepted with its space, and the mock
answers `MOCK-0001` into the confirmation. A 500 from the endpoint shows the failure and
**no confirmation** — the one outcome that must never be faked. `safeStringify` (in `src/lib/json.ts`, moved out of the widget so the file exports
only a component) was exercised against the real module: a cycle becomes `[Circular]`, a BigInt stringifies, a
nested payload survives. Dark mode checked across the widgets and the form. `tsc -b`,
`npm run lint`, `prettier --check` and `npm run build` clean; no new console output.

---

## Phase 8 — App shell

- [x] `src/App.tsx` — demo host page with the chat rendered full-height
- [x] `ChatbotPopup.tsx` — shadcn `Dialog` wrapper, launcher button, dismiss handling
      that mirrors the Svelte `isManuallyDismissed` behaviour
      *— see the Session log: nothing auto-opens the popup here, so the flag records
      the dismissal and nothing acts on it yet.*
- [x] Both mount points share one store instance *— and one `useChat`; the popup takes
      the handlers as props rather than calling the hook itself.*
- [x] Responsive: mobile full-screen, desktop `max-w-4xl h-[85vh]`

**Done when:** the launcher opens the chat in a modal with focus trapped, Escape closes
it, and the transcript survives closing and reopening.

**Verified 2026-08-01** in the browser against `npm run dev`. The launcher opens the
modal; focus lands inside it; its accessible name is "Solar Vipani Assistant" from the
visually-hidden title; a turn sent from the page-level chat is already in the popup when
it opens, survives closing and reopening, and the page-level chat still has it afterwards
— one store, one hook, two mounts. Escape and the header close button both dismiss it,
and the body scroll lock is released. On desktop the panel measures **896 px** wide
(`max-w-4xl`) and 85% of the viewport height, with the rounded corner.

**Two things this run could not establish**, both because the automated tab is never the
focused, visible tab. (1) **Focus restoration to the launcher** after closing: Chrome
reports `document.hasFocus() === false` throughout, focus lands on `body`, and Radix's
restore is a no-op in an unfocused document. Focus *trapping* while open was verified;
restoration was not. (2) **The mobile full-screen layout**: the window would not actually
resize (`innerWidth` stayed 1280 through two attempts), so only the `sm:` branch was
measured. The base classes are the ordinary `h-dvh w-screen max-w-none rounded-none`
pattern, but they were not seen rendering. Both belong in Phase 10's accessibility and
responsive pass.

---

## Phase 9 — Tests

- [x] Install `vitest @testing-library/react @testing-library/user-event jsdom`
      *plus `@testing-library/jest-dom` for the matchers. Config lives in
      `vite.config.ts`, setup in `src/test/setup.ts`; `npm test` runs once,
      `npm run test:watch` watches.*
- [x] `stream.test.ts` — chunk boundaries mid-object, malformed lines, unknown event
      types, missing trailing newline. Phase 1's scratch scripts already cover these
      plus: splits one byte either side of a `\n`, byte-at-a-time chunking, blank and
      whitespace-only lines, nothing delivered after `done`, a multi-byte character
      (`₹`) split across chunks, and an empty stream. **Port all of them.**
- [x] `chatClient.test.ts` — request shape, history capped to the *last* 8 turns in
      order, failed turns excluded by `toHistory`, non-OK response throws
- [x] `chatStore.test.ts` — `applyContextUpdates` mapping including the `hasDocuments:
      false` case, patch/truncate actions, persistence round-trip
- [x] `useChat.test.ts` — mocked `ReadableStream`: happy path, pre-delta event buffering,
      abort mid-stream, error event
- [x] `validation.test.ts` — every branch of `validateLeadForm`
- [x] Component tests (RTL, query by role): composer Enter vs Shift+Enter, starter chips
      disappearing after the first user message, retry on a failed message
- [x] Beyond the list: `format.test.ts` (formatters, `stripHtml`, `safeStringify`),
      `Markdown.test.tsx` (the injection vectors Phase 5 hardened against),
      `ToolResultDisplay.test.tsx` (dispatch, both silent tools, the CAD clamp, and
      the lead form's success *and* failure), `useAudioRecorder.test.ts` and
      `useSpeechPlayer.test.ts` (`stripMarkdown`).

**Done when:** `npm test` passes and covers the stream parser and store exhaustively.

**Verified 2026-08-01. `npm test`: 12 files, 172 tests, all passing**, alongside
`tsc -b`, `npm run lint`, `prettier --check` and `npm run build`. Every Phase 1 and
Phase 2 scratch assertion is now a real test, and the suites reach further: the hook's
buffering, abort, error and retry/regenerate/reset paths; the recorder's stream release
on all four exits; the markdown sanitiser's four injection vectors; the lead form's
refusal to confirm a submission the server rejected.

---

## Phase 10 — Polish

- [ ] Keyboard navigation and focus order through the whole widget
- [ ] Screen-reader pass on the live region — verify streaming updates announce sanely
- [ ] Dark mode verified across every widget
- [ ] Cold-start handling: **no client-side timeout under ~30s.** Cloud Run runs
      `min-instances: 0`, so the first request after a quiet period is slow.
- [ ] Error boundary around the widget list so one bad tool payload can't blank the chat
- [ ] `README.md`: setup, running the backend locally, env vars, the CORS caveat
- [ ] Production build check against the deployed backend URL

---

# Reference

## §A — Source map

| What | Path |
| --- | --- |
| React app (this repo) | `.` |
| Svelte original | `~/Developer/svelte/solar-app/apps/main-app` |
| Backend | `~/Developer/solar-agent-backend` |
| Backend integration doc | `solar-agent-backend/FRONTEND_INTEGRATION.md` |

**This repo is public** — <https://github.com/arkanere/solar-agent-frontend>. The paths
above are deliberately `~`-relative: absolute paths carrying the home directory were
scrubbed from the whole history before the first push. **Do not paste absolute paths
back into this file**, here or in the Session log. The Svelte original and the backend
are not published alongside it, so anything this document needs from them has to be
quoted here rather than linked.

Svelte files being ported, relative to `apps/main-app/src/lib/`:

| File | Lines | React target |
| --- | --- | --- |
| `in/components/ChatBotBox.svelte` | 712 | `ChatBox.tsx` + `useChat.ts` + `chatStore.ts` |
| `in/components/ChatbotPopup.svelte` | 39 | `ChatbotPopup.tsx` |
| `in/components/chat/MessageBubble.svelte` | 138 | `MessageBubble.tsx` |
| `in/components/chat/audioRecorder.svelte.ts` | 130 | `useAudioRecorder.ts` |
| `in/components/chat/speechPlayer.svelte.ts` | 134 | `useSpeechPlayer.ts` |
| `in/components/chat/IntentBadge.svelte` | 50 | `IntentBadge.tsx` |
| `in/components/chat/TokenUsage.svelte` | 16 | `TokenUsage.tsx` |
| `in/components/chat/format.ts` | 51 | `format.ts` (near-verbatim) |
| `in/components/chat/widgets/*.svelte` | 13 files | `components/chat/widgets/*.tsx` |
| `constants/formValidation.ts` | — | `validation.ts` (`validateLeadForm` only) |
| `api.ts` | 10 | `api.ts` |
| `app.css` | 846 | `index.css` (near-verbatim — plain CSS) |

## §B — Backend endpoints and configuration

Base URL: `https://solar-agent-backend-489624964901.asia-south1.run.app` (asia-south1).

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| POST | `/api/chatbot` | JSON | **NDJSON stream** (`application/x-ndjson`) |
| POST | `/api/chat` | JSON | JSON (non-streaming; unused here) |
| POST | `/api/transcribe` | `multipart/form-data`, field `audio`, max 25MB | `{"text": ...}` |
| POST | `/api/speak` | `{"text", "voice"}` | `audio/mpeg` bytes |
| POST | `/api/generate-cad` | JSON | JSON |
| GET | `/health` | — | `{"status":"ok"}` |

`voice` ∈ `alloy | echo | fable | onyx | nova | shimmer`, default `alloy`; anything else
is a 422. Interactive schema at `GET /docs`.

**Local dev.** Leave `VITE_API_BASE_URL` **declared but empty** so `apiUrl()` yields
relative paths, and let the Vite proxy forward them to `localhost:8000` — same-origin, so
CORS never enters the picture.

```ts
// vite.config.ts
const backendProxy = { target: 'http://localhost:8000', changeOrigin: true };
server: { proxy: {
  '/api/chatbot': backendProxy, '/api/transcribe': backendProxy,
  '/api/speak': backendProxy, '/api/generate-cad': backendProxy,
} }
```

**CORS.** The deployed backend's `CORS_ALLOW_ORIGINS` is currently
`https://solarvipani.com` and `https://www.solarvipani.com` only. **`localhost` is not
allowed** — run the backend locally rather than pointing a local frontend at Cloud Run.
The backend's own `.env` needs your dev origin in `CORS_ALLOW_ORIGINS`; Vite defaults to
port 5173. If `CORS_ALLOW_ORIGINS` is deployed empty the middleware is not installed at
all, and `/health` still answers green while every browser request fails.

**Timeouts.** 300s per request. `min-instances: 0`, so the first request after idle
cold-starts. Do not set a client timeout under ~30s.

## §C — The `/api/chatbot` contract

Request (camelCase on the wire):

```jsonc
{
  "userMessage": "What is the subsidy for a 3kW system?",
  "history": [ { "role": "user", "content": "..." } ],   // last 8 turns
  "leadProfile": { "name": null, "phone": null, /* ... */ },
  "conversationContext": {}                              // optional
}
```

Response — **NDJSON, not SSE.** No `data:` prefix. Split on newlines, `JSON.parse` each
non-empty line.

```jsonc
{"type": "intent",   "label": "subsidy_inquiry", "stage": "consideration", "confidence": 0.86}
{"type": "context",  "updates": {"activeObjective": "solar_assessment"}}
{"type": "questions","objective": "...", "items": [...], "slots": [...]}   // DROPPED — see Phase 4
{"type": "tool",     "name": "generate_cad_drawing", "result": {...}}
{"type": "workflow", "name": "...", "eventId": "...", "status": "..."}
{"type": "delta",    "text": "Sure"}                     // repeated; concatenate in order
{"type": "sources",  "items": [{"title": ..., "url": ...}]}
{"type": "usage",    "input": 812, "output": 143, "total": 955, "costINR": 0.42}
{"type": "done"}
{"type": "error"}
```

Ordering that must be designed around:

- `intent`, `context`, `questions` **can arrive before the first `delta`** — buffer them.
- `sources` and `usage` arrive **after** the last `delta`.
- A turn ends with `done` or `error`.
- Only `delta` is required for a usable UI. Ignore unknown types rather than switching
  exhaustively, so the backend can add events freely.

## §D — Data shapes and constants

**`ChatMessage`**

```ts
{
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  error?: boolean;         // failed turn — shows Retry
  userMessage?: string;    // on error messages: what to resend
  stopped?: boolean;       // user aborted mid-stream
  sources?: { title: string; url: string }[];
  toolExecuted?: string;
  toolResult?: unknown;
  intent?: { intent: string; journeyStage: string; confidence: number };
  usage?: { input: number; output: number; total: number; costINR: number };
}
```

**`LeadProfile`** — all fields default `null`:

`name`, `phone`, `email`, `location`, `pincode`, `propertyType`, `propertySubtype`,
`roofType`, `monthlyConsumption`, `monthlyBill`, `powerCutHours`, `budgetRange`,
`timeline`, `hasDocuments`, `recommendedSystemSize`, `systemType`, `systemCost`,
`subsidyAmount`, `netInvestment`, `activeObjective`.

The server folds the whole profile into the system prompt each turn — the LLM is
stateless per request, so it all goes up every time.

**`CONTEXT_TO_PROFILE`** — backend `context.updates` key → profile field. A key not in
this map means the agent will keep re-asking for it, so warn in dev:

```ts
{ name: 'name', location: 'location', propertyType: 'propertyType',
  roofType: 'roofType', monthlyElectricityBill: 'monthlyBill',
  electricityConsumption: 'monthlyConsumption', budgetRange: 'budgetRange',
  timeline: 'timeline', hasDocuments: 'hasDocuments',
  activeObjective: 'activeObjective' }
```

**Tool → widget dispatch**

| `toolExecuted` | Widget |
| --- | --- |
| `generate_quotation` | `QuotationDisplay` |
| `calculate_roi` | `RoiDisplay` |
| `book_site_visit` | `BookingDisplay` (`type="site_visit"`) |
| `offer_lead_form` | `LeadFormCard` |
| `calculate_system_size` | `SystemSizeDisplay` |
| `check_subsidies` | `SubsidyDisplay` |
| `generate_cad_drawing` | `CadDrawingDisplay` |
| `search_knowledge_base` | `KnowledgeBaseDisplay` |
| *anything else* | `GenericToolDisplay` |
| `collect_customer_info`, `scrape_website` | **render nothing** |

**Intent and journey-stage enums**, from the backend's `app/schemas/intents.py`. These
are the complete sets the `intent` event can carry, and `IntentBadge` maps every one of
them to a customer-facing label. A value outside these lists means the backend enum has
grown; the badge title-cases the raw name rather than showing nothing.

```
JourneyStage: awareness | consideration | decision | installation | support

UserIntent
  awareness:      general_inquiry, how_solar_works, benefits_inquiry
  consideration:  pricing_inquiry, system_sizing, roi_calculation, subsidy_inquiry,
                  technical_question, comparison_request
  decision:       request_quotation, book_site_visit, financing_inquiry,
                  eligibility_check, installer_inquiry
  installation:   request_cad_drawing, installation_timeline, document_request
  support:        maintenance_inquiry, troubleshooting, contact_request, other
```

The same file's `CustomerContext` is the authoritative source for `CONTEXT_TO_PROFILE`
above, and confirms the ten keys listed there are the complete set the server sends.

**localStorage keys:** `chatMessages`, `leadProfile`, `chatVoiceOutput` (`"1"` / `"0"`).

**Welcome message** (raw HTML, hence `rehype-raw`):

```
<p>Hi! I'm the Solar Vipani assistant. Ask me anything about going solar — costs, subsidies, system sizing, or brands.</p>
```

**Starter prompts:** "How much can I save with solar?" · "What government subsidies am I
eligible for?" · "What size system does my home need?" · "How much maintenance do solar
panels need?"

**Lead form validation regexes:** name non-empty · phone `/^\+?\d{10,16}$/` ·
pinCode `/^\d{6}$/` · email `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` · type non-empty ·
comment non-empty.

**Consultation types:** `Residential - Independent Home`,
`Residential - Apartments/Housing societies`, `Business/Commercial`.

## §E — Known gap: lead submission

`LeadFormCard` in the Svelte app POSTs to `/in/api/submitLead` — a **SvelteKit server
route**, not FastAPI. It validates, writes to Postgres via `insertLead()`, and fires a
confirmation email. A standalone React SPA has no server, so this path has nowhere real
to go.

**Decision: mock it.** A dev-only handler (MSW, or Vite middleware) answers
`POST /api/submit-lead` with `{ success: true, id: "MOCK-<n>" }`. The form, validation,
prefill, error and success states all get built and exercised; only the DB write is fake.

If this ever needs to be real, the options were: (a) add a lead endpoint to FastAPI —
cleanest, but duplicates schema, DB access and email in Python; or (b) call the deployed
SvelteKit route cross-origin — needs CORS on the Svelte app and risks junk rows in the
production leads table.

Note the widget is the *only* path from the agent to the leads table — the agent cannot
write leads itself. Keep the confirmation honest: never claim a success that did not
happen.

---

## Open questions

- Theme toggle: the Svelte app has `themeStore.svelte.ts` and `mode-watcher`. Deferred to
  Phase 10 — decide then whether to port a full toggle or hardcode light mode.
- `workflow` events are documented but not handled by the Svelte client. Left unhandled
  here too, pending a reason to render them.

## Session log

| Date | Phase | Notes |
| --- | --- | --- |
| 2026-07-29 | — | Plan written. Svelte source and backend contract surveyed; all decisions in the table above locked. No code written yet. |
| 2026-07-29 | 0 | Scaffold done and verified. Deviations from the plan, all agreed at the time: (1) **oxlint, not ESLint** — `create-vite` v9 ships oxlint by default and the scaffold arrives pre-wired with the react-hooks rules; adding ESLint meant removing that and taking on ~8 devDeps plus a flat config for no gain here. (2) **`"strict": true` added explicitly** to `tsconfig.app.json` — the v9 scaffold no longer sets it and I could not confirm TS 6 makes it the default; `LeadProfile` is all-nullable, so this matters. (3) `git init` skipped, repo already existed. |
| 2026-07-29 | 0 | Three scaffold traps worth remembering. (a) `shadcn init` **rewrote the brand palette in place** — it replaced every HSL token with its own neutral oklch values while leaving the original comments, so `--primary` read `oklch(0.205 0 0) /* #FF6600 */`. Restored `index.css` from the Svelte original and re-added only the two imports shadcn actually needs (`tw-animate-css`, `shadcn/tailwind.css`); its `@layer base` reset and `@theme inline` block were both dropped, the first because the ported CSS already does all of it, the second because it maps `--color-*` to the bare token and would break the `hsl()` wrapper the HSL triplets require. **Re-run `shadcn add` with care — check `git diff src/index.css` afterwards.** (b) The CLI reads the **root `tsconfig.json`**, which in the v9 scaffold is solution-style with no `compilerOptions`; without `paths` duplicated there it silently writes components into a literal `@/` directory. (c) A stale lockfile left `tslib` (a `recast` dep) uninstalled and every `shadcn add` crashed — `rm -rf node_modules package-lock.json && npm install` fixed it. |
| 2026-07-29 | 1 | Types and stream client done, verified by scratch script. One design decision needed your call: **unknown event types**. The plan says they "pass through and are ignored downstream", but a bare `{ type: string }` catch-all in the union destroys narrowing on every other member — verified with tsc, `case 'delta'` stops seeing `.text`. Chosen fix: unknown events are yielded as `{ type: 'unrecognised', raw }`, a member with its own literal discriminant. Events genuinely pass through, narrowing stays exact, and Phase 4 ignores them in a `default` branch. `isKnownEventType` in `types.ts` is the routing set — **add new event types there as well as to the union**, or they arrive wrapped as unrecognised. |
| 2026-07-29 | 1 | Two deliberate departures from the Svelte original, both agreed. (1) **The trailing partial line is flushed** at stream end, so a final event with no trailing `\n` is not lost; the Svelte version discards the leftover buffer. (2) The generator **returns after yielding `done`** and cancels the reader in a `finally`, so an early `break` by the consumer releases the connection rather than leaving it open. Also added `decoder.decode()` with no argument at the end to flush a half-decoded multi-byte character — there is a test for `₹` split across a chunk boundary. |
| 2026-07-29 | 1 | `api.ts` now reads `import.meta.env?.VITE_API_BASE_URL` (optional chaining). Vite injects `import.meta.env`, so the module threw at import time under plain Node, which blocked scratch verification. Vitest does provide it, so this is not needed for Phase 9 — it just keeps the module importable outside a bundle. |
| 2026-07-29 | — | **Published to <https://github.com/arkanere/solar-agent-frontend> (public).** `origin` now exists, branch was already `main`, so commit straight to `main` and push as CLAUDE.md says. Before the first push the history was rewritten with `git filter-repo` to strip the home-directory path from all three commits — **every commit SHA changed**, so any other clone of this repo is on orphaned history and must be re-cloned, not pulled. See §A: keep paths `~`-relative from here on. Cloud Run URL and the CORS notes were kept on purpose; they are useful to anyone running this locally and the URL is already public in the deployed frontend. |
| 2026-07-29 | — | The repo has **no README** — the public landing page is bare. That is not an oversight: the plan schedules it for Phase 10. Worth pulling forward if the repo is going to be shared before then. |
| 2026-07-31 | 2 | Store done and verified. One conflict inside the phase spec itself: `persist` writes **one** key holding a `{ state, version }` envelope, but the phase also requires the Svelte app's **three bare keys** with `chatVoiceOutput` as `"1"`/`"0"`. Kept the middleware and gave it a custom `PersistStorage` (`chatStorage`) that fans out to the three keys on write and reassembles the slice on read — carrying a live session between the two implementations only works if the on-disk format matches exactly. It is typed against the partialized slice, so a new persisted field has to be added to `partialize` **and** to both halves of the adapter. |
| 2026-07-31 | 2 | Three judgement calls in the store, all flagged rather than assumed. (1) **`reset()` does not clear `voiceOutputEnabled`** — it is a persisted *mode* the user chose, not conversation state, and Phase 6 states as much. (2) **`setLeadProfile` merges a `Partial`** rather than replacing wholesale; every caller (context updates, lead-form prefill) knows a few fields, none knows all twenty. (3) `applyContextUpdates` writes through `patch[field] = value as never` — the map's value type is `keyof LeadProfile`, so TS cannot tie a key to its own field type. It means a wrongly-typed server value (`hasDocuments: "yes"`) would be stored as-is; if that ever bites, the fix is per-field coercion, not a bigger cast. |
| 2026-07-31 | 2 | Scratch verification could not run from the scratchpad: the store imports `@/lib/types`, and resolving that alias needs the repo's `tsconfig.json`, so the script ran from the repo root as a `.mts` (`type: module` is set there; a `.ts` in the scratchpad transpiles as CJS and rejects top-level `await`) and was deleted afterwards. Node 24 has no `localStorage` without `--experimental-webstorage`, so the script defines one over a `Map`. Phase 9 gets this for free from jsdom. |
| 2026-07-31 | 3 | **The Svelte original is no longer on this machine** — `~/Developer/svelte/solar-app` does not exist, so §A's source map cannot be followed and nothing in Phase 3 was ported by reading it. Everything came from this document's §D instead, which is what it was written for. Two consequences. (1) Phase 3's "visually indistinguishable side by side" could not be run as written; the UI was verified against the spec, not against the original. (2) `format.ts` was **reimplemented from the function names**, so `formatLakh` (`₹2.5 L`), `formatThousand` (`₹18.5 K`) and `humanizeToolName` (`Generate CAD Drawing`, via a small acronym set so CAD/ROI/kWh do not render as "Cad") are my reading of the intent, not the original's output. They are unused until Phase 7 — **check them against a real widget then**, or against the deployed site. `formatCurrency`/`formatNumber` are `en-IN` `Intl` calls and are not in doubt. All of them take `string \| null \| undefined` and return an em dash, because tool payloads are loosely typed and `₹NaN` in a quotation is worse than a blank. |
| 2026-07-31 | 3 | Judgement calls. (1) `ChatBox` reads the store directly but takes `onSend`/`onStop`/`onRetry`/`onRegenerate` as props — Phase 4 supplies them from `useChat` without the component having to change. The action props are optional, and each affordance renders only when its handler exists, so nothing in the demo host is a dead button. (2) The scroll-anchoring flag is a **ref, not state**: it changes on every scroll event and no render reads it. (3) `App.tsx` lost the scaffold token gallery; its `onSend` only records the customer's turn until Phase 4. (4) Message content is rendered as plain text with `whitespace-pre-wrap`, so the welcome message currently shows its literal `<p>` tags — that is Phase 5's job and not a bug. |
| 2026-07-31 | 3 | Worth knowing: the dev server came up with a **transcript already in `localStorage`** from the Svelte app on the same origin (both dev on `:5173`), and the React app rendered it — unplanned but real proof that Phase 2's shared-key persistence carries a session across the two implementations. Verification then overwrote `chatMessages` with a fixture and cleared it afterwards, so that Svelte session is gone. If a stored transcript ever matters, back the key up before running the React dev server. |
| 2026-07-31 | 4 | Streaming wired. **Verified against a mock backend, not the real one** — `~/Developer/solar-agent-backend` exists but this session could not read it (the sandbox refused to list the directory, so its `.env` and whether it can start at all are unknown), and running the real agent costs model calls. The mock spoke §C's event ordering exactly, including a `questions` event and an unknown type, and every branch of the hook was exercised through it. **The one thing still outstanding for this phase is a single run against `uv run uvicorn app.main:app --reload`** — the wiring is contract-level identical, so what that would catch is a contract drift in §C, not a bug in the hook. |
| 2026-07-31 | 4 | Judgement calls in `useChat`. (1) **A failed turn patches the partial reply rather than appending a second message.** The plan says "append an assistant message with `error: true`", which is right when nothing streamed, but appending when half a reply is already on screen leaves an orphaned partial above the error. So: if deltas arrived, the error line is appended to that message's own content and it is marked `error`; if none did, a fresh message is appended. Retry drops the message either way, so the partial is discarded on retry — that is the correct outcome, since the retried turn re-answers from scratch. (2) **`context` events are not buffered** with the rest. They are lead-profile state, not message metadata; holding one back until a delta arrives would mean losing it entirely on a turn that streams nothing. (3) **Stop does not bump the run counter, reset does.** Both abort, but a stopped turn's partial must land and a cleared turn's must not, so the fence is on `reset` alone. (4) A turn that emits no delta but did emit `tool`/`intent` flushes into an assistant message with **empty content** — a tool-only turn is a real outcome, and Phase 7 renders the widget with no prose above it. |
| 2026-07-31 | 4 | Two things worth knowing. (1) **The welcome message goes up in `history`** as an assistant turn, raw `<p>` tags and all. It is what the customer actually saw, and `toHistory` was built in Phase 1 to pass everything non-error through, so this is deliberate rather than overlooked — but it is a few tokens of markup on every request, and stripping it is a one-line change if it ever reads badly in a prompt dump. (2) `ChatBox` gained an `onReset` prop and **lost `disabled={isLoading}` on Clear conversation** — clearing mid-stream is now allowed, which is the whole point of aborting in `reset`. |
| 2026-07-31 | 5 | **The backend source is readable after all** — `Read` and `grep` work on `~/Developer/solar-agent-backend` even though the sandbox refuses to `ls` it. That is how §D's intent and journey-stage enums got written from `app/schemas/intents.py` rather than invented, which matters: `IntentBadge` covers all 21 intents and 5 stages exactly. Worth remembering for the remaining phases — the widget payload shapes Phase 7 needs are probably in `app/schemas/` too, and reading them beats guessing from the tool names. |
| 2026-07-31 | 5 | **`rehype-raw` is an XSS decision, not just a rendering one**, and the plan's locked-decisions table does not say so. Turning it on switches off react-markdown's blanket refusal to render HTML, and reply text is model output from an agent whose toolset includes `scrape_website` — a page the model reads can try to talk it into emitting markup. `Markdown.tsx` replaces the protection rather than dropping it: an element allowlist (no `script`/`iframe`/`style`/`form`/`img`), a small local rehype plugin that deletes every `on*` attribute and cuts script-like subtrees out whole, and react-markdown's built-in `urlTransform` for `javascript:` hrefs. Verified by injecting all four vectors at once. **This is not a full sanitiser** — it is an allowlist I wrote, not an audited one. `rehype-sanitize` is the real answer (one dep, ~10 kB, drops in as another rehype plugin) and is worth taking before this goes anywhere near production. Flagged rather than added, since deps are your call. |
| 2026-07-31 | 5 | Smaller calls. (1) **The customer's own turns are not rendered as markdown** — their line breaks are meaningful and their asterisks are not emphasis. Only assistant content goes through `Markdown`. (2) `Markdown` is **memoised on the source string**, because during streaming it re-parses on every delta and without it each chunk re-parses every earlier reply in the transcript too. (3) All six heading levels render as `h4` — a chat bubble has no document outline, and the plan specifies `h4` semibold. (4) An assistant message with **empty content renders no bubble at all** (a tool-only turn), so Phase 7's widget will stand alone rather than under an empty box. (5) `stripHtml` parses with `DOMParser` rather than regex-stripping, so `&amp;` reaches the clipboard as `&`; it deliberately leaves markdown alone, since markdown is readable as-is and the plan only asked for HTML. |
| 2026-07-31 | — | Noticed while reading `FRONTEND_INTEGRATION.md` for the intent enums, and **not acted on**: the deployed backend can require an `X-API-Key` header on every `/api` route when `API_KEYS` is set, and `src/lib/api.ts` sends no such header. Local dev is unaffected (`API_KEYS` unset), so nothing is broken today — but a production build against Cloud Run would get a blanket `401`. Belongs with Phase 10's "production build check against the deployed backend URL". The doc is candid that a `PUBLIC_`-prefixed key is readable in devtools and is drive-by-traffic filtering, not authentication. |
| 2026-08-01 | 6 | Voice done. Architecture call worth recording: **both voice hooks are composed inside `useChat`, not inside `Composer`.** The phase reads as a composer feature, but three of its own requirements pull the other way — a completed turn has to start playback (only the streaming loop knows a turn completed cleanly), `reset` has to stop the recorder *and* playback, and starting a recording has to stop playback. Owning them in the composer would mean passing callbacks up into the hook and back down again. So `useChat` exposes one `voice` object (`VoiceApi`) and `Composer` is presentational for all of it; `ChatBox` just forwards the prop, and a host that omits it gets a text-only composer with no dead buttons. |
| 2026-08-01 | 6 | Judgement calls in the voice hooks. (1) **Speaking is keyed off the turn ending in the `try` block**, not off a message flag — a stopped or failed turn leaves through `catch`, so it is structurally impossible for either to be read aloud, rather than depending on a check someone could later remove. (2) **The speaker toggle does not speak the reply already on screen.** It is a mode ("read replies to me from now on"), matching how it is persisted; speaking the last reply on toggle would also fire on a page the customer had scrolled away from. (3) `stripMarkdown` drops link *targets* and keeps link text, and drops fenced code entirely — a read-aloud URL is unusable and a JSON payload read aloud is worse than silence. (4) The recorder's `stop()` resolves from the `MediaRecorder`'s own `stop` event rather than after a timeout, so the last chunk is always in the blob. (5) A denied microphone stays disabled for the rest of the session: `permission` is re-synced on mount only. Granting it in browser settings needs a reload in practice anyway, and polling the Permissions API for a state that rarely changes is not worth it. |
| 2026-08-01 | 6 | Two things to know for later phases. (1) **`stripMarkdown` is a regex pass, not a parser**, so pathological markdown can leak a stray marker into the spoken text. That is a cosmetic failure in audio, not a security one — unlike `Markdown.tsx`, nothing here renders. (2) The `useSpeechPlayer` request-ID guard has a subtlety Phase 9 should test directly: a *superseded* clip's own `ended`/`error` handlers are guarded too, and the stale-response paths tear down only their own audio element rather than calling the shared `release()`. Without that, a late response from an abandoned request cleans up the clip that replaced it — the bug this shape exists to prevent. |
| 2026-08-01 | 7 | Widgets done. **The payload shapes were read out of the backend, not guessed** — `app/services/tool_executor.py` builds every one of them literally, so each widget's payload interface is a transcription of the dict its tool returns, and the fixture used for verification is the same. Two things that only reading it would tell you: the tool `result` on the wire is the handler's `data` field alone (the `success`/`message`/`error` envelope is consumed server-side), and its keys are **snake_case** — the server camelCases its own events but passes tool data through verbatim. Also settled Phase 3's open question: `format.ts` was written blind, and `formatCurrency`/`formatNumber` read correctly against real figures here. `formatLakh`/`formatThousand`/`humanizeToolName` are still unused — no widget wanted a compact form, and the tool badge became the generic widget's title instead. |
| 2026-08-01 | 7 | Judgement calls. (1) **Widgets sit outside the message bubble, not inside it.** A quotation inside a 46-character bubble is unreadable, so `ToolResultDisplay` renders as a sibling under the prose. A tool-only turn already dropped its empty bubble in Phase 5, so the widget stands alone exactly as that comment promised. (2) **Each widget declares its own payload interface and the dispatcher casts.** Nothing validates these on the way in and a runtime validator is a dependency and a maintenance burden for a payload we do not control; instead every field is optional and every formatter answers an em dash, so a missing field is a blank, not a crash. (3) `check_subsidies` sends `subsidy_amount` as **prose** ("₹30,000 per kW (40% subsidy)") and only sometimes a numeric `total_subsidy` — the widget renders the prose as given rather than trying to parse a figure out of it. (4) The CAD utilisation figure arrives as a **string**, and the fixture's 118.4% is not hypothetical: the tool's own layout maths can exceed the roof it was given. |
| 2026-08-01 | 7 | Two notes on `LeadFormCard`, which is the one widget that can mislead a customer. (1) **The confirmation is shown only on a real `success: true`**, never optimistically — §E is explicit that this widget is the sole path to the leads table and that the confirmation must stay honest, and it is now the only widget with a verified negative test. (2) On success it writes name/phone/email/pincode back into the lead profile, so the agent stops asking for details the customer has just typed. The phone is stored **as typed**, spaces and all; validation strips separators to test the pattern but does not normalise the value, matching how the profile stores everything else the customer said. |
| 2026-08-01 | 8 | App shell done. **`ChatbotPopup` takes the chat handlers as props instead of calling `useChat`.** The demo page shows the chat twice, and a second `useChat` would mean a second `AbortController` and a second speech player: Stop in the popup would not reach a turn started on the page, and a reply could be read aloud twice over itself. The store was always shared (it is a module singleton); this makes the *hook* shared too, which is the part that actually holds the request. |
| 2026-08-01 | 8 | **`isManuallyDismissed` could not be ported faithfully** — the Svelte original is not on this machine (see the Phase 3 entry), so what it gated is unknown. Most likely it suppressed an automatic open. Nothing here opens the popup on its own, so the flag is recorded on a manual close and nothing reads it yet; if auto-open is wanted, the rule to honour is already in place. **Worth confirming against the deployed site** whether the Svelte popup opens itself after a delay. |
| 2026-08-01 | 8 | A verification trap worth knowing for the rest of this port: **Chrome does not advance CSS animations in a hidden tab**, and the automated tab is always hidden. Radix keeps a closing dialog mounted until its exit animation ends, so the popup appeared to leave a `[role="dialog"]` node behind with `data-scroll-locked` stuck on `<body>` — which reads exactly like a real scroll-lock leak. It is not: disabling the exit animation made teardown complete immediately, on both a fresh cycle and the already-stuck node. Assert on `data-state="open"` rather than on the node's existence, and do not trust animation-gated cleanup in this environment. |
| 2026-08-01 | 9 | Tests done: 172 across 12 files. Config went in `vite.config.ts` rather than a separate `vitest.config.ts` so the `@` alias and the dev middleware are not duplicated. Two harness details that cost time and will cost it again: (1) **a mocked `fetch` must error its body stream on abort**, the way the real one does — otherwise the hook's read loop sits on a stream nothing ends and Stop looks like a hang, when it is the mock that is wrong; (2) `userEvent.setup()` **installs its own `navigator.clipboard`**, so a clipboard spy has to be defined *after* it, and via `defineProperty` because jsdom's is getter-only. |
| 2026-08-01 | 9 | The store tests import the module fresh per scenario (`vi.resetModules()` then `await import`), because `persist` rehydrates once at import time — anything about what was already in localStorage is untestable otherwise. One real fix came out of writing these: `stripMarkdown` left a whitespace-only line behind where it had removed a fenced code block, which TTS reads as a pause; it now clears those lines. Everything else passed as written. |
| 2026-07-29 | 0 | Prettier is scoped deliberately: `*.md`, `src/index.css` and `src/components/ui` are in `.prettierignore`. The plan and CLAUDE.md are prose, the ported CSS should stay diffable against the Svelte original, and the shadcn components should stay as the CLI emits them. Also noted: the `--font-sans` stack asks for Inter but nothing loads it — it falls back to system-ui, exactly as in the Svelte app, so parity holds and no font dependency was added. |
