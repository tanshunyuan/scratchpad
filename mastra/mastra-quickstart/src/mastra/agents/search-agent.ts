import { Agent } from "@mastra/core/agent";
import { webSearch } from "../tools/search-tool";

export const searchAgent = new Agent({
  id: "search-agent",
  name: "Search Agent",
  instructions:
    "You are a search agent that can search the web for information.",
  model: "openai/gpt-4.1-mini",
  tools: {
    webSearch
  }
});
