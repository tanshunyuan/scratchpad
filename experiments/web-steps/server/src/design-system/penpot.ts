import { createOpenAI } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { MCPClient } from "@mastra/mcp";
import { env } from "../../env.js";
import { logDesignSystem } from "./log.js";
import type { Preview } from "./types.js";

type Toolsets = Record<string, Record<string, PenpotTool | undefined> | undefined>;

type PenpotTool = {
  execute?: (input: Record<string, unknown>, context?: unknown) => Promise<unknown>;
};

const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export async function exportPenpotBoardPreview(input: {
  boardId: string;
}): Promise<Preview> {
  logDesignSystem("Penpot render start: export preview", {
    boardId: input.boardId,
  });

  const penpotMcpClient = createPenpotMcpClient();

  try {
    const toolsets = await loadPenpotToolsets(penpotMcpClient);
    const preview = await exportPenpotBoardPreviewWithLlm(
      toolsets,
      input.boardId,
    );

    logDesignSystem("Penpot render finished: export preview", {
      mimeType: preview.mimeType,
    });

    return preview;
  } finally {
    await penpotMcpClient.disconnect();
  }
}

function createPenpotMcpClient() {
  return new MCPClient({
    id: "penpot-design-system-mcp-client",
    servers: {
      penpot: {
        url: new URL(env.PENPOT_MCP_URL),
        timeout: 120_000,
      },
    },
  });
}

async function loadPenpotToolsets(penpotMcpClient: MCPClient): Promise<Toolsets> {
  logDesignSystem("MCP loading Penpot tools");

  const toolsets = (await penpotMcpClient.listToolsets()) as Toolsets;
  const penpotTools = toolsets.penpot;

  logDesignSystem("MCP loaded Penpot tools", {
    tools: penpotTools ? Object.keys(penpotTools) : [],
  });

  return toolsets;
}

async function exportPenpotBoardPreviewWithLlm(
  toolsets: Toolsets,
  boardId: string,
): Promise<Preview> {
  logDesignSystem("LLM preview-export agent start", {
    model: env.OPENAI_MODEL,
    boardId,
  });

  const agent = new Agent({
    id: "design-system-preview-export-agent",
    name: "Design System Preview Export Agent",
    model: openai(env.OPENAI_MODEL),
    instructions: [
      "You export a Penpot board preview as PNG.",
      "Use the Penpot tools. Prefer export_shape with the provided board id, format png, mode shape.",
      "If that fails, inspect or select the board with execute_code, then try export_shape with selection or page.",
      "Do not describe the image. Return only a short success/failure note after tool calls.",
    ].join("\n"),
  });

  const result = await agent.generate(
    [
      "Export this Penpot board preview as PNG.",
      `Board id: ${boardId}`,
      "Required output: PNG image data from export_shape.",
    ].join("\n"),
    {
      toolsets: toolsets as never,
      maxSteps: 6,
    },
  );

  const preview = extractPreviewFromLlmToolResults(result);

  logDesignSystem("LLM preview-export agent finished", {
    textChars: result.text.length,
    toolResults: result.toolResults.length,
    mimeType: preview.mimeType,
  });

  return preview;
}

function throwIfToolReturnedFailure(output: unknown) {
  const text = extractFirstTextPart(output);

  if (text?.includes("Tool execution failed")) {
    throw new Error(text);
  }
}

function extractFirstTextPart(output: unknown): string | undefined {
  if (!isObject(output) || !Array.isArray(output.content)) {
    return undefined;
  }

  for (const part of output.content) {
    if (isObject(part) && part.type === "text" && typeof part.text === "string") {
      return part.text;
    }
  }

  return undefined;
}

function extractPreviewFromLlmToolResults(result: unknown): Preview {
  if (!isObject(result) || !Array.isArray(result.toolResults)) {
    throw new Error("LLM preview-export agent returned no tool results");
  }

  const exportResults = result.toolResults
    .map((toolResult) => ({
      name: getToolResultName(toolResult),
      output: getToolResultOutput(toolResult),
    }))
    .filter((toolResult) => toolResult.output !== undefined)
    .filter(
      (toolResult) =>
        !toolResult.name || toolResult.name.includes("export_shape"),
    )
    .reverse();

  let lastError: unknown;

  for (const toolResult of exportResults) {
    try {
      throwIfToolReturnedFailure(toolResult.output);
      return extractPngPreview(toolResult.output);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("LLM preview-export agent did not call export_shape");
}

function getToolResultName(value: unknown): string | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  if (typeof value.toolName === "string") {
    return value.toolName;
  }

  if (isObject(value.payload) && typeof value.payload.toolName === "string") {
    return value.payload.toolName;
  }

  return undefined;
}

function getToolResultOutput(value: unknown): unknown {
  if (!isObject(value)) {
    return undefined;
  }

  if ("result" in value) {
    return value.result;
  }

  if (isObject(value.payload) && "result" in value.payload) {
    return value.payload.result;
  }

  return undefined;
}

function extractPngPreview(result: unknown): Preview {
  if (
    !isObject(result) ||
    !("content" in result) ||
    !Array.isArray(result.content)
  ) {
    throw new Error("Penpot export returned invalid result");
  }

  for (const part of result.content) {
    if (!isObject(part)) {
      continue;
    }

    if (part.type === "image" && typeof part.data === "string") {
      const mimeType = part.mimeType;

      if (mimeType !== "image/png") {
        throw new Error(`Expected PNG preview, got ${String(mimeType)}`);
      }

      return {
        imageBase64: part.data,
        imageUrl: `data:${mimeType};base64,${part.data}`,
        mimeType,
      };
    }

    if (part.type === "resource" && isObject(part.resource)) {
      const mimeType = part.resource.mimeType;
      const blob = part.resource.blob;

      if (mimeType !== "image/png") {
        throw new Error(`Expected PNG preview, got ${String(mimeType)}`);
      }

      if (typeof blob === "string") {
        return {
          imageBase64: blob,
          imageUrl: `data:${mimeType};base64,${blob}`,
          mimeType,
        };
      }
    }
  }

  throw new Error("Penpot export did not include PNG image data");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
