import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { env } from "../env.js";
import { pipeUIMessageStreamToResponse, createUIMessageStream } from "ai";
import {
  logDesignSystem,
  startDesignSystemGenerationLog,
} from "./design-system/log.js";
import { GenerateDesignSystemInputSchema } from "./design-system/types.js";
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

// Start server
app.listen(env.PORT, () => {
  console.log(`Server is running on http://localhost:${env.PORT}`);
});
