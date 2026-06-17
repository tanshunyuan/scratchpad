# Pi Server Wrapper

HTTP job worker for the Pi coding agent. It accepts long-running agent jobs, streams progress over Server-Sent Events (SSE), and returns final job state/results.

## Architecture

```txt
External app server
  │  POST /api/jobs
  │  GET /api/jobs/:jobId/events
  ▼
Node.js server (Express)
  │  Pi SDK (per-job createAgentSession)
  ▼
System tools (bash, files, skills, extensions, MCP)
```

- **Server** (`server/index.ts`): Runs per-job Pi SDK `AgentSession`s with full system access. Loads auth and model config from `~/.pi/agent`. Streams job events over SSE.
- **Protocol** (`shared/protocol.ts`): Typed job/event payloads.

## Setup

```bash
npm install
npm run build
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server listen port |

## Development

```bash
npm run dev
```

Starts the server with `tsx watch` on port 3001.

## Production

```bash
PORT=8085 npm start
```

## API

### `POST /api/jobs`

Create and start a background Pi agent job.

```json
{
  "prompt": "Draw a dashboard in Penpot",
  "model": { "provider": "...", "id": "..." },
  "thinkingLevel": "medium",
  "metadata": { "projectId": "..." }
}
```

Response:

```json
{
  "jobId": "...",
  "status": "queued"
}
```

### `GET /api/jobs/:jobId/events`

SSE stream. Replays existing events, then streams new events.

Events:

- `status`
- `agentEvent`
- `stateSync`
- `done`
- `error`
- `aborted`

### `GET /api/jobs/:jobId`

Returns current job info, status, result/error, event count.

### `POST /api/jobs/:jobId/abort`

Abort running job.

### `GET /api/models`

Returns models from Pi model registry.

### `GET /health`

Health check.

## Features

- Per-job Pi agent sessions
- Job status/result tracking
- SSE progress streaming
- Session isolation between jobs
- Model selection per job
- Configurable thinking level per job
