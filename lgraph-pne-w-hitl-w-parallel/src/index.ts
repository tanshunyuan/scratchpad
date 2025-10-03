import {
  Annotation,
  END,
  MemorySaver,
  messagesStateReducer,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { type BaseMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
} from "@langchain/core/prompts";
import { z } from "zod/v4";
import { isEmpty } from "lodash-es";

interface Step {
  id: string;
  description: string;
  dependencies: string[];
  completed: boolean;
}
type Plan = Step[];

export const PlanExecuteState = Annotation.Root({
  input: Annotation<string>({
    reducer: (x, y) => y ?? x ?? "",
  }),
  plan: Annotation<Plan | string[]>({
    reducer: (x, y) => y ?? x ?? [],
    default: () => [],
  }),
  // new Map<string, [string, string]>
  // pastSteps: Annotation<[string, string][]>({
  //   reducer: (x, y) => x.concat(y),
  // }),
  pastSteps: Annotation<Map<string, [string, string]>>({
    reducer: (x, y) => new Map([...x, ...y]),
    default: () => new Map(),
  }),
  batches: Annotation<string[][]>({
    reducer: (x, y) => y ?? x ?? [],
    default: () => [],
  }),
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
});

type State = typeof PlanExecuteState.State;
const plannerAgent = async (state: State) => {
  const plannerSystemPrompt = SystemMessagePromptTemplate.fromTemplate(`
    # Role
    You are a **planning agent**. Your task is to create a **clear, detailed, and executable step-by-step plan** to create an essay based on the objective.

    # Plan Requirements
    - Create 5-10 individual tasks that yield the correct result when executed
    - Each step must include WHO does WHAT and HOW (when relevant)

    # Output Format
    - Return ONLY a list of actionable steps
    - Each step should be 1-2 sentences maximum and focus on ONE primary deliverable
    `);
  const plannerHumanMessagePrompt = HumanMessagePromptTemplate.fromTemplate(`
    # Objective
    {objective}
    `);

  const plannerChatPrompt = ChatPromptTemplate.fromMessages([
    plannerSystemPrompt,
    plannerHumanMessagePrompt,
  ]);
  const planSchema = z.object({
    steps: z
      .array(z.string())
      .describe("different steps to follow, should be in sorted order"),
  });

  const plannerModel = new ChatOpenAI({
    model: "gpt-4.1-mini",
  }).withStructuredOutput(planSchema, {
    name: "plan",
  });

  const planner = plannerChatPrompt.pipe(plannerModel);

  const plan = await planner.invoke({
    objective: state.input,
  });
  return {
    plan: plan.steps,
  };
};

const dependencyAnalyzerAgent = async (state: State) => {
  const dependencyAnalyzerSchema = z
    .object({
      steps: z
        .array(
          z.object({
            id: z
              .string()
              .describe(
                "Unique identifier for the step (e.g., 'step1', 'step2')",
              ),
            step: z
              .string()
              .describe("The step itself, taken from the input plan"),
            dependencies: z
              .array(z.string())
              .describe("Array of step IDs that this step depends on"),
            completed: z
              .boolean()
              .default(false)
              .describe(
                "Flag indicating whether the step has been executed (initially false)",
              ),
          }),
        )
        .describe(
          "Array of steps, each with a unique ID, step, dependencies, and completion status",
        ),
    })
    .describe(
      `
      Each step is assigned a unique ID, its description is preserved, dependencies are inferred based on content,
      and completed is set to false. The structure ensures acyclic dependencies
      for execution in a plan-execute workflow, supporting parallel execution of independent steps.
    `,
    );

  const dependencyAnalyzerSystemPrompt =
    SystemMessagePromptTemplate.fromTemplate(`
    # Instructions
    1. Assign each step a unique ID (e.g., "step1", "step2", etc.).
    2. Preserve the exact step from the input plan for each step.
    3. Infer dependencies based on step content
    4. Set "completed": false for all steps.
    5. Ensure dependencies are acyclic (no circular dependencies).
    6. Only include step IDs that exist in the plan as dependencies.
    `);

  const dependencyAnalyzerHumanPrompt =
    HumanMessagePromptTemplate.fromTemplate(`
    # Plan
    {plan}
    `);

  const chatPrompt = ChatPromptTemplate.fromMessages([
    dependencyAnalyzerSystemPrompt,
    dependencyAnalyzerHumanPrompt,
  ]);

  const dependencyAnalyzerModel = new ChatOpenAI({
    model: "gpt-4.1-mini",
  }).withStructuredOutput(dependencyAnalyzerSchema, {
    name: "dependency_analyzer_schema",
  });

  const dependencyAnalyzer = chatPrompt.pipe(dependencyAnalyzerModel);

  const result = await dependencyAnalyzer.invoke({
    plan: state.plan.join("\n"),
  });

  console.log(result.steps);

  return {
    plan: result.steps,
  };
};

const batcherStep = async (state: State) => {
  const independent = [];
  const dependent = [];
  const plan = state.plan as Plan;

  for (const step of plan) {
    const dependencies = step.dependencies;
    const noDependencies = isEmpty(dependencies);
    if (step.completed) {
      // skip
      continue;
    } else if (noDependencies) {
      independent.push(step.id);
    } else {
      dependent.push(step.id);
    }
  }

  /**
   * @description
   * put the independent steps infront, followed by those that require batching.
   * @example
   * [[4,5,6,7],[1],[2],[3]]
   */
  const batches = [independent];
  for (const item of dependent) {
    batches.push([item]);
  }
  console.log(batches);

  return {
    batches,
  };
};

const executorAgent = async (state: State) => {
  const processingBatch = state.batches[0]
  const plan = state.plan as Plan
  if(processingBatch.length > 1 ){
    const promises = []
    for (const stepId of processingBatch){
      const foundStep = plan.find(step => step.id === stepId)
      // wait to invoke a llm
      promises.push(foundStep)
    }
    console.log(promises)
  }

};

/**@todo probably need a router that checks AFTER executor is done, if dependency_analyzer still has stuff continue executing, else just continue */
const workflow = new StateGraph(PlanExecuteState)
  .addNode("planner", plannerAgent)
  .addNode("dependency_analyzer", dependencyAnalyzerAgent)
  .addNode("batcher", batcherStep)
  .addNode("executor", executorAgent)
  .addEdge(START, "planner")
  .addEdge("planner", "dependency_analyzer")
  .addEdge("dependency_analyzer", "batcher")
  .addEdge("batcher", "executor")
  .addEdge("executor", END);

const checkpointer = new MemorySaver();

const app = workflow.compile({
  checkpointer,
});

// await app.stream(
//   {
//     input: `Write a Short-form article about Dunlop company history titled "Dunlop: Innovation and Heritage in Tyres and Beyond"  for Motorcycle riders (ages 18–50).`,
//   },
//   {
//     streamMode: "values",
//     configurable: {
//       thread_id: 1234,
//     },
//   },
// );

const SAMPLE_STEPS = [
  {
    id: "step1",
    step: "Research Dunlop company's history focusing on key innovations and milestones, with an emphasis on relevance to motorcycle riders, by using credible sources such as official company websites and industry publications.",
    dependencies: [],
    completed: false,
  },
  {
    id: "step2",
    step: "Outline the article structure including an engaging introduction, main body covering history and innovations, and a concise conclusion highlighting heritage and relevance to the target audience.",
    dependencies: ["step1"],
    completed: false,
  },
  {
    id: "step3",
    step: "Write an attention-grabbing introduction that contextualizes Dunlop's significance in the motorcycle community, targeting readers aged 18-50.",
    dependencies: ["step2"],
    completed: false,
  },
  {
    id: "step4",
    step: "Draft the main body paragraphs detailing Dunlop's founding, major technological advancements in tyre development, and its impact on motorcycle performance and safety.",
    dependencies: ["step2", "step1"],
    completed: false,
  },
  {
    id: "step5",
    step: "Include specific examples or anecdotes about Dunlop's innovations that directly benefit motorcycle riders to enhance engagement.",
    dependencies: ["step4"],
    completed: false,
  },
  {
    id: "step6",
    step: "Write a conclusion that summarizes Dunlop's contributions to the tyre industry and reinforces its heritage and ongoing innovation.",
    dependencies: ["step4"],
    completed: false,
  },
  {
    id: "step7",
    step: "Edit the article for clarity, tone, and engagement, ensuring the language is accessible and appealing to the target demographic of motorcycle riders aged 18-50.",
    dependencies: ["step3", "step5", "step6"],
    completed: false,
  },
  {
    id: "step8",
    step: "Proofread the article to eliminate grammatical errors and ensure correct spelling, particularly of technical terms related to motorcycles and tyres.",
    dependencies: ["step7"],
    completed: false,
  },
  {
    id: "step9",
    step: "Format the article to be concise and easy to read, using short paragraphs, subheadings, and bullet points if appropriate, to suit online reading preferences of motorcycle enthusiasts.",
    dependencies: ["step8"],
    completed: false,
  },
  {
    id: "step10",
    step: "Finalize the article with a compelling title 'Dunlop: Innovation and Heritage in Tyres and Beyond', and prepare it for publication on a platform frequented by motorcycle riders.",
    dependencies: ["step9"],
    completed: false,
  },
];
const SAMPLE_STEPS_2 = [
  {
    id: "step1",
    description: "Define structure...",
    dependencies: [],
    completed: false,
  },
  {
    id: "step2",
    description: "Research history...",
    dependencies: [],
    completed: false,
  },
  {
    id: "step3",
    description: "Summarize development...",
    dependencies: ["step2"],
    completed: false,
  },
  {
    id: "step4",
    description: "Document moments...",
    dependencies: [],
    completed: false,
  },
  {
    id: "step5",
    description: "Investigate diversification...",
    dependencies: [],
    completed: false,
  },
  {
    id: "step6",
    description: "Fact-check...",
    dependencies: ["step2", "step3", "step4", "step5"],
    completed: false,
  },
  {
    id: "step7",
    description: "Draft introduction...",
    dependencies: ["step1", "step6"],
    completed: false,
  },
  {
    id: "step8",
    description: "Compose body...",
    dependencies: ["step1", "step6"],
    completed: false,
  },
  {
    id: "step9",
    description: "Write conclusion...",
    dependencies: ["step1", "step6"],
    completed: false,
  },
];

// await batcherStep({ plan: SAMPLE_STEPS });
const batchRes = await batcherStep({ plan: SAMPLE_STEPS_2 });
await executorAgent({plan: SAMPLE_STEPS_2, batches: batchRes.batches})
