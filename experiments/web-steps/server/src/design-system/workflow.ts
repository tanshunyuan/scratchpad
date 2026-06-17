import { createOpenAI } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { MCPClient } from "@mastra/mcp";
import { z } from "zod";
import { env } from "../../env.js";
import { logDesignSystem } from "./log.js";
import { exportPenpotBoardPreview } from "./penpot.js";
import {
  GenerateDesignSystemInputSchema,
  GenerateDesignSystemResultSchema,
  PenpotBoardInfoSchema,
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

const PenpotEnvelopeSchema = DesignTextEnvelopeSchema.extend({
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
    logDesignSystem("step 1/5 loading PRD + UL", {
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

    logDesignSystem("step 1/5 loaded PRD + UL", {
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
    logDesignSystem("step 2/5 generating design-system text", {
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

    logDesignSystem("step 2/5 generated design-system text", {
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
  outputSchema: PenpotEnvelopeSchema,
  execute: async ({ inputData }) => {
    logDesignSystem("step 3/5 creating Penpot board", {
      model: env.OPENAI_MODEL,
      chars: inputData.designSystemText.length,
    });

    const penpotMcpClient = new MCPClient({
      id: "penpot-design-system-mcp-client",
      servers: {
        penpot: {
          url: new URL(env.PENPOT_MCP_URL),
          timeout: 120_000,
        },
      },
    });

    try {
      logDesignSystem("MCP loading Penpot tools");
      const toolsets = await penpotMcpClient.listToolsets();

      logDesignSystem("MCP loaded Penpot tools", {
        tools:
          "penpot" in toolsets && toolsets.penpot
            ? Object.keys(toolsets.penpot)
            : [],
      });

      const agent = new Agent({
        id: "design-system-penpot-agent",
        name: "Design System Penpot Agent",
        model: openai(env.OPENAI_MODEL),
        instructions: [
          "You create one Penpot board from a markdown design system.",
          "Use the Penpot tools to create the board directly.",
          "Use the markdown as the source of truth. Do not invent unsupported tokens.",
          "Make the board concise, visual, and scannable.",
          "Include design principles, colors, typography, spacing, components, and interaction rules when present.",
          "Return the created board info.",
        ].join("\n"),
      });

      const result = await agent.generate(
        [
          "Create one Penpot design-system board from this markdown.",
          "Return the created board info.",
          "",
          "Markdown design system:",
          inputData.designSystemText,
        ].join("\n"),
        {
          toolsets: toolsets as never,
          maxSteps: 12,
          structuredOutput: {
            schema: PenpotBoardInfoSchema,
          },
        },
      );

      const penpot = PenpotBoardInfoSchema.parse(result.object);

      logDesignSystem("step 3/5 created Penpot board", {
        fileId: penpot.fileId,
        boardId: penpot.boardId,
        boardName: penpot.boardName,
      });

      return {
        ...inputData,
        penpot,
      };
    } finally {
      await penpotMcpClient.disconnect();
    }
  },
});

const exportPenpotPreview = createStep({
  id: "exportPenpotPreview",
  inputSchema: PenpotEnvelopeSchema,
  outputSchema: PreviewEnvelopeSchema,
  execute: async ({ inputData }) => {
    logDesignSystem("step 4/5 exporting Penpot preview", {
      boardId: inputData.penpot.boardId,
    });

    const preview = await exportPenpotBoardPreview({
      boardId: inputData.penpot.boardId,
    });

    logDesignSystem("step 4/5 exported Penpot preview", {
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
    logDesignSystem("step 5/5 returning result");

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
