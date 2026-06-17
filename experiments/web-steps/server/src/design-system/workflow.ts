import { Mastra } from "@mastra/core/mastra";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { generatePenpotBoardPlan } from "./board-plan.js";
import { loadProjectContext } from "./context.js";
import { generateDesignSystemText } from "./generator.js";
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
    const context = await loadProjectContext(inputData);
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
    logDesignSystem("step 2/6 generating design-system text");
    const designSystemText = await generateDesignSystemText(inputData.context);
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
    logDesignSystem("step 3/6 generating Penpot board plan");
    const penpotBoardPlan = await generatePenpotBoardPlan({
      designSystemText: inputData.designSystemText,
    });
    logDesignSystem("step 3/6 generated Penpot board plan", {
      title: penpotBoardPlan.title,
      sections: penpotBoardPlan.sections.length,
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
