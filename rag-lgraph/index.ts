import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import "cheerio";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { pull } from "langchain/hub";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { Document } from "@langchain/core/documents";
import { QdrantVectorStore } from "@langchain/qdrant";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import z from "zod";

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
});

const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
  url: process.env.QDRANT_URL,
  collectionName: "rag-lgraph",
});

// const pinecone = new PineconeClient({
//   apiKey: process.env.PINECONE_API_KEY!
// })
// const pineconeIndex = pinecone.Index('rag-lgraph');
// const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
//   pineconeIndex,
//   maxConcurrency: 5
// })

/**@description only run when there is a need to add data into the vector db */
const seedVectorDb = async () => {
  const pTagSelector = "p";
  const cheerioLoader = new CheerioWebBaseLoader(
    "https://lilianweng.github.io/posts/2023-06-23-agent/",
    {
      selector: pTagSelector,
    },
  );

  const docs = await cheerioLoader.load();
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const allSplits = await splitter.splitDocuments(docs);

  const totalDocuments = allSplits.length;
  const third = Math.floor(totalDocuments / 3);

  allSplits.forEach((document, i) => {
    // first third
    if (i < third) {
      document.metadata["section"] = "beginning";
    } else if (i < 2 * third) {
      document.metadata["section"] = "middle";
    } else {
      document.metadata["section"] = "end";
    }
  });

  await vectorStore.addDocuments(allSplits);
};

// await seedVectorDb()

const searchSchema = z.object({
  query: z.string().describe("Search query to run."),
  section: z.enum(["beginning", "middle", "end"]).describe("Section to query.")
})

const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
})

const structuredLlm = llm.withStructuredOutput(searchSchema);

const promptTemplate = await pull<ChatPromptTemplate>("rlm/rag-prompt");

const InputStateAnnotation = Annotation.Root({
  question: Annotation<string>,
});

const StateAnnotation = Annotation.Root({
  question: Annotation<string>,
  search: Annotation<z.infer<typeof searchSchema>>,
  context: Annotation<Document[]>,
  answer: Annotation<string>,
});

const analyze = async (state: typeof InputStateAnnotation.State) => {
  const result = await structuredLlm.invoke(state.question)
  return { search: result }
}

const retrieve = async (state: typeof StateAnnotation.State) => {
  const retrievedDocs = await vectorStore.similaritySearch(state.search.query, 2, {
    must: {
      key: 'metadata.section',
      match: { value: state.search.section }
    }
  });
  return { context: retrievedDocs };
};

const generate = async (state: typeof StateAnnotation.State) => {
  const docsContent = state.context.map((doc) => doc.pageContent).join("\n");
  const messages = await promptTemplate.invoke({
    question: state.question,
    context: docsContent,
  });
  const response = await llm.invoke(messages);
  return { answer: response.content };
};

const graph = new StateGraph(StateAnnotation)
  .addNode('analyze', analyze)
  .addNode("retrieve", retrieve)
  .addNode("generate", generate)
  .addEdge(START, "analyze")
  .addEdge("analyze", "retrieve")
  .addEdge("retrieve", "generate")
  .addEdge("generate", END)
  .compile();

let inputs = { question: "What does the end of the post say Task Decomposition?" };
console.log(inputs)
console.log("\n====\n");
for await (const chunk of await graph.stream(inputs, {
  streamMode: "updates",
})) {
  console.log(chunk);
  console.log("\n====\n");
}
