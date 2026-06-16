**Best Design**

Use **queue + request ID + result store**. Direct server -> Pi HTTP bad if Pi not public.

Flow:

```text
Browser -> Backend POST /generate
Backend -> Queue job { requestId, prompt }
Pi agent -> polls/opens outbound WebSocket to queue/server
Pi agent -> generates text
Pi agent -> writes result { requestId, text }
Backend -> returns result to browser
```

**Why**
- Pi can live behind NAT/firewall.
- Pi only needs outbound internet.
- Backend never needs Pi public IP.
- Queue gives retry, timeout, backpressure.

**With Rivet agentOS**

Rivet has built-in agent sessions. Docs show Pi session creation and `sendPrompt`, returning `{ text }` from agent response: [Pi docs](https://rivet.dev/docs/agent-os/agents/pi/). Docs also recommend queues for agent work, durable messages, serial processing, and completable request/response jobs: [Queues docs](https://rivet.dev/docs/agent-os/queues/).

Practical backend path:

```ts
app.post("/generate", async (req, res) => {
  const { prompt } = req.body;

  const handle = client.generator.getOrCreate(["main"]);

  const result = await handle.send(
    "generate",
    { prompt },
    { wait: true, timeout: 120_000 },
  );

  if (result.status !== "completed") {
    return res.status(504).json({ error: "agent_timeout" });
  }

  res.json({ text: result.response.text });
});
```

Worker/actor:

```ts
const generator = actor({
  queues: {
    generate: queue<{ prompt: string }, { text: string }>(),
  },

  run: async (c) => {
    const agent = c.actors.vm.getOrCreate(["pi-agent"]);

    const session = await agent.createSession("pi", {
      env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY! },
    });

    for await (const message of c.queue.iter({ completable: true })) {
      const response = await agent.sendPrompt(
        session.sessionId,
        message.body.prompt,
      );

      await message.complete({
        text: response.text,
      });
    }
  },
});
```

**Browser Pattern**

For fast jobs: browser waits on `/generate`.

For slow jobs: better:

```text
POST /generate -> { jobId }
GET /generate/:jobId -> { status, text? }
or SSE/WebSocket -> stream progress
```

**Recommendation**

Use **Rivet queues with completable messages** if using agentOS. If Pi is truly separate/private machine, make Pi run a worker that connects outbound to backend/queue. Do not require inbound connection to Pi.
