/**@link https://langchain-ai.github.io/langgraph/how-tos/graph-api/#map-reduce-and-the-send-api */
import { Annotation, END, Send, START, StateGraph } from "@langchain/langgraph";

const MapReduceAndSendAPIState = Annotation.Root({
  topic: Annotation<string>,
  subjects: Annotation<string[]>,
  subject: Annotation<string>,
  jokes: Annotation<string[]>({
    reducer: (acc, curr) => [...acc, ...curr],
    default: () => [],
  }),
  bestSelectedJoke: Annotation<string>,
});

type State = typeof MapReduceAndSendAPIState.State;

const generateTopicsNode = (state: State) => {
  return {
    subjects: ["lions", "elephants", "penguins"],
  };
};

const generateJokeNode = (state: State) => {
  const jokeMap = new Map([
    ["lions", "Why don't lions like fast food? Because they can't catch it!"],
    [
      "elephants",
      "Why don't elephants use computers? They're afraid of the mouse!",
    ],
    [
      "penguins",
      "Why don't penguins like talking to strangers at parties? Because they find it hard to break the ice.",
    ],
  ]);

  return {
    jokes:
      jokeMap.get(state.subject) !== undefined
        ? ([jokeMap.get(state.subject)] as string[])
        : [],
  };
};

const continueToJokeRouter = (state: State) => {
  return state.subjects.map((subject) => {
    return new Send("generate-joke-node", { subject });
  });
};

const bestJokeNode = (state: State) => {
  return {
    bestSelectedJoke: "penguins",
  };
};

const workflow = new StateGraph(MapReduceAndSendAPIState);

workflow
  .addNode("generate-topics-node", generateTopicsNode)
  .addNode("generate-joke-node", generateJokeNode)
  .addNode("best-joke-node", bestJokeNode)
  .addEdge(START, "generate-topics-node")
  .addConditionalEdges("generate-topics-node", continueToJokeRouter, [
    "generate-joke-node",
  ])
  .addEdge("generate-joke-node", "best-joke-node")
  .addEdge("best-joke-node", END);

const graph = workflow.compile();

for await (const step of await graph.stream({ topic: "animals" })) {
  console.log(step);
}
