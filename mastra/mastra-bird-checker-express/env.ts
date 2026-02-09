import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import 'dotenv/config'

export const env = createEnv({
  server: {
    OPENAI_API_KEY: z.string().min(1),
    UNSPLASH_ACCESS_KEY: z.string().min(1),
    UNSPLASH_SECRET_KEY: z.string().min(1),
    UNSPLASH_APPLICATION_ID: z.string().min(1),
  },
  runtimeEnv: process.env,
});
