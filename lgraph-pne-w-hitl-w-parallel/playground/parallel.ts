/**
 * @link https://langchain-ai.github.io/langgraph/how-tos/graph-api/#run-graph-nodes-in-parallel
 * @qn How does fan out and fan in mechanism help achieve parallization?
 * @ans Alongside a accumulator (add only) in the state, fan out allows a node
 * to call two other node at the same time (parallel). Thereafter, with both nodes completing it's execution
 * both will call one node to fan in.
 *
 * @qn What is fan out and fan in mechanism?
 * @ans fan out is calling two nodes at the same time from one node, while fan in is having two nodes or more calling
 * one node
 */

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

const ParallelState = Annotation.Root({
  aggregate: Annotation<string[]>({
    /**
     * @qn what is reducer?
     * @ans
     */
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
  .addNode("c-node", cNode)
  .addNode("d-node", dNode)
  .addEdge(START, "a-node")
  .addEdge("a-node", "b-node")
  .addEdge("a-node", "c-node")
  .addEdge("b-node", "d-node")
  .addEdge("c-node", "d-node")
  .addEdge("d-node", END);

const graph = workflow.compile();
graph.invoke({ aggregate: [] });
