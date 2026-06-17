# Findings

- Wrapper previously used Express + ws at `/api/ws`, one global AgentSession.
- Replaced with job API: `POST /api/jobs`, `GET /api/jobs/:jobId/events`, `GET /api/jobs/:jobId`, `POST /api/jobs/:jobId/abort`, `GET /api/models`.
- `session.prompt()` is awaited inside job runner; job emits `done` after prompt finishes.
- Native SSE writes `id`, `event`, and JSON `data`; existing events replay on connect.
- Each job gets its own `AgentSession` and `SessionManager.create(HOME_DIR)`.
- `ws` removed as direct dependency. Lock still contains `ws` transitively via OpenAI/Pi deps.
- App experiment uses fetch stream + manual SSE parser, exits on `done`, `error`, or `aborted`.
