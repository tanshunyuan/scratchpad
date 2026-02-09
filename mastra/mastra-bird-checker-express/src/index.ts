/**
 * @link https://mastra.ai/guides/getting-started/express
 */
import express, { type Request, type Response } from "express";
import { MastraServer } from "@mastra/express";
import { mastra } from "./mastra";
import 'dotenv/config'

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
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
  openapiPath: '/openapi.json'
});
await server.init();

// Routes
app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Hello, World!" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// curl -X POST http://localhost:3000/api/agents/weather-agent/generate -H "Content-Type: application/json" -d "{\"messages\":[{\"role\":\"user\",\"content\":\"What is the weather like in Seoul?\"}]}"
