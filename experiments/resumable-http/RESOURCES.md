# Resumable HTTP Streams Resources

## Knowledge

- [AI SDK UI: Chatbot Resume Streams](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams)
  Best primary source for the platform pattern: POST creates a stream, GET resumes active stream, storage tracks active stream IDs.
- [AI SDK Troubleshooting: Abort and resumable streams](https://ai-sdk.dev/docs/troubleshooting/abort-breaks-resumable-streams)
  Explains the key trap: page refresh/client abort must not cancel the server-side generation if resume should work.
- [vercel/resumable-stream](https://github.com/vercel/resumable-stream)
  Concrete library showing `createNewResumableStream` and `resumeExistingStream`, with Redis-backed replay/follow behavior.
- [Flue Agents: HTTP interaction](https://flueframework.com/docs/guide/building-agents/#http)
  Shows agent HTTP shape: `POST /agents/<name>/<id>` accepts input; `GET /agents/<name>/<id>` exposes event streaming.
- [MDN: Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
  Browser/SSE reference for `text/event-stream`, `id:`, retry, and reconnect behavior.
- [WHATWG HTML: Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)
  Spec source for `Last-Event-ID` behavior on reconnection.
- [MDN: Using readable streams](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams)
  Reference for consuming streamed `fetch()` responses in browser JavaScript.

## Wisdom (Communities)

- [Vercel AI GitHub discussions/issues](https://github.com/vercel/ai/issues)
  Use for real-world edge cases around AI SDK stream resume behavior.
- [OpenAI Developer Community](https://community.openai.com/)
  Use for model/provider streaming behavior and cancellation gotchas.

## Gaps

- Need inspect one real implementation later: AI SDK example app or `resumable-stream` source, after mental model is solid.
