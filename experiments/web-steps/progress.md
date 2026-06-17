# Progress

- Created plan files.
- Inspected wrapper server/protocol/package and app experiment.
- Replaced protocol with job API types plus legacy state payload types.
- Rewrote wrapper as HTTP job worker with native SSE.
- Removed ws direct deps from wrapper package.json and refreshed pnpm lockfile.
- Updated wrapper README/AGENTS docs.
- Replaced app experiment WebSocket client with POST job + SSE fetch-stream client.
- Ran wrapper build: passed.
- Ran server build: passed.
