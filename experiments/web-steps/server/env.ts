import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import dotenv from 'dotenv'

dotenv.config()

export const env = createEnv({
  server: {
    CLIENT_URL: z.url().default('http://localhost:5173'),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().min(1).default('localhost'),
  },
  runtimeEnv: process.env,
});
