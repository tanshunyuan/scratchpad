import {
  Annotation,
  Command,
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
import { createReactAgent } from "@langchain/langgraph/prebuilt";

import { DirectedGraph } from "graphology";
import { hasCycle } from "graphology-dag";
import { dfs } from "graphology-traversal";
import { BaseToolkit, tool } from "@langchain/core/tools";

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
  structuredPlan: Annotation<Plan>({
    reducer: (state, update) => {
      const plan = [...state];
      const updatedIds = new Set<string>(); // Track updated step IDs

      // Process updates (could be single step or partial list)
      for (const step of update) {
        const idx = plan.findIndex((s) => s.id === step.id);
        if (idx >= 0) {
          // Update existing step, preserving fields unless explicitly updated
          plan[idx] = {
            ...plan[idx], // Retain original fields (step, dependencies)
            completed: step.completed ?? plan[idx].completed, // Prioritize update's completed
          };
          updatedIds.add(step.id);
        } else {
          // Add new step (for dynamic additions, if supported)
          plan.push(step);
          updatedIds.add(step.id);
        }
      }

      // Ensure no step reverts completed: true to false in concurrent updates
      // (Optional: Add if race conditions persist)
      for (const step of plan) {
        if (!updatedIds.has(step.id) && step.completed) {
          // Preserve completed: true if not explicitly updated
          continue;
        }
      }

      return plan;
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
  finalOutput: Annotation<string>({
    reducer: (x, y) => y ?? x ?? "",
    default: () => "",
  }),
});

// const MOCK = true;
const MOCK = false;

// Define the input schema using Zod
const webSearchSchema = z.object({
  query: z.string().describe("The search query to look up online"),
});

// Create the WebSearchTool using the `tool` function
const webSearchTool = tool(
  async (input) => {
    console.log("calling webSearchTool with ", input);
    const { query } = input; // Destructure the input based on the schema
    return `Mock results for query: ${query}`;
  },
  {
    name: "web_search",
    description:
      "Search the web for information using a query. Returns snippets from relevant sources.",
    schema: webSearchSchema,
  },
);
type State = typeof PlanExecuteState.State;
const plannerAgent = async (state: State) => {
  console.log("at plannerAgent");
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
  try {
    const plannerSystemPrompt = SystemMessagePromptTemplate.fromTemplate(`
      # Role
      You are a **planning agent**. Your task is to create a **clear, detailed, and executable step-by-step plan** to create an essay based on the objective.

      # Plan Requirements
      - Create 3-5 individual tasks that yield the correct result when executed
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
  } catch (error) {
    console.error("plannerAgent.catch error ==>", error);
    throw new Error(error);
  }
};

interface DAGValidationResult {
  isValid: boolean;
  errors: string[];
  cycles?: string[][];
}

const validateDAG = (plan: Plan) => {
  const errors = [];
  const stepIds = new Set(plan.map((s) => s.id));

  const containsRepeatedSteps = stepIds.size !== plan.length;
  if (containsRepeatedSteps) {
    errors.push("Duplicate step IDs found");
    return { isValid: false, errors };
  }

  const invalidDepsErr = [];
  for (const step of plan) {
    for (const depId of step.dependencies) {
      const containsNonExistentStep = !stepIds.has(depId);
      if (containsNonExistentStep) {
        invalidDepsErr.push(
          `Step ${step.id} depends on non existent step ${depId}`,
        );
      }
    }
  }

  if (invalidDepsErr.length > 0) {
    errors.push(...invalidDepsErr);
    return { isValid: false, errors };
  }

  for (const step of plan) {
    if (step.dependencies.includes(step.id)) {
      errors.push(`Step ${step.id} cannot depend on itself`);
    }
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  const graph = new DirectedGraph();
  plan.forEach((step) => {
    graph.addNode(step.id, { step: step.step });
  });
  plan.forEach((step) => {
    step.dependencies.forEach((depId) => {
      graph.addEdge(step.id, depId); // Edge: step -> depId (step requires depId)
    });
  });

  if (hasCycle(graph)) {
    errors.push("Circular dependencies detected");
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [] };
};

const dependencyAnalyzerAgent = async (state: State) => {
  console.log("at dependencyAnalyzerAgent");
  if (MOCK) {
    const result = {
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
    const validationResult = validateDAG(result.structuredPlan);
    console.log("validationResult ==> ", validationResult);
    return result;
  }

  const outputSchema = z
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

  const systemPrompt = SystemMessagePromptTemplate.fromTemplate(`
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

  const humanPrompt = HumanMessagePromptTemplate.fromTemplate(`
    # Plan
    {plan}

    {validationFeedback}
    `);

  const chatPrompt = ChatPromptTemplate.fromMessages([
    systemPrompt,
    humanPrompt,
  ]);

  const model = new ChatOpenAI({
    model: "gpt-4.1-mini",
  }).withStructuredOutput(outputSchema, {
    name: "dependency_analyzer_schema",
  });

  const dependencyAnalyzer = chatPrompt.pipe(model);

  let attempt = 0;
  let validationFeedback = "";
  let result: Plan | null = null;
  let validationResult: DAGValidationResult | null = null;
  const maxRetries = 2;

  while (attempt < maxRetries) {
    attempt++;
    console.log(
      `dependencyAnalyzerAgent.while attempt ${attempt}/${maxRetries}`,
    );

    // Invoke the LLM
    const response = await dependencyAnalyzer.invoke({
      plan: state.plan.join("\n"),
      validationFeedback,
    });

    // Validate the DAG
    validationResult = validateDAG(response.steps);

    if (validationResult.isValid) {
      console.log("✅ Valid DAG generated");
      result = response.steps;
      break;
    }

    // Prepare feedback for next attempt
    console.warn(`❌ Invalid DAG: ${validationResult.errors.join(", ")}`);
    validationFeedback = `
      # VALIDATION ERRORS FROM PREVIOUS ATTEMPT
      Your previous response had the following issues:
      ${validationResult.errors.map((e, i) => `${i + 1}. ${e}`).join("\n")}

      Please fix these issues and ensure:
      - All step IDs are unique
      - All dependencies reference existing step IDs
      - No step depends on itself
      - No circular dependencies exist
    `;

    if (attempt === maxRetries) {
      throw new Error(
        `Failed to generate valid DAG after ${maxRetries} attempts. Errors: ${validationResult.errors.join(", ")}`,
      );
    }
  }
  console.log(
    "dependencyAnalyzerAgent.structuredPlan ==> ",
    JSON.stringify(result, null, 2),
  );

  return {
    structuredPlan: result,
  };
};

const batcherStep = async (state: State) => {
  const readyTasks = [];
  const plan = state.structuredPlan;
  const executedIds = new Set(Object.keys(state.pastSteps));

  for (const step of plan) {
    const dependencies = step.dependencies;
    if (step.completed || executedIds.has(step.id)) {
      console.log("batcherStep.for.if skipping ", step.id);
      continue;
    }

    // Check if all dependencies are resolved
    const isStepDependencyResolved = dependencies.every(
      (dep) => dep in state.pastSteps,
    );
    const ready = isEmpty(dependencies) || isStepDependencyResolved;
    if (ready) {
      readyTasks.push(step.id);
    }
  }

  // Add ready tasks as a batch; dependent tasks wait for next cycle
  const batches = readyTasks.length > 0 ? [readyTasks] : [];
  console.log("batcherStep.batches ==> ", batches);

  return {
    batches,
  };
};

const continueToExecutorAgentRouter = async (state: State) => {
  const processingBatch = state.batches[0];
  const structuredPlan = state.structuredPlan;
  const foundSteps = structuredPlan.filter((item) =>
    processingBatch.includes(item.id),
  );
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
  console.log("executorAgent processing step ==> ", state.step);
  if (MOCK) {
    const updatedStructuredPlan = [
      {
        id: state.step.id,
        step: state.step.step,
        dependencies: state.step.dependencies,
        completed: true,
      },
    ];

    const updatedPastSteps = state.pastSteps;
    updatedPastSteps[state.step.id] = [
      state.step.step,
      `ANS FOR: ${state.step.step}`,
    ];

    console.log(
      "executorAgent.if updatedStructuredPlan | updatedPastSteps ==> ",
      {
        updatedPastSteps,
        updatedStructuredPlan,
      },
    );

    return {
      ...state,
      structuredPlan: updatedStructuredPlan,
      pastSteps: updatedPastSteps,
      messages: [{ role: "assistant", content: `ANS FOR: ${state.step.step}` }],
    };
  }
  try {
    const formattedStepDependencies = state.step.dependencies
      .map((depId) => {
        const [step, result] = state.pastSteps[depId];
        return `
      ## Step taken
      ${step}
      ## Result
      ${result}
      `;
      })
      .join("\n\n");
    const prompt = ChatPromptTemplate.fromTemplate(`
      {contextIfNeeded}

      # Current Task
      {currentTask}
      `);

    const filledPrompt = await prompt.invoke({
      currentTask: state.step.step,
      contextIfNeeded: isEmpty(formattedStepDependencies)
        ? "No context required"
        : `# Context \ ${formattedStepDependencies}`,
    });

    const model = new ChatOpenAI({
      model: "gpt-4.1-mini",
    });

    const agentExecutor = createReactAgent({
      llm: model,
      tools: [webSearchTool],
    });

    const result = await agentExecutor.invoke(filledPrompt);
    const updatedStructuredPlan = [
      {
        id: state.step.id,
        step: state.step.step,
        dependencies: state.step.dependencies,
        completed: true,
      },
    ];

    const output =
      result.messages[result.messages.length - 1].content.toString();

    const updatedPastSteps = state.pastSteps;
    updatedPastSteps[state.step.id] = [state.step.step, output];

    return {
      ...state,
      structuredPlan: updatedStructuredPlan,
      pastSteps: updatedPastSteps,
      messages: [{ role: "assistant", content: output }],
    };
  } catch (error) {
    console.log("executorAgent.catch.error ", error);
    throw new Error(error);
  }
};

const shouldContinueToBatcherOrAggregate = (state: State) => {
  console.log("at shouldContinueToBatcherOrAggregate");
  const isAllCompleted = state.structuredPlan.every((step) => step.completed);
  console.log(
    "shouldContinueToBatcherOrAggregate.isAllCompleted ==> ",
    isAllCompleted,
  );
  if (isAllCompleted) {
    return "aggregate_node";
  } else {
    return "batcher";
  }
};

const aggregateNode = async (state: State) => {
  console.log("at aggregateNode");
  console.log("aggregateNode.state ==> ", JSON.stringify(state));
  if (MOCK) {
    console.log("aggregateNode: Consolidating results");
    return { finalOutput: "Mock consolidated article" };
  }
  const formattedPastSteps = Object.values(state.pastSteps)
    .map((step) => {
      const [objective, answer] = step;
      return answer;
    })
    .join("\n");
  const prompt = ChatPromptTemplate.fromTemplate(`
    Consolidate the following item into a complete article
    {item}
    `);

  const filledPrompt = await prompt.invoke({
    item: formattedPastSteps,
  });

  const model = new ChatOpenAI({
    model: "gpt-4.1-mini",
  });

  const result = await model.invoke(filledPrompt);
  console.log("aggregateNode.result ==> ", result.content);
  return { finalOutput: result.content };
};

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
  .addConditionalEdges("executor", shouldContinueToBatcherOrAggregate)
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
