import { createOpenAI } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { MCPClient } from "@mastra/mcp";
import { env } from "../env.js";

const testMcpClient = new MCPClient({
  id: "test-mcp-client",
  servers: {
    // wikipedia: {
    //   command: "npx",
    //   args: ["-y", "wikipedia-mcp"],
    // },
    penpot: {
      url: new URL(env.PENPOT_MCP_URL),
    },
  },
});

const llm = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
});

const tools = await testMcpClient.listTools();
console.log("tools ==> ", tools);
const testAgent = new Agent({
  id: "test-agent",
  name: "Test Agent",
  description: "You are a helpful AI assistant",
  instructions: `
       You are a helpful assistant that has access to the following MCP Servers.
       - penpot MCP Server

       Answer questions using the information you find using the MCP Servers.`,
  model: llm("gpt-5.4-mini"),
  tools: tools,
});

// const result = await testAgent.generate("Tell me about quantum computing using the Wikipedia information");
const result = await testAgent.generate("tell me about the tools you have with penpot and what can you do with them");
console.log("le result ==> ", result.text);
