// https://genkit.dev/docs/integrations/cloud-firestore/

import { googleAI } from "@genkit-ai/google-genai";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { defineFirestoreRetriever } from "@genkit-ai/firebase";
import { readFile } from "fs/promises";
import { z, genkit } from "genkit";
import { chunk } from "llm-chunk";
import path from "path";
import pdf from "pdf-parse";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);

const app = initializeApp({
  projectId: "agent-playground-49269",
});
const firestore = getFirestore(app);
firestore.settings({
  credentials: serviceAccount,
});

const extractTextFromPdf = async (filePath: string) => {
  const pdfFile = path.resolve(filePath);
  const dataBuffer = await readFile(pdfFile);
  const data = await pdf(dataBuffer);
  return data.text;
};

const indexConfig = {
  collection: "menuInfo",
  contentField: "text",
  vectorField: "embedding",
  embedder: googleAI.embedder("gemini-embedding-001", {
    outputDimensionality: 1536
  }),
};

const ai = genkit({
  plugins: [googleAI()],
});

/**
 * @example
 * run `genkit flow:run indexMenu '{"filePath": "./assets/dinner-menu.pdf"}'` to seed the vectorstore
 * but genkit must start first with: `genkit start -- npx tsx -r dotenv/config --watch genkit/local-vector-store.ts`
 */
export const indexMenu = ai.defineFlow(
  {
    name: "firestoreIndexMenu",
    inputSchema: z.object({ filePath: z.string().describe("PDF file path") }),
    outputSchema: z.object({
      success: z.boolean(),
      // documentsIndexed: z.number(),
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
        chunk(pdfTxt, {
          minLength: 1000,
          maxLength: 2000,
          splitter: "sentence",
          overlap: 100,
          delimiters: "",
        }),
      );

      for (const text of chunks) {
        const embedding = (
          await ai.embed({
            embedder: indexConfig.embedder,
            content: text,
            options: {
              outputDimensionality: 1536,
            },
          })
        )[0].embedding;

        await firestore.collection(indexConfig.collection).add({
          [indexConfig.vectorField]: FieldValue.vector(embedding),
          [indexConfig.contentField]: text,
        });
      }

      return {
        success: true,
        // documentsIndexed: documents.length,
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

const menuRetriever = defineFirestoreRetriever(ai, {
  name: "firestoreMenuRetriever",
  firestore,
  collection: indexConfig.collection,
  contentField: indexConfig.contentField,
  vectorField: indexConfig.vectorField,
  embedder: indexConfig.embedder,
  distanceMeasure: "COSINE",
});

export const menuQAFlow = ai.defineFlow(
  {
    name: "firestoreMenuQA",
    inputSchema: z.object({ query: z.string() }),
    outputSchema: z.object({ answer: z.string() }),
  },
  async ({ query }) => {
    // retrieve relevant documents
    /**
     * @note need to run `gcloud firestore indexes composite create --project=agent-playground-49269 --collection-group=menuInfo --query-scope=COLLECTION --field-config=vector-config='{"dimension":"1536","flat": "{}"}',field-path=embedding`
     * on google cloud console terminal to create the required index
     */
    const docs = await ai.retrieve({
      retriever: menuRetriever,
      query,
    });

    // generate a response
    const { text } = await ai.generate({
      model: googleAI.model("gemini-2.5-flash"),
      prompt: `
You are acting as a helpful AI assistant that can answer
questions about the food available on the menu.

Use only the context provided to answer the question.
If you don't know, do not make up an answer.
Do not add or change items on the menu.

Question: ${query}`,
      docs,
    });

    return { answer: text };
  },
);
