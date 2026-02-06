import { Agent } from "@mastra/core";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { Memory } from "@mastra/memory";
import { createVectorQueryTool } from "@mastra/rag";

const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: "libSqlVector",
  indexName: "papers",
  model: new ModelRouterEmbeddingModel("openai/text-embedding-3-small"),
});

export const researchAgent = new Agent({
  id: "research-agent",
  name: "Research Assistant",
  instructions: `
  You are a helpful research assistant that analyzes academic papers and technical documents.
      Use the provided vector query tool to find relevant information from your knowledge base,
      and provide accurate, well-supported answers based on the retrieved content.
      Focus on the specific content available in the tool and acknowledge if you cannot find sufficient information to answer a question.
      Base your responses only on the content provided, not on general knowledge.
  `,
  model: "openai/gpt-4.1-mini",
  tools: {
    vectorQueryTool,
  },
  memory: new Memory()
});
