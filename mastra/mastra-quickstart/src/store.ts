/**
 * @note this is to mimic injestion to the vector db
 */

import { MDocument } from "@mastra/rag";
import { embedMany } from "ai";
import { mastra } from "./mastra";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";

// Load the paper
const paperUrl = "https://arxiv.org/html/1706.03762";
const response = await fetch(paperUrl);
const paperText = await response.text();

// Create document and chunk it
const doc = MDocument.fromText(paperText);
const chunks = await doc.chunk({
  strategy: "recursive",
  maxSize: 512,
  overlap: 50,
  separators: ["\n\n", "\n", " "],
});

console.log("Number of chunks:", chunks.length);

// Generate embeddings
const { embeddings } = await embedMany({
  model: new ModelRouterEmbeddingModel("openai/text-embedding-3-small"),
  values: chunks.map((chunk) => chunk.text),
});


// Get the vector store instance from Mastra
const vectorStore = mastra.getVector("libSqlVector");

// Create an index for paper chunks
await vectorStore.createIndex({
  indexName: "papers",
  dimension: 1536,
});

// Store embeddings
await vectorStore.upsert({
  indexName: "papers",
  vectors: embeddings,
  metadata: chunks.map((chunk) => ({
    text: chunk.text,
    source: "transformer-paper",
  })),
});
