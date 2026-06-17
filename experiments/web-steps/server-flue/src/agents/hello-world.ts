import {
  AgentRouteHandler,
  connectMcpServer,
  createAgent,
  FlueContext,
} from "@flue/runtime";

export const route: AgentRouteHandler = async (_c, next) => next();

export const description = "Tells a short joke in response to each message.";

export default createAgent(() => ({
  model: "openai/gpt-5.4-mini",
  thinkingLevel: "medium",
  instructions: "Tell a short joke in response to each message.",
}));
