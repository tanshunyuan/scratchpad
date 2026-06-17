import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { env } from "../env.js";
import { pipeUIMessageStreamToResponse, createUIMessageStream } from "ai";
import {
  logDesignSystem,
  withDesignSystemGenerationLog,
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
    logDesignSystem("HTTP GET /api/design-system/generations failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Failed to list design systems" });
  }
});

app.post("/api/design-system/generate", async (req: Request, res: Response) => {
  logDesignSystem("HTTP POST /api/design-system/generate received");
  const parsedInput = GenerateDesignSystemInputSchema.safeParse(req.body);

  if (!parsedInput.success) {
    res.status(400).json({ error: parsedInput.error.message });
    return;
  }

  const generationId = randomUUID();

  try {
    const generation = await withDesignSystemGenerationLog({
      generationId,
      callback: async () => {
        try {
          logDesignSystem("HTTP POST /api/design-system/generate started", {
            generationId,
          });

          const result = await runDesignSystemWorkflow(parsedInput.data);
          const savedGeneration = await saveDesignSystemGeneration({
            id: generationId,
            request: parsedInput.data,
            result,
          });

          logDesignSystem("HTTP POST /api/design-system/generate success", {
            generationId: savedGeneration.id,
          });

          return savedGeneration;
        } catch (error) {
          logDesignSystem("HTTP POST /api/design-system/generate failed", {
            generationId,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      },
    });

    res.json(generation);
  } catch (error) {
    logDesignSystem("HTTP POST /api/design-system/generate failed", {
      generationId,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(error);
    res.status(500).json({ error: "Failed to generate design system" });
  }
});

app.post("/api/ui-stream", async (_req, res) => {
  pipeUIMessageStreamToResponse({
    response: res,
    stream: createUIMessageStream({
      async execute({ writer }) {
        writer.write({ type: "start" });

        writer.write({ type: "text-start", id: "t1" });
        for (const delta of ["Hello", " ", "from", " ", "UI", " ", "stream!"]) {
          writer.write({ type: "text-delta", id: "t1", delta });
          await new Promise((r) => setTimeout(r, 150));
        }
        writer.write({ type: "text-end", id: "t1" });

        writer.write({ type: "finish" });
      },
    }),
  });
});

// Start server
app.listen(env.PORT, () => {
  console.log(`Server is running on http://localhost:${env.PORT}`);
});
