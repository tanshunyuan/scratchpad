import { CallbackHandler } from "langfuse-langchain";
import { env } from "../../../env.js";
 
// Initialize Langfuse callback handler
export const langfuseHandler = new CallbackHandler({
  publicKey: env.LANGFUSE_PUBLIC_KEY,
  secretKey: env.LANGFUSE_SECRET_KEY,
  baseUrl: "https://us.cloud.langfuse.com"
});
 