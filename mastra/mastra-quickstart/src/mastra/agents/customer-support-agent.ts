import { Agent } from "@mastra/core";

export const customerSupportAgent = new Agent({
  id: "customer-support-agent",
  name: "Customer Support Agent",
  instructions: `You are a customer support agent for Acme Corp`,
  model: "openai/gpt-4.1-mini",
});
