import { Mastra } from "@mastra/core/mastra";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { runPenpotSimpleExport } from "./flue.js";
import { DEMO_DESIGN_SYSTEM_TEXT, DEMO_PROJECT_ID } from "./demo.js";
import { logDesignSystem } from "./log.js";
import {
  GenerateDesignSystemInputSchema,
  GenerateDesignSystemResultSchema,
  PenpotBoardInfoSchema,
  PreviewSchema,
  ProjectContextSchema,
  type GenerateDesignSystemInput,
  type GenerateDesignSystemResult,
} from "./types.js";

const ContextEnvelopeSchema = z.object({
  projectId: z.string(),
  context: ProjectContextSchema,
});

const DesignTextEnvelopeSchema = ContextEnvelopeSchema.extend({
  designSystemText: z.string(),
});

const PenpotEnvelopeSchema = DesignTextEnvelopeSchema.extend({
  penpot: PenpotBoardInfoSchema,
});

const PreviewEnvelopeSchema = PenpotEnvelopeSchema.extend({
  preview: PreviewSchema.optional(),
});

const loadContext = createStep({
  id: "loadContext",
  inputSchema: GenerateDesignSystemInputSchema,
  outputSchema: ContextEnvelopeSchema,
  execute: async ({ inputData }) => {
    logDesignSystem("step 1/4 loading PRD + UL", {
      projectId: inputData.projectId,
    });

    if (inputData.projectId !== DEMO_PROJECT_ID) {
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

    logDesignSystem("step 1/4 loaded PRD + UL", {
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
    logDesignSystem("step 2/4 using existing design-system text");

    const designSystemText = DEMO_DESIGN_SYSTEM_TEXT;

    logDesignSystem("step 2/4 loaded existing design-system text", {
      chars: designSystemText.length,
    });

    return {
      ...inputData,
      designSystemText,
    };
  },
});

const createPenpotBoard = createStep({
  id: "createPenpotBoard",
  inputSchema: DesignTextEnvelopeSchema,
  outputSchema: PreviewEnvelopeSchema,
  execute: async ({ inputData }) => {
    logDesignSystem("step 3/4 invoking Flue penpot-simple", {
      chars: inputData.designSystemText.length,
    });

    const result = await runPenpotSimpleExport({
      designSystemText: inputData.designSystemText,
    });

    logDesignSystem("step 3/4 Flue penpot-simple completed", {
      boardId: result.artboard_id,
      boardName: result.artboard_name,
      hasImageUrl: Boolean(result.image.imageUrl),
      imageChars: result.image.base64.length,
    });

    return {
      ...inputData,
      penpot: {
        fileId: "unknown",
        boardId: result.artboard_id,
        boardName: result.artboard_name,
      },
      preview: {
        imageBase64: result.image.base64,
        imageUrl: result.image.imageUrl,
        mimeType: result.image.mimeType,
      },
    };
  },
});

const returnResult = createStep({
  id: "returnResult",
  inputSchema: PreviewEnvelopeSchema,
  outputSchema: GenerateDesignSystemResultSchema,
  execute: async ({ inputData }) => {
    logDesignSystem("step 4/4 returning result");

    return {
      designSystemText: inputData.designSystemText,
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
  .then(createPenpotBoard)
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
