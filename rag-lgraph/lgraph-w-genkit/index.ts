import openAI from "@genkit-ai/compat-oai/openai";
import { defineFirestoreRetriever } from "@genkit-ai/firebase";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import {
  ToolMessage,
  HumanMessage,
  SystemMessage,
  AIMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import {
  MessagesAnnotation,
  StateGraph,
  START,
  END,
} from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { genkit, z } from "genkit";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { nanoid } from "nanoid";
import path from "path";
import { langfuseHandler, prettyPrint } from "../utils";

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

const retrieveSchema = z.object({ query: z.string() });
const retrieve = tool(
  async ({ query }) => {
    console.log("at retrieve...");
    console.log("retrieve.query ==> ", JSON.stringify(query, null, 2));
    const menuRetriever = defineFirestoreRetriever(ai, {
      name: "firestoreMenuRetriever",
      firestore,
      collection: "lgraph-firestore",
      contentField: "content",
      vectorField: "embedding",
      embedder,
      distanceMeasure: "COSINE",
    });
    const retrievedDocs = await ai.retrieve({
      retriever: menuRetriever,
      query,
      options: {
        where: {
          userId: USER_ID,
          fileId: PDFS[1].id,
        },
      },
    });

    const serialized = retrievedDocs
      .map((doc) => {
        return `Content: ${doc.text}`;
      })
      .join("\n");
    console.log(
      "retrieve.serialized ==> ",
      JSON.stringify(serialized, null, 2),
    );
    return [serialized, retrievedDocs];
  },
  {
    name: "retrieve",
    description: "Retrieve information related to a query",
    schema: retrieveSchema,
    responseFormat: "content_and_artifact",
  },
);

const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

const queryOrRespond = async (state: typeof MessagesAnnotation.State) => {
  console.log("at queryOrRespond...");
  const llmWithTools = llm.bindTools([retrieve]);
  console.log(
    "queryOrRespond.state.messages ==> ",
    JSON.stringify(state.messages, null, 2),
  );
  const response = await llmWithTools.invoke(state.messages, {
    callbacks: [langfuseHandler],
  });
  console.log(
    "queryOrRespond.response ==> ",
    JSON.stringify(response, null, 2),
  );
  return { messages: [response] };
};

const tools = new ToolNode([retrieve]);

const generate = async (state: typeof MessagesAnnotation.State) => {
  let recentToolMessages: ToolMessage[] = [];
  const lastMessageIdx = state.messages.length - 1;
  for (let i = lastMessageIdx; i >= 0; i--) {
    let message = state["messages"][i];
    if (message instanceof ToolMessage) {
      recentToolMessages.push(message);
    } else {
      break;
    }
  }
  console.log(
    "generate.recentToolMessages ==> ",
    JSON.stringify(recentToolMessages, null, 2),
  );

  let toolMessages = recentToolMessages.reverse();
  console.log(
    "generate.toolMessages ==> ",
    JSON.stringify(toolMessages, null, 2),
  );

  const docsContent = toolMessages.map((doc) => doc.content).join("\n");
  console.log(
    "generate.docsContent ==> ",
    JSON.stringify(docsContent, null, 2),
  );

  // const systemMessage = `
  //   You are an assistant for question-answering tasks.
  //   Use the following pieces of retrieved context to answer the question.
  //   If you don't know the answer, say that you don't know.
  //   Use three sentences maximum and keep the answer concise.

  //   <retrieved_context>
  //   ${docsContent}
  //   </retrieved_context>
  //   `;

  const systemMessage = `
    You are acting as a helpful AI assistant that can answer
    questions about the food available on the menu.

    Use only the context provided to answer the question.
    If you don't know, do not make up an answer.
    Do not add or change items on the menu.

    <retrieved_context>
    ${docsContent}
    </retrieved_context>
    `;

  const conversationMessages = state.messages.filter(
    (message) =>
      message instanceof HumanMessage ||
      message instanceof SystemMessage ||
      (message instanceof AIMessage && message.tool_calls.length == 0),
  );

  console.log(
    `generate.conversationMessages ==> `,
    JSON.stringify(conversationMessages, null, 2),
  );
  const prompt = [new SystemMessage(systemMessage), ...conversationMessages];
  console.log(`generate.prompt ==> `, JSON.stringify(prompt, null, 2));

  // Run
  const response = await llm.invoke(prompt, {
    callbacks: [langfuseHandler],
  });
  return { messages: [response] };
};

const graphBuilder = new StateGraph(MessagesAnnotation)
  .addNode("queryOrRespond", queryOrRespond)
  .addNode("tools", tools)
  .addNode("generate", generate)
  .addEdge(START, "queryOrRespond")
  .addConditionalEdges("queryOrRespond", toolsCondition, {
    __end__: END,
    tools: "tools",
  })
  .addEdge("tools", "generate")
  .addEdge("generate", END);

const graph = graphBuilder.compile();

let inputs1 = { messages: [{ role: "user", content: "Hello" }] };

for await (const step of await graph.stream(inputs1, {
  streamMode: "values",
})) {
  const lastMessage = step.messages[step.messages.length - 1];
  prettyPrint(lastMessage);
  console.log("-----\n");
}

let inputs2 = {
  messages: [
    {
      role: "user",
      content:
        "Recommend a dessert from the menu while avoiding dairy and nuts",
    },
  ],
};

for await (const step of await graph.stream(inputs2, {
  streamMode: "values",
})) {
  const lastMessage = step.messages[step.messages.length - 1];
  prettyPrint(lastMessage);
  console.log("-----\n");
}

// await addUser()
// await uploadAndSeedPDFs();
