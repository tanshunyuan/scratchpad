# Mission: Resumable HTTP Streams in TypeScript

## Why
Learn how AI platforms keep a streaming response alive after a browser refresh or disconnect, so you can build the same POST-start / reconnect-resume behavior in a Node + TypeScript app.

## Success looks like
- Explain why POST can start a stream but GET usually resumes it.
- Build a minimal Node server that keeps the producer alive after the client disconnects.
- Resume by stream ID plus event ID, replaying missed chunks before following live chunks.

## Constraints
- Use TypeScript and Node as the learning path.
- Keep examples small and readable.
- Assume resume strategy is new; start from mental model, not framework magic.

## Out of scope
- Full Redis production setup until the in-memory model is clear.
- Deep OpenAI/AI SDK internals beyond what helps implement the pattern.
