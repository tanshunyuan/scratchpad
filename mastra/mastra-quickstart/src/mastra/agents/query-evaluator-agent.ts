import { Agent } from "@mastra/core";

export const queryEvaluatorAgent = new Agent({
  id: 'query-evaluator-agent',
  name: "Query evaluator agent",
  instructions: `Your task is to evaluate the nature of the given question relating to the user query.
  Determine whether it is a general inquiry that can be answered using the model knowledge.
  Or is it a specific inquiry about an order

  For each question, output the following:
  Category: Indicate 'General' or 'Order Inquiry'.
  `,
  model: "openai/gpt-4.1-mini",
});
