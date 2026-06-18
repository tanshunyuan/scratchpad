import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { createSession } from "better-sse";
import type { FlueEvent } from "@flue/sdk";
import { env } from "../env.js";
import { DEMO_DESIGN_SYSTEM_TEXT, DEMO_PROJECT_ID } from "./design-system/demo.js";
import {
  createFlueDesignSystemClient,
  FluePenpotSimpleResultSchema,
  type FluePenpotSimpleResult,
} from "./design-system/flue.js";
import {
  logDesignSystem,
  startDesignSystemGenerationLog,
} from "./design-system/log.js";
import {
  GenerateDesignSystemInputSchema,
  type GenerateDesignSystemResult,
} from "./design-system/types.js";
import {
  listDesignSystemGenerations,
  saveDesignSystemGeneration,
} from "./design-system/store.js";
import { runDesignSystemWorkflow } from "./design-system/workflow.js";

const app = express();

app.use(cors());

// Middleware
app.use(express.json());

// Routes
app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Hello, World!" });
});

app.get("/api/design-system/generations", async (_req: Request, res: Response) => {
  try {
    const generations = await listDesignSystemGenerations();
    res.json({ generations });
  } catch (error) {
    console.error("HTTP GET /api/design-system/generations failed", error);
    res.status(500).json({ error: "Failed to list design systems" });
  }
});

app.get(
  "/api/design-system/generate/stream",
  async (req: Request, res: Response) => {
    const session = await createSession(req, res, {
      keepAlive: 10_000,
    });
    const abortController = new AbortController();
    const generationId = randomUUID();
    const logs: string[] = [];

    req.on("close", () => {
      abortController.abort();
    });

    function push(eventName: string, data: unknown) {
      if (!session.isConnected) {
        return;
      }

      session.push(data, eventName);
    }

    function progress(message: string, data?: Record<string, unknown>) {
      logs.push(message);
      logDesignSystem(message, data);
      push("progress", { message, ...data });
    }

    const projectId = getProjectId(req);

    if (projectId !== DEMO_PROJECT_ID) {
      push("failed", { error: `Unknown projectId: ${projectId}` });
      res.end();
      return;
    }

    const logFilePath = startDesignSystemGenerationLog();

    try {
      progress("loading PRD + UL", { generationId, logFilePath });
      progress("using existing design-system text", {
        chars: DEMO_DESIGN_SYSTEM_TEXT.length,
      });
      progress("starting Flue run");

      const client = createFlueDesignSystemClient();
      const run = await client.workflows.invoke("penpot-simple", {
        payload: {
          designSystemText: DEMO_DESIGN_SYSTEM_TEXT,
        },
        signal: abortController.signal,
      });

      progress("Flue run started", { runId: run.runId });

      for await (const event of client.runs.stream(run.runId, {
        offset: run.offset,
        signal: abortController.signal,
      })) {
        const message = getFlueProgressMessage(event);

        if (message) {
          progress(message, { flueEventType: event.type });
        }

        if (event.type !== "run_end") {
          continue;
        }

        if (event.isError) {
          push("failed", { error: event.error ?? "Flue run failed" });
          break;
        }

        const flueResult = FluePenpotSimpleResultSchema.parse(event.result);
        const result = mapFlueResultToDesignSystemResult(flueResult);
        const generation = await saveDesignSystemGeneration({
          id: generationId,
          request: { projectId },
          result,
          logs,
        });

        push("result", { generation });
        break;
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        push("failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  },
);

app.post("/api/design-system/generate", async (req: Request, res: Response) => {
  const generationId = randomUUID();
  const logFilePath = startDesignSystemGenerationLog();

  logDesignSystem("HTTP POST /api/design-system/generate received", {
    generationId,
    logFilePath,
  });

  const parsedInput = GenerateDesignSystemInputSchema.safeParse(req.body);

  if (!parsedInput.success) {
    logDesignSystem("HTTP POST /api/design-system/generate invalid input", {
      generationId,
      logFilePath,
      error: parsedInput.error.message,
    });
    res.status(400).json({ error: parsedInput.error.message });
    return;
  }

  try {
    logDesignSystem("HTTP POST /api/design-system/generate started", {
      generationId,
      logFilePath,
    });

    const result = await runDesignSystemWorkflow(parsedInput.data);
    const generation = await saveDesignSystemGeneration({
      id: generationId,
      request: parsedInput.data,
      result,
    });

    logDesignSystem("HTTP POST /api/design-system/generate success", {
      generationId,
      logFilePath,
    });
    res.json(generation);
  } catch (error) {
    logDesignSystem("HTTP POST /api/design-system/generate failed", {
      generationId,
      logFilePath,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(error);
    res.status(500).json({ error: "Failed to generate design system" });
  }
});

function getProjectId(req: Request) {
  const projectId = req.query.projectId;

  if (typeof projectId === "string" && projectId.length > 0) {
    return projectId;
  }

  return DEMO_PROJECT_ID;
}

function getFlueProgressMessage(event: FlueEvent) {
  switch (event.type) {
    case "run_start":
      return "Flue workflow started";
    case "log":
      return event.message;
    case "operation_start":
      return `${event.operationKind} started`;
    case "operation":
      return `${event.operationKind} finished`;
    case "tool_start":
      return `tool started: ${event.toolName}`;
    case "tool":
      return event.isError
        ? `tool failed: ${event.toolName}`
        : `tool finished: ${event.toolName}`;
    case "run_end":
      return event.isError ? "Flue run failed" : "Flue run completed";
    default:
      return undefined;
  }
}

function mapFlueResultToDesignSystemResult(
  flueResult: FluePenpotSimpleResult,
): GenerateDesignSystemResult {
  return {
    designSystemText: DEMO_DESIGN_SYSTEM_TEXT,
    penpot: {
      fileId: "unknown",
      boardId: flueResult.artboard_id,
      boardName: flueResult.artboard_name,
    },
    preview: {
      imageBase64: flueResult.image.base64,
      imageUrl: flueResult.image.imageUrl,
      mimeType: flueResult.image.mimeType,
    },
  };
}

// Start server
app.listen(env.PORT, () => {
  console.log(`Server is running on http://localhost:${env.PORT}`);
});
