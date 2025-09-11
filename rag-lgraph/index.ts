import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { tool } from "@langchain/core/tools";
import { END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import z from "zod";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { prettyPrint } from './utils'

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
});

const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
  url: process.env.QDRANT_URL,
  collectionName: "rag-lgraph",
});

// query analysis tool? Rewrite the user query hmm?

const retrieveSchema = z.object({ query: z.string() });
const retrieve = tool(
  async ({ query }) => {
    console.log('at retrieve...')
    const retrievedDocs = await vectorStore.similaritySearch(query);
    console.log('retrieve.retrievedDocs ==> ', JSON.stringify(retrievedDocs, null, 2))
    const serialized = retrievedDocs.map(
      (doc) => `Source: ${doc.metadata.source} \n Content: ${doc.pageContent}`,
    ).join('\n')
    console.log('retrieve.serialized ==> ', JSON.stringify(serialized, null, 2))
    return [serialized, retrievedDocs]
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
  console.log('at queryOrRespond...')
  const llmWithTools = llm.bindTools([retrieve]);
  console.log('queryOrRespond.state.messages ==> ', JSON.stringify(state.messages, null, 2))
  const response = await llmWithTools.invoke(state.messages);
  console.log('queryOrRespond.response ==> ', JSON.stringify(response, null, 2))
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

  const systemMessage = `
    You are an assistant for question-answering tasks.
    Use the following pieces of retrieved context to answer the question.
    If you don't know the answer, say that you don't know.
    Use three sentences maximum and keep the answer concise.

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

  console.log(`generate.conversationMessages ==> `, JSON.stringify(conversationMessages, null, 2))
  const prompt = [new SystemMessage(systemMessage), ...conversationMessages];
  console.log(`generate.prompt ==> `, JSON.stringify(prompt, null, 2))

  // Run
  const response = await llm.invoke(prompt);
  return { messages: [response] };
};

const graphBuilder = new StateGraph(MessagesAnnotation)
  .addNode('queryOrRespond', queryOrRespond)
  .addNode('tools', tools)
  .addNode('generate', generate)
  .addEdge(START, 'queryOrRespond')
  .addConditionalEdges('queryOrRespond', toolsCondition, {
    "__end__": END,
    tools: 'tools'
  })
  .addEdge('tools', 'generate')
  .addEdge('generate', END)

const graph = graphBuilder.compile()

let inputs1 = { messages: [{ role: "user", content: "Hello" }] };

for await (const step of await graph.stream(inputs1, {
  streamMode: "values",
})) {
  const lastMessage = step.messages[step.messages.length - 1];
  prettyPrint(lastMessage);
  console.log("-----\n");
}

let inputs2 = {
  messages: [{ role: "user", content: "What is Task Decomposition?" }],
};

for await (const step of await graph.stream(inputs2, {
  streamMode: "values",
})) {
  const lastMessage = step.messages[step.messages.length - 1];
  prettyPrint(lastMessage);
  console.log("-----\n");
}
