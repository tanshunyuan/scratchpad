# Non-resumable SSE works

The user implemented a Node TypeScript endpoint that emits valid SSE frames with `id:` and `data:` lines terminated by a blank line. Future lessons can move from wire format to resumability: separating producer lifetime from HTTP connection lifetime.
