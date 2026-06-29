import http from "node:http";
import crypto from "node:crypto";
import { env } from "./env.js";
import { readFile } from "node:fs/promises";

type StreamEvent = {
  id: number;
  data:
    | {
        type: "run";
        runId: string;
      }
    | {
        type: "delta";
        delta: string;
      };
};

type Run = {
  id: string;
  nextEventId: number;
  events: StreamEvent[];
  listeners: Set<http.ServerResponse>;
  done: boolean;
  cancelled: boolean
};

const runs = new Map<Run["id"], Run>();

const writeEvent = (
  res: http.ServerResponse<http.IncomingMessage>,
  event: StreamEvent,
) => {
  res.write(`id: ${event.id}\n`);
  res.write(`data: ${JSON.stringify(event.data)}\n\n`);
};

const emit = async (run: Run, data: StreamEvent["data"]) => {
  const event: StreamEvent = {
    id: run.nextEventId++,
    data,
  };
  run.events.push(event);
  run.listeners.forEach((listener) => {
    writeEvent(listener, event);
  });
};

const attach = async (
  req: http.IncomingMessage,
  res: http.ServerResponse<http.IncomingMessage>,
  run: Run,
  after: number,
) => {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });

  if (run.events.length > 0) {
    // replay events
    for (const event of run.events) {
      if (event.id > after) writeEvent(res, event);
    }
  }

  if (run.done) {
    res.end();
  } else {
    run.listeners.add(res);
  }

  req.on("close", () => {
    run.listeners.delete(res);
  });
};

const startProducer = async (run: Run) => {
  for (let i = 0; i < 10; i++) {
    if (run.cancelled) break;

    const id = i + 1;
    emit(run, { type: "delta", delta: `token-${id}` });
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  run.done = true;
  for (const listener of run.listeners) listener.end();
  run.listeners.clear();
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url!, `http://${env.HOST}:${env.PORT}`);

  if (parsedUrl.pathname === "/" && req.method === "GET") {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(await readFile("client.html", "utf-8"));
    return;
  }

  if (parsedUrl.pathname === "/runs" && req.method === "POST") {
    const runId = crypto.randomUUID();
    // start a run
    const run: Run = {
      id: runId,
      nextEventId: 1,
      events: [],
      listeners: new Set(),
      done: false,
      cancelled: false
    };
    attach(req, res, run, 0);
    writeEvent(res, { id: 0, data: { type: "run", runId } });

    runs.set(run.id, run);
    startProducer(run);
    return;
  }

  const stopMatch = parsedUrl.pathname.match(/^\/runs\/([^/]+)\/stop$/);

  if (stopMatch && req.method === "POST") {
    const id = stopMatch[1];
    const run = id ? runs.get(id) : undefined;

    if (!run) {
      res.writeHead(404).end("run not found\n");
      return;
    }

    run.cancelled = true;
    run.done = true;

    for (const listener of run.listeners) listener.end();
    run.listeners.clear();

    res.writeHead(204).end();
    return;
  }

  const match = parsedUrl.pathname.match(/^\/runs\/([^/]+)\/events$/);

  if (match && req.method === "GET") {
    const id = match[1];
    const after = Number(parsedUrl.searchParams.get("after") ?? 0);
    if (!id || !runs.has(id)) {
      res.writeHead(404).end("cannot find lah");
      return;
    }
    const run = runs.get(id)!;
    attach(req, res, run, after);
    return;
  }

  res.writeHead(404).end("not found\n");
  return;
});

server.listen(env.PORT, env.HOST, () => {
  console.log(`http://${env.HOST}:${env.PORT}`);
});
