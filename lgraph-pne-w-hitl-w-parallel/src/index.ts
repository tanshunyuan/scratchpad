import {
  Annotation,
  END,
  MemorySaver,
  messagesStateReducer,
  Send,
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
  step: string;
  dependencies: string[];
  completed: boolean;
}
type Plan = Step[];
type PastSteps = Record<string, [string, string]>;

export const PlanExecuteState = Annotation.Root({
  input: Annotation<string>({
    reducer: (x, y) => y ?? x ?? "",
  }),
  plan: Annotation<string[]>({
    reducer: (state, update) => update ?? state ?? [],
    default: () => [],
  }),
  // PAIN
  structuredPlan: Annotation<Plan>({
    reducer: (state, update) => {
      const steps = [...(state as Step[])];

      for (const step of update as Step[]) {
        const idx = steps.findIndex((s) => s.id === step.id);
        if (idx >= 0) {
          steps[idx] = { ...steps[idx], ...step }; // update existing
        } else {
          steps.push(step); // add new
        }
      }

      return steps;
    },
    default: () => [],
  }),
  pastSteps: Annotation<PastSteps>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
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

const MOCK = true;

type State = typeof PlanExecuteState.State;
const plannerAgent = async (state: State) => {
  if (MOCK) {
    return {
      plan: [
        "Research and outline the key milestones in Dunlop's company history, focusing on innovation and heritage relevant to motorcycle riders.",
        "Write an engaging introduction that highlights Dunlop's significance in the tyre industry and connects with the target audience of motorcycle riders aged 18-50.",
        "Describe Dunlop's early developments and breakthroughs in tyre technology, emphasizing their impact on motorcycle performance and safety.",
        "Detail Dunlop's contributions to motorsports and how these achievements influenced their product innovation.",
        "Explain recent advancements and current products from Dunlop that appeal to modern motorcycle riders.",
        "Incorporate quotes or testimonials from motorcycle riders about their experiences with Dunlop tyres to create authenticity and connection.",
        "Conclude the article by summarizing Dunlop's legacy and continued commitment to innovation, encouraging readers to consider Dunlop for their motorcycle needs.",
        "Edit the article for clarity, tone, and flow to ensure it is engaging and accessible for the 18–50 motorcycle rider demographic.",
        'Add a compelling title "Dunlop: Innovation and Heritage in Tyres and Beyond" and finalize the article for publication.',
      ],
    };
  }

  // Actual
  const plannerSystemPrompt = SystemMessagePromptTemplate.fromTemplate(`
    # Role
    You are a **planning agent**. Your task is to create a **clear, detailed, and executable step-by-step plan** to create an essay based on the objective.

    # Plan Requirements
    - Create 5-10 individual tasks that yield the correct result when executed
    - Each step must include WHO does WHAT and HOW (when relevant)
    - Each step should focus on ONE primary task or deliverable to optimize execution time

    # Planning Considerations
    - Focus on content creation, research, and specialized analysis tasks
    - Each step should be independently executable without requiring outputs from multiple previous steps to be combined

    # Output Format
    - Return ONLY a list of actionable steps
    - Each step should be 1-2 sentences maximum and focus on ONE primary deliverable
    - Avoid bundling multiple distinct tasks (formatting, metadata, compilation) into single steps
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

  console.log("plannerAgent.plan ==> ", plan.steps);
  return {
    plan: plan.steps,
  };
};

const dependencyAnalyzerAgent = async (state: State) => {
  if (MOCK) {
    return {
      structuredPlan: [
        {
          id: "step1",
          step: "Research and outline the key milestones in Dunlop's company history, focusing on innovation and heritage relevant to motorcycle riders.",
          dependencies: [],
          completed: false,
        },
        {
          id: "step2",
          step: "Write an engaging introduction that highlights Dunlop's significance in the tyre industry and connects with the target audience of motorcycle riders aged 18-50.",
          dependencies: [],
          completed: false,
        },
        {
          id: "step3",
          step: "Describe Dunlop's early developments and breakthroughs in tyre technology, emphasizing their impact on motorcycle performance and safety.",
          dependencies: ["step1"],
          completed: false,
        },
        {
          id: "step4",
          step: "Detail Dunlop's contributions to motorsports and how these achievements influenced their product innovation.",
          dependencies: ["step1"],
          completed: false,
        },
        {
          id: "step5",
          step: "Explain recent advancements and current products from Dunlop that appeal to modern motorcycle riders.",
          dependencies: ["step1"],
          completed: false,
        },
        {
          id: "step6",
          step: "Incorporate quotes or testimonials from motorcycle riders about their experiences with Dunlop tyres to create authenticity and connection.",
          dependencies: [],
          completed: false,
        },
        {
          id: "step7",
          step: "Conclude the article by summarizing Dunlop's legacy and continued commitment to innovation, encouraging readers to consider Dunlop for their motorcycle needs.",
          dependencies: ["step1"],
          completed: false,
        },
        {
          id: "step8",
          step: "Edit the article for clarity, tone, and flow to ensure it is engaging and accessible for the 18–50 motorcycle rider demographic.",
          dependencies: ["step2", "step3", "step4", "step5", "step6", "step7"],
          completed: false,
        },
        {
          id: "step9",
          step: 'Add a compelling title "Dunlop: Innovation and Heritage in Tyres and Beyond" and finalize the article for publication.',
          dependencies: ["step8"],
          completed: false,
        },
      ],
    };
  }

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
      # Role
      You are a **dependency analyzer**. Your task is to analyze a list of sequential steps and determine their logical dependencies to enable parallel execution where possible.

      # Instructions
      1. Assign each step a unique ID (e.g., "step1", "step2", etc.).
      2. Preserve the exact step text from the input plan for each step.
      3. Infer dependencies based on these criteria:
         - **Information dependency**: Does this step require outputs/information from previous steps?
         - **Logical ordering**: Must this step happen after another for the result to make sense?
         - **Resource dependency**: Does this step build upon or modify artifacts from previous steps?
      4. Set "completed": false for all steps.
      5. Ensure dependencies are acyclic (no circular dependencies).
      6. Only include step IDs that exist in the plan as dependencies.

      # Dependency Analysis Guidelines
      - **Research/data gathering steps** can often run in parallel if they investigate different topics
      - **Writing steps** typically depend on completed research/analysis steps
      - **Editing/formatting steps** depend on writing steps being completed
      - **Outline/structure steps** should precede detailed writing steps
      - If a step can logically start without waiting for another, it should have NO dependency on that step

      # Constraints
      - Dependencies must form a Directed Acyclic Graph (DAG)
      - A step cannot depend on itself
      - A step cannot depend on steps that don't exist in the plan
      - Minimize dependencies: only declare a dependency if the step truly cannot begin without it
      - When in doubt about whether a dependency exists, prefer independence to maximize parallelization
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
    structuredPlan: result.steps,
  };
};

const batcherStep = async (state: State) => {
  const independent = [];
  const dependent = [];
  const plan = state.structuredPlan
  const pastSteps = state.pastSteps;

  for (const step of plan) {
    const dependencies = step.dependencies;
    if (step.completed) {
      // skip
      continue;
    }
    const noDependencies = isEmpty(dependencies);
    if (noDependencies) {
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
  console.log("batherStep.batches ==> ", batches);

  return {
    batches,
  };
};

const continueToExecutorAgentRouter = async (state: State) => {
  const processingBatch = state.batches[0];
  const structuredPlan = state.structuredPlan;
  const foundSteps = structuredPlan.filter((item) => processingBatch.includes(item.id));
  console.log("continueToExecutorAgentRouter.foundSteps ==> ", foundSteps);
  return foundSteps.map(
    (step) =>
      new Send("executor", {
        step,
        structuredPlan: structuredPlan,
        pastSteps: state.pastSteps,
      }),
  );
};

const executorAgent = async (state: {
  step: Step;
  structuredPlan: Plan;
  pastSteps: PastSteps;
}) => {
  console.log("executorAgent.state ==> ", state);
  if (MOCK) {
    // assume llm call is done
    const updatedStructuredPlan = state.structuredPlan.map((step) => {
      if (step.id === state.step.id) {
        console.log('heiman')
        return {
          ...step,
          completed: true,
        };
      }
    }).filter(Boolean)

    const updatedPastSteps = state.pastSteps;
    updatedPastSteps[state.step.id] = [
      state.step.step,
      `ANS FOR: ${state.step.step}`,
    ];

    return {
      ...state,
      structuredPlan: updatedStructuredPlan,
      pastSteps: updatedPastSteps,
    };
  }
};

const aggregateNode = async (state: State) => {
  console.log(`aggregateNode.state ==> `, state);
};

/**@todo probably need a router that checks AFTER executor is done, if dependency_analyzer still has stuff continue executing, else just continue */
const workflow = new StateGraph(PlanExecuteState)
  .addNode("planner", plannerAgent)
  .addNode("dependency_analyzer", dependencyAnalyzerAgent)
  .addNode("batcher", batcherStep)
  .addNode("executor", executorAgent)
  .addNode("aggregate_node", aggregateNode)
  .addEdge(START, "planner")
  .addEdge("planner", "dependency_analyzer")
  .addEdge("dependency_analyzer", "batcher")
  .addConditionalEdges("batcher", continueToExecutorAgentRouter)
  .addEdge("executor", "aggregate_node")
  .addEdge("aggregate_node", END);

const checkpointer = new MemorySaver();

const app = workflow.compile({
  checkpointer,
});

await app.stream(
  {
    input: `Write a Short-form article about Dunlop company history titled "Dunlop: Innovation and Heritage in Tyres and Beyond"  for Motorcycle riders (ages 18–50).`,
  },
  {
    streamMode: "values",
    configurable: {
      thread_id: 1234,
    },
  },
);
