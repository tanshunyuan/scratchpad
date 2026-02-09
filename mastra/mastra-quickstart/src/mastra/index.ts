import { Mastra } from "@mastra/core/mastra";
import path from "path";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore, LibSQLVector } from "@mastra/libsql";
import {
  Observability,
  DefaultExporter,
  CloudExporter,
  SensitiveDataFilter,
} from "@mastra/observability";
import { weatherWorkflow } from "./workflows/weather-workflow";
import { weatherAgent } from "./agents/weather-agent";
import {
  toolCallAppropriatenessScorer,
  completenessScorer,
  translationScorer,
} from "./scorers/weather-scorer";
import { chefAgent } from "./agents/chef-agent";
import { stockAgent } from "./agents/stock-agent";
import { candidateWorkflow } from "./workflows/candidate-workflow";
import { notes } from "./mcp/server";
import { searchAgent } from "./agents/search-agent";
import { researchAgent } from "./agents/research-agent";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { email } from "zod/mini";
import { emailHitlWorkflow } from "./workflows/email-hitl-workflow";
import { singleTurnHitlWorkflow } from "./workflows/single-turn-hitl-workflow";
import { customerSupportAgent } from "./agents/customer-support-agent";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function removeMastraPublicDuplicate(filePath: string): string {
  // Specifically look for /src/mastra/public appearing twice consecutively and remove the duplicate
  return filePath.replace(
    /\/src\/mastra\/public\/src\/mastra\/public/g,
    "/src/mastra/public",
  );
}
const DB_PATH = removeMastraPublicDuplicate(
  path.join(process.cwd(), "src", "mastra", "public"),
);

const STORAGE_PATH = `file:${path.join(DB_PATH, "mastra.db")}`;
const VECTOR_PATH = `file:${path.join(DB_PATH, "vector.db")}`;

console.log(`VECTOR_PATH: ${VECTOR_PATH}\nSTORAGE_PATH: ${STORAGE_PATH}`);

export const mastra = new Mastra({
  workflows: { weatherWorkflow, candidateWorkflow, emailHitlWorkflow, singleTurnHitlWorkflow },
  agents: { weatherAgent, chefAgent, stockAgent, searchAgent, researchAgent, customerSupportAgent },
  scorers: {
    toolCallAppropriatenessScorer,
    completenessScorer,
    translationScorer,
  },
  storage: new LibSQLStore({
    id: "mastra-storage",
    // stores observability, scores, ... into persistent file storage
    url: STORAGE_PATH,
  }),
  vectors: {
    /**@note name is the same as the defined in research-agent.vectorQueryTool */
    libSqlVector: new LibSQLVector({
      id: "research-vectors",
      url: VECTOR_PATH,
    }),
  },
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
  mcpServers: {
    notes,
  },
  observability: new Observability({
    configs: {
      default: {
        serviceName: "mastra",
        exporters: [
          new DefaultExporter(), // Persists traces to storage for Mastra Studio
          new CloudExporter(), // Sends traces to Mastra Cloud (if MASTRA_CLOUD_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
});
