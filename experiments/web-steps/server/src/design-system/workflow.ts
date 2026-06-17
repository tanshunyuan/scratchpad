import { createOpenAI } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { env } from "../../env.js";
import { logDesignSystem } from "./log.js";
import {
  createDesignSystemBoardInPenpot,
  exportPenpotBoardPreview,
} from "./penpot.js";
import {
  GenerateDesignSystemInputSchema,
  GenerateDesignSystemResultSchema,
  PenpotBoardInfoSchema,
  PenpotBoardPlanSchema,
  PreviewSchema,
  ProjectContextSchema,
  type GenerateDesignSystemInput,
  type GenerateDesignSystemResult,
} from "./types.js";

const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
});

const ContextEnvelopeSchema = z.object({
  projectId: z.string(),
  context: ProjectContextSchema,
});

const DesignTextEnvelopeSchema = ContextEnvelopeSchema.extend({
  designSystemText: z.string(),
});

const BoardPlanEnvelopeSchema = DesignTextEnvelopeSchema.extend({
  penpotBoardPlan: PenpotBoardPlanSchema,
});

const PenpotEnvelopeSchema = BoardPlanEnvelopeSchema.extend({
  penpot: PenpotBoardInfoSchema,
});

const PreviewEnvelopeSchema = PenpotEnvelopeSchema.extend({
  preview: PreviewSchema,
});

const loadContext = createStep({
  id: "loadContext",
  inputSchema: GenerateDesignSystemInputSchema,
  outputSchema: ContextEnvelopeSchema,
  execute: async ({ inputData }) => {
    logDesignSystem("step 1/6 loading PRD + UL", {
      projectId: inputData.projectId,
    });

    if (inputData.projectId !== "demo-project") {
      throw new Error(`Unknown projectId: ${inputData.projectId}`);
    }

    const context = {
      prd: [
        "Build Web Steps, a guided product discovery tool for small teams.",
        "Users create projects, capture PRDs, define domain language, and generate UI artifacts.",
        "Tone: focused, calm, practical. Must feel trustworthy and fast.",
      ].join("\n"),
      ubiquitousLanguage: [
        "Project: workspace for one product idea.",
        "PRD: product requirements document.",
        "Ubiquitous Language: shared domain vocabulary.",
        "Design System: typography, color, spacing, components, and interaction rules.",
      ].join("\n"),
    };

    logDesignSystem("step 1/6 loaded PRD + UL", {
      prdChars: context.prd.length,
      ubiquitousLanguageChars: context.ubiquitousLanguage.length,
    });

    return {
      projectId: inputData.projectId,
      context,
    };
  },
});

const generateDesignSystemTextStep = createStep({
  id: "generateDesignSystemText",
  inputSchema: ContextEnvelopeSchema,
  outputSchema: DesignTextEnvelopeSchema,
  execute: async ({ inputData }) => {
    logDesignSystem("step 2/6 generating design-system text", {
      model: env.OPENAI_MODEL,
    });

    const agent = new Agent({
      id: "design-system-text-agent",
      name: "Design System Text Agent",
      model: openai(env.OPENAI_MODEL),
      instructions:
        "You are a senior product designer. Return concise design-system guidance in markdown.",
    });

    const result = await agent.generate(
      [
        "Create a small design system from this PRD and ubiquitous language.",
        "Include: design principles, colors, typography, spacing, components, interaction rules.",
        "Keep it compact enough to fit on one Penpot board.",
        "Do not include placeholder content.",
        "",
        "PRD:",
        inputData.context.prd,
        "",
        "Ubiquitous Language:",
        inputData.context.ubiquitousLanguage,
      ].join("\n"),
    );

    const designSystemText = result.text.trim();

    if (!designSystemText) {
      throw new Error("LLM returned empty design-system text");
    }

    logDesignSystem("step 2/6 generated design-system text", {
      chars: designSystemText.length,
    });

    return {
      ...inputData,
      designSystemText,
    };
  },
});

