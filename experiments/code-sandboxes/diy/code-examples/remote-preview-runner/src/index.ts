import express, { type Request, type Response } from "express";
import cors from "cors";
import { env } from "../env.js";
import { nanoid } from "nanoid";
import { spawn } from "node:child_process";
import path from "node:path";

const app = express();

app.use(cors());

// Middleware
app.use(express.json());

// Routes
app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Hello, World!" });
});

// POST /sandboxes/start
// → starts container
// → returns { sandboxId, previewUrl }

// POST /sandboxes/:id/stop
// → stops container

// GET /sandboxes/:id/logs
// → streams logs/status with SSE

type Sandbox = {
  process: ReturnType<typeof spawn>;
  previewUrl: string;
  status: "starting" | "running" | "stopping" | "stopped" | "error";
  logs: Array<{ type: string; text: string }>;
};

const sandboxes = new Map<string, Sandbox>();

app.post("/sandboxes/start", async (req: Request, res: Response) => {
  try {
    const sandboxId = nanoid();
    const projectDir = path.join(process.cwd(), "../sample-preview-app");
    const dockerImage = "node:24";
    const nodeModulesVolume = "sample-preview-node-modules";
    const previewPort = 5174;
    const previewUrl = `http://localhost:${previewPort}`;

    const serverProcess = spawn("docker", [
      "run",
      "--rm",
      "-v",
      `${projectDir}:/app`,
      "-v",
      `${nodeModulesVolume}:/app/node_modules`,
      "-w",
      "/app",
      "-p",
      `${previewPort}:${previewPort}`,
      dockerImage,
      "sh",
      "-lc",
      `corepack enable && pnpm install && pnpm dev --host 0.0.0.0 --port ${previewPort}`,
    ]);

    const sandbox: Sandbox = {
      process: serverProcess,
      previewUrl,
      status: "starting",
      logs: [],
    };

    serverProcess.stdout.on("data", (data) => {
      sandbox.logs.push({ type: "stdout", text: data.toString() });
    });

    serverProcess.stderr.on("data", (data) => {
      sandbox.logs.push({ type: "stderr", text: data.toString() });
    });

    serverProcess.on("exit", () => {
      sandbox.status = "stopped";
    });

    sandboxes.set(sandboxId, sandbox);

    try {
      await waitForUrl(previewUrl, 60000);
      sandbox.status = "running";
      return res.status(201).json({
        previewUrl,
        sandboxId,
      });
    } catch (error) {
      sandbox.status = "error";
      sandbox.logs.push({
        type: "error",
        text: error instanceof Error ? error.message : String(error),
      });
      console.error(error);
      return res
        .status(500)
        .json({ error: "Preview failed to start", sandboxId });
    }
  } catch (err) {
    return res.status(500).json(err);
  }
});

app.post("/sandboxes/:id/stop", async (req: Request, res: Response) => {
  const sandbox = sandboxes.get(req.params.id as string);

  if (!sandbox) {
    return res.status(404).json({ error: "Sandbox not found" });
  }

  sandbox.status = "stopping";
  await new Promise<void>((resolve) => {
    sandbox.process.once("exit", () => resolve());

    const signalSent = sandbox.process.kill("SIGTERM");
    if (!signalSent) resolve();
  });

  sandbox.status = "stopped";

  return res.json({ ok: true });
});

const sendSseEvent = (res: Response, event: string, data: unknown) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

app.get("/sandboxes/:id/logs", async (req: Request, res: Response) => {
  const sandbox = sandboxes.get(req.params.id as string);
  if (!sandbox) {
    return res.status(404).json({ error: "Sandbox not found" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let lastLogIdx = 0;
  let lastStatus = sandbox.status;

  sendSseEvent(res, "status", { status: sandbox.status });

  const sendUpdates = () => {
    if (sandbox.status !== lastStatus) {
      lastStatus = sandbox.status;
      sendSseEvent(res, "status", { status: sandbox.status });
    }

    const newLogs = sandbox.logs.slice(lastLogIdx);
    lastLogIdx = sandbox.logs.length;

    for (const log of newLogs) {
      sendSseEvent(res, "log", log);
    }
  };

  sendUpdates();

  const interval = setInterval(sendUpdates, 500);

  req.on("close", () => {
    clearInterval(interval);
  });

});

// Start server
app.listen(env.PORT, () => {
  console.log(`Server is running on http://localhost:${env.PORT}`);
});

const waitForUrl = async (url: string, timeoutMs = 15000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (err) {
      // Server not ready yet.
      // console.log(err)
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}`);
};
