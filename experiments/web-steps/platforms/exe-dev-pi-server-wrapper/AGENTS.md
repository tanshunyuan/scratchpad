# Agent Guidelines for pi-server-wrapper

## Project overview

This is a server-side HTTP job worker for the Pi coding agent. The server runs per-job Pi `AgentSession`s with system-level tools (bash, file I/O, extensions). External processes create jobs with JSON over HTTP and receive progress over SSE. Payload types live in `shared/protocol.ts`.

## Key conventions

- **Server only** — no bundled UI or static frontend.
- **Pi SDK types** come from `@mariozechner/pi-coding-agent` (server) and `@mariozechner/pi-agent-core` / `@mariozechner/pi-ai` (shared types). Do not duplicate SDK types — import them.
- **Protocol changes** must update `shared/protocol.ts` and the Express route handlers.

## Working directory

The agent session defaults to `os.homedir()`. This is passed as `cwd` to `createAgentSession` and `SessionManager.create()`.

## Build and run

- `npm run dev` — server dev mode (`tsx watch server/index.ts`)
- `npm run build` — TypeScript typecheck (`tsc --noEmit`)
- `npm start` — run server
- Job create endpoint: `POST /api/jobs`
- Job events endpoint: `GET /api/jobs/:jobId/events`
- Health endpoint: `/health`

## File layout

- `server/index.ts` — backend (Express, HTTP job API, SSE streaming, Pi SDK sessions, job management)
- `shared/protocol.ts` — HTTP job and SSE payload types shared between server and external processes

## Things to watch out for

- `AgentSessionEvent` objects may contain circular references — the server uses `safeSerializeEvent()` before sending over SSE.
- Keep protocol messages JSON-serializable.
