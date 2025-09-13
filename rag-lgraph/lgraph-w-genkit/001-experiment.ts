import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import path from "path";
import { OpenAIEmbeddings } from "@langchain/openai";
import { z, genkit } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import { defineFirestoreRetriever } from "@genkit-ai/firebase";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);

const app = initializeApp({
  projectId: "agent-playground-49269",
});
const firestore = getFirestore(app);
firestore.settings({
  credentials: serviceAccount,
});

const ai = genkit({
  plugins: [googleAI()],
});

const embedder = googleAI.embedder("gemini-embedding-001", {
  outputDimensionality: 1536,
});

const seedFirestoreEmbeddings = async () => {
  const filePath = path.resolve("./assets/dinner-menu.pdf");
  const loader = new PDFLoader(filePath, {
    parsedItemSeparator: "",
  });
  const docs = await loader.load();

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const allSplits = await splitter.splitDocuments(docs);

  const batch = firestore.batch()
  const collectionRef = firestore.collection('lgraph-firestore')

  for (const split of allSplits) {
    const embedding = (
      await ai.embed({
        embedder: embedder,
        content: split.pageContent,
        options: {
          outputDimensionality: 1536,
        },
      })
    )[0].embedding;

    const docRef = collectionRef.doc()
    batch.set(docRef, {
      embedding: FieldValue.vector(embedding),
      content: split.pageContent,
      metadata: {
        source: split.metadata.source,
        loc: split.metadata.loc,
        pdf: {
          totalPages: split.metadata.pdf.totalPages,
        },
      },
    })
  }

  try {
    await batch.commit();
    console.log(`Successfully inserted ${allSplits.length} documents`);
  } catch (error) {
    console.error('Error inserting documents:', error);
    throw error;
  }
};

const menuRetriever = defineFirestoreRetriever(ai, {
  name: "firestoreMenuRetriever",
  firestore,
  collection: "lgraph-firestore",
  contentField: "content",
  vectorField: "embedding",
  embedder,
  distanceMeasure: "COSINE",
});

const performQuery = async () => {
  const query = "Recommend a dessert from the menu while avoiding dairy and nuts";

  const retrievedDocs = await ai.retrieve({
    retriever: menuRetriever,
    query,
  });

  const { text } = await ai.generate({
    model: googleAI.model("gemini-2.5-flash"),
    prompt: `
  You are acting as a helpful AI assistant that can answer
  questions about the food available on the menu.

  Use only the context provided to answer the question.
  If you don't know, do not make up an answer.
  Do not add or change items on the menu.

  Question: ${query}`,
    docs: retrievedDocs,
  });
  console.log(text);
}

// seedFirestoreEmbeddings()
performQuery()
