/**
 * @link https://langchain-ai.github.io/langgraph/how-tos/graph-api/#conditional-branching
 */

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

const ParallelState = Annotation.Root({
  aggregate: Annotation<string[]>({
    reducer: (acc, curr) => [...acc, ...curr],
    default: () => [],
  }),
  /**@note this key determines which branch to target */
  branch_target:  Annotation<string>
});

type State = typeof ParallelState.State;

const aNode = (state: State) => {
  console.log(`adding A to ${state.aggregate}`);
  return {
    aggregate: ["A"],
    branch_target: 'c-node'
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


const workflow = new StateGraph(ParallelState);
workflow
  .addNode("a-node", aNode)
  .addNode("b-node", bNode)
  .addNode("c-node", cNode)
  .addEdge(START, "a-node")
  .addEdge("b-node", END)
  .addEdge("c-node", END)
  .addConditionalEdges('a-node', (state) => {
    // could also fill in a logic here to return a branch target instead
    // of specifying it at a-node
    if (state.branch_target === 'c-node'){
      return ['c-node']
    }
    return ['b-node']
  }, ['b-node', 'c-node'])

const graph = workflow.compile();
graph.invoke({ aggregate: [] });
