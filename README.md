# Solar Agent Frontend

A React chat widget for the Solar Vipani solar-advice assistant: a client-side SPA that
talks to a separate FastAPI backend over a streaming NDJSON endpoint. It is a port of an
existing Svelte 5 implementation.

Vite · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Zustand.

## What it does

- Streams replies token by token, with stop, retry and regenerate
- Renders markdown, citations, and the agent's intent and token-cost metadata
- Speaks: record a question with the microphone, and optionally have replies read aloud
- Renders tool results as widgets — quotation, ROI, system sizing, subsidies, panel
  layout, site-visit booking, knowledge-base extracts, and a consultation form
- Keeps the conversation in `localStorage`, in the same shape as the Svelte app, so a
  session survives a reload

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
```

The chat needs the backend to answer. Run it locally, in its own checkout:

```bash
uv run uvicorn app.main:app --reload    # http://localhost:8000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server, with the API proxy and the mock lead endpoint |
| `npm run build` | Type-check and build to `dist/` |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Watch mode |
| `npm run lint` | oxlint |
| `npm run format` | Prettier |

## Configuration

One variable, in `.env` (copy `.env.example`):

```sh
VITE_API_BASE_URL=
```

**Leave it empty for local development.** `apiUrl()` then produces relative paths, and
Vite's proxy forwards `/api/chatbot`, `/api/transcribe`, `/api/speak` and
`/api/generate-cad` to `http://localhost:8000`. Because the browser stays on one origin,
CORS never comes up. Set it to the deployed backend's URL only for a production build.

### The CORS caveat

The deployed backend's `CORS_ALLOW_ORIGINS` lists the production site only —
**`localhost` is not allowed**. Pointing a local frontend at the deployed backend
therefore fails in the browser even though `/health` answers green. Run the backend
locally instead, or add your dev origin to the backend's own `CORS_ALLOW_ORIGINS`.

Two related notes:

- If `CORS_ALLOW_ORIGINS` is deployed empty, the middleware is not installed at all and
  every browser request fails while `/health` still looks healthy.
- The deployed backend can require an `X-API-Key` header when `API_KEYS` is set. This
  client does not send one, so a production build against a key-protected deployment
  would get a blanket `401`.

### Cold starts

The backend runs with `min-instances: 0`, so the first request after a quiet period waits
for a container to start. This client sets **no request timeout at all** — the browser's
own is the only limit. Do not add one under ~30 seconds.

## How it fits together

```
src/
  lib/         stream parsing, the chat and speech clients, formatting, validation
  store/       one Zustand store: messages, lead profile, persistence
  hooks/       useChat (a turn end to end), the recorder, the speech player, theming
  components/
    chat/      ChatBox, Composer, MessageBubble, markdown rendering, the popup
    chat/widgets/  one component per agent tool result
    ui/        shadcn primitives, as the CLI emits them
```

`useChat` owns everything imperative about a turn: the request, the streaming loop, the
`AbortController`, the microphone and audio playback. Components read state from the
store and call handlers; a host rendering the chat in more than one place should call
`useChat` once and pass the handlers to both, as `App.tsx` does.

## Lead submission is mocked

The consultation form has no real endpoint here. In the Svelte app it posts to a SvelteKit
server route that writes to Postgres; a standalone client has no server, and the FastAPI
backend has no lead endpoint. In development a Vite middleware answers
`POST /api/submit-lead` with `{ success: true, id: "MOCK-0001" }`.

The middleware is dev-only. In a production build the request 404s and the form shows its
failure state — deliberately, because this widget is the only path from the conversation
to the leads table, and a confirmation for a lead nobody received would be worse than an
error the customer can retry.

## Contributing

`implementation-plan.md` is the working record: the phase checklist, the decisions and why
they were made, and a session log of everything that was verified and everything that was
not.
