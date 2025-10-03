/**
 * @link https://langchain-ai.github.io/langgraph/how-tos/graph-api/#defer-node-execution
 */

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

const ParallelState = Annotation.Root({
  aggregate: Annotation<string[]>({
    reducer: (acc, curr) => [...acc, ...curr],
    default: () => [],
  }),
});

type State = typeof ParallelState.State;

const aNode = (state: State) => {
  console.log(`adding A to ${state.aggregate}`);
  return {
    aggregate: ["A"],
  };
};

const bNode = (state: State) => {
  console.log(`adding B to ${state.aggregate}`);
  return {
    aggregate: ["B"],
  };
};

const b2Node = (state: State) => {
  console.log(`adding B_2 to ${state.aggregate}`);
  return {
    aggregate: ["B_2"],
  };
};

const cNode = (state: State) => {
  console.log(`adding C to ${state.aggregate}`);
  return {
    aggregate: ["C"],
  };
};

const dNode = (state: State) => {
  console.log(`adding D to ${state.aggregate}`);
  return {
    aggregate: ["D"],
  };
};

const workflow = new StateGraph(ParallelState);
workflow
  .addNode("a-node", aNode)
  .addNode("b-node", bNode)
  .addNode("b2-node", b2Node)
  .addNode("c-node", cNode)
  .addNode("d-node", dNode, {
    defer: true
  })
  .addEdge(START, "a-node")
  .addEdge("a-node", "b-node")
  .addEdge("a-node", "c-node")
  .addEdge("b-node", "b2-node")
  .addEdge("b2-node", "d-node")
  .addEdge("c-node", "d-node")
  .addEdge("d-node", END);

const graph = workflow.compile();
graph.invoke({ aggregate: [] });
