import { createStep, createWorkflow } from "@mastra/core/workflows";
import { customerSupportAgent } from "../agents/customer-support-agent";
import z from "zod";
import { queryEvaluatorAgent } from "../agents/query-evaluator-agent";

const categorySchema = z.enum(["GENERAL", "ORDER INQUIRY"]);

const categorizeQueryStep = createStep({
  id: "categorize-query-step",
  inputSchema: z.object({
    query: z.string(),
  }),
  outputSchema: z.object({
    category: categorySchema,
    query: z.string(),
  }),
  execute: async ({ inputData }) => {
    const result = await queryEvaluatorAgent.generate(
      `Evaluate the followiong customer query: ${inputData.query}`,
      {
        structuredOutput: {
          schema: z.object({
            category: categorySchema,
          }),
        },
      },
    );
    return {
      query: inputData.query,
      category: result.object.category,
    };
  },
});

const generateAnswerStep = createStep({
  id: "generate-answer-step",
  inputSchema: z.object({
    query: z.string(),
    category: categorySchema,
  }),
  outputSchema: z.object({
    answer: z.string(),
  }),
  execute: async ({ inputData }) => {
    const result = await customerSupportAgent.generate(
      `Answer the following customer query: ${inputData.query}`,
    );

    return {
      answer: result.text,
    };
  },
});

/**
 * @note the whole function will re-run upon resuming
 */
const askUserForAnswerStep = createStep({
  id: "ask-user-for-answer-step",
  inputSchema: z.object({
    query: z.string(),
    category: categorySchema,
  }),
  outputSchema: z.object({
    answer: z.string(),
  }),
  resumeSchema: z.object({
    answer: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return suspend({});
    }

    return {
      answer: inputData.query,
    };
  },
});

const respondStep = createStep({
  id: "respond-step",
  inputSchema: z.object({
    "generate-answer-step": z.object({
      answer: z.string(),
    }).optional(),
    "ask-user-for-answer-step": z.object({
      answer: z.string(),
    }).optional(),
  }),
  outputSchema: z.object({}),
  execute: async ({ inputData }) => {
    /**@see https://mastra.ai/docs/workflows/control-flow#output-structure-1 */
    const answer = inputData["generate-answer-step"]?.answer || inputData["ask-user-for-answer-step"]?.answer;
    console.log(`pretending to respond with answer`, answer);
    return {};
  },
});

export const singleTurnHitlWorkflow = createWorkflow({
  id: "single-turn-hitl-workflow",
  inputSchema: z.object({
    query: z.string(),
  }),
  outputSchema: z.object({}),
})
  .then(categorizeQueryStep)
  .branch([
    [
      async ({ inputData: { category } }) => category === "GENERAL",
      generateAnswerStep,
    ],
    [
      async ({ inputData: { category } }) => category === "ORDER INQUIRY",
      askUserForAnswerStep,
    ],
  ])
  .then(respondStep)
  .commit();
