import express, { type Request, type Response } from "express";
import cors from "cors";
import { env } from "../env.js";
import { pipeUIMessageStreamToResponse, createUIMessageStream } from "ai";

const app = express();

app.use(cors());

// Middleware
app.use(express.json());

// Routes
app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Hello, World!" });
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
