# Task Plan

Goal: Convert Pi wrapper from WebSocket to HTTP job + SSE. Update app experiment to call job API.

## Phases
1. Define job/SSE protocol types - complete
2. Rewrite Pi wrapper server routes - complete
3. Update wrapper package/docs - complete
4. Update app experiment mcp-v2.ts - complete
5. Build/test - complete

## Decisions
- Native Express SSE, no better-sse dependency.
- Per-job AgentSession for isolation.
- In-memory job store for first cut.
- App experiment manually parses SSE via fetch stream; no dependency.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| Wrapper build TS2367 on `job.status === "aborted"` | First build | Cast `job.status as JobStatus` where TS narrowed status too much. |
