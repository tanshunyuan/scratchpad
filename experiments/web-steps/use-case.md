# Use Case Summary: AI-Driven Penpot Screen Generation

## What I'm building

A web product where a user can ask, in natural language, to generate a design screen, and that request triggers an AI agent that actually creates the screen inside Penpot (an open-source design tool) by driving a Penpot MCP server. The agent isn't just producing a text response — it takes real action against a live design file via Penpot's MCP tools.

## Architecture (four layers)

```
Browser client (my web app's UI)
        │
        ▼
My orchestration server (talks to the browser, owns the product logic)
        │
        ▼
A remote coding/AI agent — runs on a VPS / cloud server, not locally,
not in the user's browser session
        │
        ▼
Penpot MCP server — the agent calls into this to actually manipulate
the design file
        │
        ▼
Penpot file (the live design canvas)
```

## Key requirements / decisions about how the pieces connect

- **The agent must run remotely**, on its own server/VPS, because it needs to persist, be reachable by the backend at any time, and isn't something a single user's browser session can host.
- **Multi-tenancy**: the agent needs to support multiple separate, isolated sessions — one per user or per project — so different people's work and context don't bleed into each other. No single shared global session.
- **Communication pattern**: the link between my orchestration server and the remote agent is fundamentally "send a request, get a result back" rather than something needing constant two-way back-and-forth — but I do want visibility into progress as it happens (streaming updates), not just a silent wait followed by a final result.
- **Credentials**: API keys and Penpot access tokens must be handled securely server-side only — never exposed to the browser, never baked into a deployable container image. Passed in at deploy/runtime instead.
- **Containerization**: the remote agent needs to be packaged so it can be deployed and run reliably on a VPS (build once, deploy as a container).

## Open / still to figure out

- The exact mechanism for streaming progress from the remote agent back through the orchestration server to the browser.
- How session/tenant keys (per-user or per-project) get assigned and passed through the chain.
- Penpot's MCP server is still relatively new for this kind of "headless server talking to it" pattern — it was originally built more for a developer's local IDE talking to a local Penpot instance, so there may be rough edges to watch for in a remote, multi-user deployment.

## What NOT to re-litigate
- The general shape of the four-layer architecture above is settled.
- The "request → remote agent processes → streamed progress → final result" communication pattern is settled (not pure fire-and-forget, not a fully bidirectional live chat either).
- Multi-tenant session isolation is a hard requirement, not optional.
