# Pi Server Wrapper

Server-side wrapper for the Pi coding agent. It exposes a WebSocket API backed by a system-level Pi `AgentSession` with bash, file read/write/edit, skills, and extension tools.

## Architecture

```
External process
  │  JSON messages over /api/ws
  ▼
Node.js server (Express + ws)
  │  Pi SDK (createAgentSession)
  ▼
System tools (bash, files, skills, extensions)
```

- **Server** (`server/index.ts`): Runs the Pi SDK `AgentSession` with full system access. Loads auth and model config from `~/.pi/agent`. Streams agent events over WebSocket. Fetches models from a local LiteLLM instance.
- **Protocol** (`shared/protocol.ts`): Typed JSON message definitions for the WebSocket wire format.

## Setup

```bash
npm install
npm run build
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server listen port |
| `LITELLM_URL` | `http://192.168.50.240:4000` | LiteLLM API base URL |
| `LITELLM_KEY` | *(from ~/.pi/agent)* | LiteLLM API key (auto-detected from Pi config if unset) |

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

- WebSocket: `/api/ws`
- Health check: `/health`

## Features

- Full Pi agent with system access (bash, read, edit, write, extensions)
- Session persistence and history — create new sessions, browse and resume previous ones
- Model switching (pulls from LiteLLM + Pi model registry)
- Configurable thinking level (off, minimal, low, medium, high)
- Streaming agent events over WebSocket

## Project structure

```
├── server/
│   └── index.ts          Express + WebSocket server, Pi SDK session
├── shared/
│   └── protocol.ts       WebSocket message type definitions
├── tsconfig.json         TypeScript config
└── package.json          Dependencies and scripts
```