const generatePenpotBoardPlanStep = createStep({
  id: "generatePenpotBoardPlan",
  inputSchema: DesignTextEnvelopeSchema,
  outputSchema: BoardPlanEnvelopeSchema,
  execute: async ({ inputData }) => {
    logDesignSystem("step 3/6 generating Penpot board plan", {
      model: env.OPENAI_MODEL,
    });

    const agent = new Agent({
      id: "design-system-board-plan-agent",
      name: "Design System Board Plan Agent",
      model: openai(env.OPENAI_MODEL),
      instructions: [
        "You are a senior product designer planning a Penpot design-system reference board.",
        "Use the markdown design system as the sole source of truth.",
        "Choose representative, readable board content. Do not invent tokens or components not supported by the markdown.",
        "Prioritize header, color, typography, spacing, and core components.",
      ].join("\n"),
    });

    const result = await agent.generate(
      [
        "Plan one Penpot board from this markdown design system.",
        "Make the board concise, visual, and scannable.",
        "Prefer representative specimens over exhaustive dumps.",
        "Include enough items for the renderer to create a useful board.",
        "",
        "Markdown design system:",
        inputData.designSystemText,
      ].join("\n"),
      {
        structuredOutput: {
          schema: PenpotBoardPlanSchema,
        },
      },
    );

    const penpotBoardPlan = PenpotBoardPlanSchema.parse(result.object);

    logDesignSystem("step 3/6 generated Penpot board plan", {
      title: penpotBoardPlan.title,
      sections: penpotBoardPlan.sections.length,
      items: penpotBoardPlan.sections.reduce(
        (total, section) => total + section.items.length,
        0,
      ),
    });

    return {
      ...inputData,
      penpotBoardPlan,
    };
  },
});

const createPenpotBoard = createStep({
  id: "createPenpotBoard",
  inputSchema: BoardPlanEnvelopeSchema,
  outputSchema: PenpotEnvelopeSchema,
  execute: async ({ inputData }) => {
    logDesignSystem("step 4/6 creating Penpot board");
    const penpot = await createDesignSystemBoardInPenpot({
      boardPlan: inputData.penpotBoardPlan,
    });
    logDesignSystem("step 4/6 created Penpot board", {
      fileId: penpot.fileId,
      boardId: penpot.boardId,
      boardName: penpot.boardName,
    });

    return {
      ...inputData,
      penpot,
    };
  },
});

const exportPenpotPreview = createStep({
  id: "exportPenpotPreview",
  inputSchema: PenpotEnvelopeSchema,
  outputSchema: PreviewEnvelopeSchema,
  execute: async ({ inputData }) => {
    logDesignSystem("step 5/6 exporting Penpot preview", {
      boardId: inputData.penpot.boardId,
    });

    const preview = await exportPenpotBoardPreview({
      boardId: inputData.penpot.boardId,
    });

    logDesignSystem("step 5/6 exported Penpot preview", {
      mimeType: preview.mimeType,
      hasImageUrl: Boolean(preview.imageUrl),
      hasImageBase64: Boolean(preview.imageBase64),
    });

    return {
      ...inputData,
      preview,
    };
  },
});

const returnResult = createStep({
  id: "returnResult",
  inputSchema: PreviewEnvelopeSchema,
  outputSchema: GenerateDesignSystemResultSchema,
  execute: async ({ inputData }) => {
    logDesignSystem("step 6/6 returning result");

    return {
      designSystemText: inputData.designSystemText,
      penpotBoardPlan: inputData.penpotBoardPlan,
      penpot: inputData.penpot,
      preview: inputData.preview,
    };
  },
});

export const designSystemWorkflow = createWorkflow({
  id: "designSystemWorkflow",
  inputSchema: GenerateDesignSystemInputSchema,
  outputSchema: GenerateDesignSystemResultSchema,
})
  .then(loadContext)
  .then(generateDesignSystemTextStep)
  .then(generatePenpotBoardPlanStep)
  .then(createPenpotBoard)
  .then(exportPenpotPreview)
  .then(returnResult)
  .commit();

export const mastra = new Mastra({
  logger: false,
  workflows: {
    designSystemWorkflow,
  },
});

export async function runDesignSystemWorkflow(
  input: GenerateDesignSystemInput,
): Promise<GenerateDesignSystemResult> {
  logDesignSystem("workflow start", { projectId: input.projectId });
  const workflow = mastra.getWorkflow("designSystemWorkflow");
  const run = await workflow.createRun();
  logDesignSystem("workflow run created", { runId: run.runId });
  const result = await run.start({ inputData: input });
  logDesignSystem("workflow finished", { status: result.status, runId: run.runId });

  if (result.status !== "success") {
    throw new Error(`designSystemWorkflow ${result.status}`);
  }

  return GenerateDesignSystemResultSchema.parse(result.result);
}
