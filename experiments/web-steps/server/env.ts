import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

export const env = createEnv({
  server: {
    CLIENT_URL: z.url().default("http://localhost:5173"),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().min(1).default("localhost"),
    OPENAI_API_KEY: z.string().min(1),
    // OPENAI_MODEL: z.string().default("gpt-5.4-mini"),
    OPENAI_MODEL: z.string().default("gpt-5.4"),
    PENPOT_MCP_URL: z.url(),
  },
  runtimeEnv: process.env,
});
