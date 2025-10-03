/**@link https://langchain-ai.github.io/langgraphjs/how-tos/map-reduce/ */

import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Annotation, END, Send, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod/v4";
import { env } from "../env.js";

const OverallState = Annotation.Root({
  topic: Annotation<string>,
  subjects: Annotation<string[]>,
  jokes: Annotation<string[]>({
    reducer: (state, update) => state.concat(update),
    default: () => [],
  }),
  bestSelectedJoke: Annotation<string>,
});

type OverallStateArg = typeof OverallState.State;
type OverallStateReturn = Partial<OverallStateArg>;

const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  apiKey: env.OPENAI_API_KEY,
});

const generateTopics = async (
  state: OverallStateArg,
): Promise<OverallStateReturn> => {
  const prompt = ChatPromptTemplate.fromTemplate(`
    Generate a comma separated list of between 2 and 5 examples related to: {topic}
  `);
  const response = await prompt
    .pipe(
      llm.withStructuredOutput(
        z.object({
          subjects: z.array(z.string()),
        }),
        { name: "subjects" },
      ),
    )
    .invoke({
      topic: state.topic,
    });

  return { subjects: response.subjects };
};

interface JokeState {
  subject: string;
}

/**@note a separate state */
const generateJoke = async (state: JokeState): Promise<{ jokes: string[] }> => {
  const prompt = ChatPromptTemplate.fromTemplate(`
    Generate a joke about {subject}
    `);
  const response = await prompt
    .pipe(
      llm.withStructuredOutput(
        z.object({
          joke: z.string(),
        }),
        { name: "joke" },
      ),
    )
    .invoke({
      subject: state.subject,
    });

  return {
    jokes: [response.joke],
  };
};

const continueToGenerateJokesRouter = (state: OverallStateArg) => {
  return state.subjects.map((subject) => new Send("generateJoke", { subject }));
};

const bestJoke = async (
  state: OverallStateArg,
): Promise<OverallStateReturn> => {
  console.log(`bestJoke.state ==> `, JSON.stringify(state, null, 2));
  const jokes = state.jokes.join("\n\n");
  const prompt = ChatPromptTemplate.fromTemplate(`
    Below are a bunch of jokes about {topic}. Select the best one! Return the ID (index) of the best one.

    <jokes>
    {jokes}
    </jokes>
    `);

  const response = await prompt
    .pipe(
      llm.withStructuredOutput(z.object({ id: z.number() }), {
        name: "best_joke",
      }),
    )
    .invoke({
      topic: state.topic,
      jokes: jokes,
    });

  return {
    bestSelectedJoke: state.jokes[response.id],
  };
};

const workflow = new StateGraph(OverallState);

workflow
  .addNode("generateTopics", generateTopics)
  .addNode("generateJoke", generateJoke)
  .addNode("bestJoke", bestJoke)
  .addEdge(START, "generateTopics")
  .addConditionalEdges("generateTopics", continueToGenerateJokesRouter)
  .addEdge("generateJoke", "bestJoke")
  .addEdge("bestJoke", END);

const app = workflow.compile();

for await (const step of await app.stream({ topic: "animals" })) {
  console.log(step);
}
