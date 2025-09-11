import {
  devLocalIndexerRef,
  devLocalRetrieverRef,
  devLocalVectorstore,
} from "@genkit-ai/dev-local-vectorstore";
import { googleAI } from "@genkit-ai/google-genai";
import { z, genkit } from "genkit";
import { Document } from "genkit/retriever";
import { chunk } from "llm-chunk";
import { readFile } from "fs/promises";
import path from "path";
import pdf from "pdf-parse";

const ai = genkit({
  plugins: [
    googleAI(),
    devLocalVectorstore([
      {
        indexName: "menuQA",
        embedder: googleAI.embedder("gemini-embedding-001"),
      },
    ]),
  ],
});

export const menuPdfIndexer = devLocalIndexerRef("menuQA");

const chunkingConfig = {
  minLength: 1000,
  maxLength: 2000,
  splitter: "sentence",
  overlap: 100,
  delimiters: "",
} as any;

const extractTextFromPdf = async (filePath: string) => {
  const pdfFile = path.resolve(filePath);
  const dataBuffer = await readFile(pdfFile);
  const data = await pdf(dataBuffer);
  return data.text;
};

/**
 * @example
 * run `genkit flow:run indexMenu '{"filePath": "./assets/dinner-menu.pdf"}'` to seed the vectorstore
 * but genkit must start first with: `genkit start -- npx tsx -r dotenv/config --watch genkit/local-vector-store.ts`
 */
export const indexMenu = ai.defineFlow(
  {
    name: "indexMenu",
    inputSchema: z.object({ filePath: z.string().describe("PDF file path") }),
    outputSchema: z.object({
      success: z.boolean(),
      documentsIndexed: z.number(),
      error: z.string().optional(),
    }),
  },
  async ({ filePath }) => {
    try {
      filePath = path.resolve(filePath);

      // Read the pdf
      const pdfTxt = await ai.run("extract-text", () =>
        extractTextFromPdf(filePath),
      );

      // Divide the pdf text into segments
      const chunks = await ai.run("chunk-it", async () =>
        chunk(pdfTxt, chunkingConfig),
      );

      // Convert chunks of text into documents to store in the index.
      const documents = chunks.map((text) => {
        return Document.fromText(text, { filePath });
      });

      // Add documents to the index
      await ai.index({
        indexer: menuPdfIndexer,
        documents,
      });

      return {
        success: true,
        documentsIndexed: documents.length,
      };
    } catch (err) {
      // For unexpected errors that throw exceptions
      return {
        success: false,
        documentsIndexed: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
);

const menuRetriever = devLocalRetrieverRef("menuQA");

export const menuQAFlow = ai.defineFlow(
  {
    name: "menuQA",
    inputSchema: z.object({ query: z.string() }),
    outputSchema: z.object({ answer: z.string() }),
  },
  async ({ query }) => {
    // retrieve relevant documents
    const docs = await ai.retrieve({
      retriever: menuRetriever,
      query,
      options: { k: 3 },
    });

    // generate a response
    const { text } = await ai.generate({
      model: googleAI.model("gemini-2.5-flash"),
      prompt: `
You are acting as a helpful AI assistant that can answer
questions about the food available on the menu at Genkit Grub Pub.

Use only the context provided to answer the question.
If you don't know, do not make up an answer.
Do not add or change items on the menu.

Question: ${query}`,
      docs,
    });

    return { answer: text };
  },
);
