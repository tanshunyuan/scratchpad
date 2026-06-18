import express from "express";
import { randomUUID } from "crypto";
import { createServer } from "http";
import os from "os";
import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
  type AgentSession,
  type AgentSessionEvent,
} from "@mariozechner/pi-coding-agent";
import type { Model, Api } from "@mariozechner/pi-ai";
import type {
  CreateJobRequest,
  CreateJobResponse,
  JobEvent,
  JobInfo,
  JobStatus,
  ModelInfo,
  SerializedAgentState,
} from "../shared/protocol.js";

const PORT = parseInt(process.env.PORT || "3001");
const HOME_DIR = os.homedir();

const app = express();
const server = createServer(app);

app.use(express.json({ limit: "1mb" }));

let authStorage: AuthStorage;
let modelRegistry: ModelRegistry;

interface Job {
  id: string;
  status: JobStatus;
  prompt: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  result?: unknown;
  error?: string;
  events: JobEvent[];
  subscribers: Set<(event: JobEvent) => void>;
  session?: AgentSession;
}

const jobs = new Map<string, Job>();

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

function modelToInfo(model: Model<Api>): ModelInfo {
  return {
    provider: model.provider,
    id: model.id,
    name: model.name || model.id,
  };
}

function serializeState(session: AgentSession): SerializedAgentState {
  const state = session.agent.state;
  return {
    messages: state.messages,
    model: state.model ? modelToInfo(state.model) : undefined,
    thinkingLevel: session.thinkingLevel,
    systemPrompt: state.systemPrompt,
    isStreaming: state.isStreaming,
    streamingMessage: state.streamingMessage,
    errorMessage: state.errorMessage,
    tools: session.getActiveToolNames(),
    sessionId: session.sessionId,
    sessionName: session.sessionName,
  };
}

function getRegistryModels(): ModelInfo[] {
  return modelRegistry.getAll().map(modelToInfo);
}

function findModel(provider: string, modelId: string): Model<Api> | undefined {
  return modelRegistry.find(provider, modelId);
}

function safeSerializeEvent(event: AgentSessionEvent): any {
  try {
    const json = JSON.stringify(event);
    return JSON.parse(json);
  } catch {
    return { type: (event as any).type, _serialized: false };
  }
}

function emitJobEvent(job: Job, event: JobEvent["event"], data: unknown) {
  const jobEvent: JobEvent = {
    id: job.events.length + 1,
    event,
    data,
    createdAt: new Date().toISOString(),
  };

  job.events.push(jobEvent);
  job.updatedAt = jobEvent.createdAt;

  for (const subscriber of job.subscribers) {
    subscriber(jobEvent);
  }
}

function sendSseEvent(res: express.Response, event: JobEvent) {
  res.write(`id: ${event.id}\n`);
  res.write(`event: ${event.event}\n`);
  res.write(`data: ${JSON.stringify(event.data)}\n\n`);
}

function jobToInfo(job: Job): JobInfo {
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    prompt: job.prompt,
    metadata: job.metadata,
    result: job.result,
    error: job.error,
    eventCount: job.events.length,
  };
}

function createJob(req: CreateJobRequest): Job {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    status: "queued",
    prompt: req.prompt,
    metadata: req.metadata,
    createdAt: now,
    updatedAt: now,
    events: [],
    subscribers: new Set(),
  };
}

function validateCreateJobRequest(body: unknown): CreateJobRequest | undefined {
  if (!body || typeof body !== "object") return undefined;

  const request = body as Partial<CreateJobRequest>;
  if (typeof request.prompt !== "string" || !request.prompt.trim()) return undefined;

  return {
    ...request,
    prompt: request.prompt.trim(),
  };
}

async function runJob(job: Job, req: CreateJobRequest) {
  job.status = "running";
  emitJobEvent(job, "status", { jobId: job.id, status: job.status });

  const { session, modelFallbackMessage } = await createAgentSession({
    cwd: HOME_DIR,
    authStorage,
    modelRegistry,
    sessionManager: SessionManager.create(HOME_DIR),
  });

  job.session = session;

  if (modelFallbackMessage) {
    emitJobEvent(job, "status", { jobId: job.id, status: job.status, message: modelFallbackMessage });
  }

  if (req.model) {
    const model = findModel(req.model.provider, req.model.id);
    if (!model) {
      throw new Error(`Model not found: ${req.model.provider}/${req.model.id}`);
    }
    await session.setModel(model);
  }

  if (req.thinkingLevel) {
    session.setThinkingLevel(req.thinkingLevel as any);
  }

  const unsubscribe = session.subscribe((event: AgentSessionEvent) => {
    const safeEvent = safeSerializeEvent(event);
    emitJobEvent(job, "agentEvent", safeEvent);

    if (
      event.type === "agent_start" ||
      event.type === "agent_end" ||
      event.type === "message_end" ||
      event.type === "turn_end"
    ) {
      emitJobEvent(job, "stateSync", serializeState(session));
    }
  });

  try {
    await session.prompt(job.prompt);

    if ((job.status as JobStatus) === "aborted") return;

    job.status = "done";
    job.result = serializeState(session);
    emitJobEvent(job, "done", { jobId: job.id, status: job.status, result: job.result });
  } finally {
    unsubscribe();
  }
}

function failJob(job: Job, err: unknown) {
  if (job.status === "aborted") return;

  const message = err instanceof Error ? err.message : String(err);
  job.status = "error";
  job.error = message;
  emitJobEvent(job, "error", { jobId: job.id, status: job.status, error: message });
}

app.get("/api/models", (_req, res) => {
  res.json({ models: getRegistryModels() });
});

app.post("/api/jobs", (httpReq, res) => {
  const createReq = validateCreateJobRequest(httpReq.body);
  if (!createReq) {
    res.status(400).json({ error: "Expected JSON body with non-empty prompt" });
    return;
  }

  const job = createJob(createReq);
  jobs.set(job.id, job);

  emitJobEvent(job, "status", { jobId: job.id, status: job.status });

  const response: CreateJobResponse = {
    jobId: job.id,
    status: job.status,
  };
  res.status(202).json(response);

  runJob(job, createReq).catch((err: unknown) => {
    console.error(`Job ${job.id} failed:`, err);
    failJob(job, err);
  });
});

app.get("/api/jobs/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json(jobToInfo(job));
});

app.get("/api/jobs/:jobId/events", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  res.write(`retry: 1000\n\n`);

  for (const event of job.events) {
    sendSseEvent(res, event);
  }

  const subscriber = (event: JobEvent) => {
    sendSseEvent(res, event);
  };
  job.subscribers.add(subscriber);

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    job.subscribers.delete(subscriber);
  });
});

app.post("/api/jobs/:jobId/abort", async (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (job.status === "done" || job.status === "error" || job.status === "aborted") {
    res.json(jobToInfo(job));
    return;
  }

  job.status = "aborted";
  if (job.session?.isStreaming) {
    await job.session.abort();
  }

  emitJobEvent(job, "aborted", { jobId: job.id, status: job.status });
  res.json(jobToInfo(job));
});

async function main() {
  console.log("Initializing Pi agent worker...");

  authStorage = AuthStorage.create();
  modelRegistry = ModelRegistry.create(authStorage);

  console.log(`Models: ${getRegistryModels().map((m) => `${m.provider}/${m.id}`).join(", ")}`);

  server.listen(PORT, () => {
    console.log(`Pi job worker listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
