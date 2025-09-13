import openAI from "@genkit-ai/compat-oai/openai";
import { defineFirestoreRetriever } from "@genkit-ai/firebase";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { genkit } from "genkit";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { nanoid } from "nanoid";
import path from "path";

const app = initializeApp({
  projectId: "agent-playground-49269",
});

const firestore = getFirestore(app);
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
firestore.settings({
  credentials: serviceAccount,
});

const ai = genkit({
  plugins: [
    openAI({
      apiKey: process.env.OPENAI_API_KEY,
    }),
  ],
});

const embedder = openAI.embedder("text-embedding-3-small", {
  outputDimensionality: 1536,
});

const USER_ID = "V1StGXR8_Z5jdHi6B-myT";
const userCollection = firestore.collection("lgraph-firestore-user");
const addUser = async () => {
  await userCollection.doc(USER_ID).set({
    name: "test",
  });
};

const PDFS = [
  {
    id: "K4Z-z_2-kiio5lFIsq1og",
    filePath: path.join(process.cwd(), "assets", "colony-dinner-menu.pdf"),
    fileName: "colony-dinner-menu",
  },
  {
    id: "y6_n6oOWShNXcpp2o9B0K",
    filePath: path.join(process.cwd(), "assets", "koma-lunch-menu.pdf"),
    fileName: "koma-lunch-menu",
  },
];
const embeddingCollection = firestore.collection("lgraph-firestore");

const uploadAndSeedPDFs = async () => {
  for (const pdf of PDFS) {
    await userCollection.doc(USER_ID).set(
      {
        files: FieldValue.arrayUnion({
          id: pdf.id,
          fileName: pdf.fileName,
        }),
      },
      { merge: true },
    );

    const filePath = path.resolve(pdf.filePath);
    const loader = new PDFLoader(filePath, {
      parsedItemSeparator: "",
    });
    const docs = await loader.load();

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const allSplits = await splitter.splitDocuments(docs);

    const embeddingBatch = firestore.batch();

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

      const docRef = embeddingCollection.doc();
      embeddingBatch.set(docRef, {
        embedding: FieldValue.vector(embedding),
        content: split.pageContent,
        userId: USER_ID,
        fileId: pdf.id,
        metadata: {
          source: split.metadata.source,
          loc: split.metadata.loc,
          pdf: {
            totalPages: split.metadata.pdf.totalPages,
          },
        },
      });
    }

    try {
      await embeddingBatch.commit();
      console.log(`Successfully inserted ${allSplits.length} documents`);
    } catch (error) {
      console.error("Error inserting documents:", error);
      throw error;
    }
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
    // THIS IS NEEDED IF NOT IT WILL QUERY ALL THE VECTOR STORE
    options:{
      where: {
        userId: USER_ID,
        fileId: PDFS[1].id
      }
    }
  });

  console.log(retrievedDocs)

  const { text } = await ai.generate({
    model: openAI.model("gpt-4o-mini"),
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


// await addUser()
// await uploadAndSeedPDFs();
await performQuery()
