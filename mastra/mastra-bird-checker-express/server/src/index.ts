/**
 * @link https://mastra.ai/guides/getting-started/express
 */
import express, { type Request, type Response } from "express";
import { MastraServer } from "@mastra/express";
import { mastra } from "./mastra";
import { type ImageQuery, getRandomImage } from "./helper/mastra/system-tools";
import { z } from "zod";
import { getImage, promptOpenai } from "./helper/mastra/actions";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

/**
 * @note injects a MastraServer instance
 * @link https://mastra.ai/guides/getting-started/express
 * @link https://mastra.ai/docs/server/server-adapters
 * @link https://mastra.ai/reference/server/express-adapter
 * @link https://mastra.ai/reference/server/mastra-server
 */
const server = new MastraServer({
  app,
  mastra,
  openapiPath: "/openapi.json",
});
await server.init();

// Debug: check if routes are registered
console.log(
  "Express app routes:",
  (app as any)._router?.stack?.length || 0,
  "middlewares loaded",
);

// Routes
app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Hello, World!" });
});

app.get("/api/get-unsplash-image", async (req: Request, res: Response) => {
  try {
    const imageQuery = (req?.query?.query || "wildlife") as ImageQuery;

    const image = await getImage({ query: imageQuery });

    if (!image.ok) {
      res.status(400).send({ msg: image.error });
      return;
    }

    res.send(image.data);
  } catch (err) {
    console.log("get unsplash image err===", err);
    res.status(400).send({ msg: "Could not fetch image" });
  }
});

app.post("/api/image-metadata", async (req: Request, res: Response) => {
  try {
    const imageUrl = req.body?.imageUrl;

    if (!imageUrl) {
      res.status(400).send({ msg: "Image url is required" });
      return;
    }

    const response = await promptOpenai({ imageUrl });

    if (!response.ok) {
      res.status(400).send({ msg: response.error });
      return;
    }

    res.send(response.data);
  } catch (err) {
    console.log("get image metadata err===", err);
    res.status(400).send({ msg: "Could not fetch image metadata" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// curl -X POST http://localhost:3000/api/agents/weather-agent/generate -H "Content-Type: application/json" -d "{\"messages\":[{\"role\":\"user\",\"content\":\"What is the weather like in Seoul?\"}]}"
// to visit the openapi: use /api/openapi
