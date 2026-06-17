import { createOpenAI } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { MCPClient } from "@mastra/mcp";
import { env } from "../../env.js";
import { logDesignSystem } from "./log.js";
import {
  PenpotBoardInfoSchema,
  PenpotBoardPlanSchema,
  type PenpotBoardInfo,
  type PenpotBoardPlan,
  type Preview,
} from "./types.js";

type Toolsets = Record<string, Record<string, PenpotTool | undefined> | undefined>;

type PenpotTool = {
  execute?: (input: Record<string, unknown>, context?: unknown) => Promise<unknown>;
};

type BoardVerification = PenpotBoardInfo & {
  contentShapeCount: number;
  textShapeCount: number;
};

const MIN_TEXT_SHAPES = 8;

const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export async function createDesignSystemBoardInPenpot(input: {
  boardPlan: PenpotBoardPlan;
}): Promise<PenpotBoardInfo> {
  const boardPlan = PenpotBoardPlanSchema.parse(input.boardPlan);

  logDesignSystem("Penpot render start: create board", {
    title: boardPlan.title,
    sections: boardPlan.sections.length,
  });

  const penpotMcpClient = createPenpotMcpClient();

  try {
    const toolsets = await loadPenpotToolsets(penpotMcpClient);
    const output = await callPenpotTool(toolsets, "execute_code", {
      code: buildRenderBoardScript(boardPlan),
    });

    const boardResult = parseBoardVerification(extractExecuteCodeResult(output));

    if (boardResult.textShapeCount < MIN_TEXT_SHAPES) {
      throw new Error(
        `Invalid Penpot board: expected at least ${MIN_TEXT_SHAPES} text shapes, got ${boardResult.textShapeCount}`,
      );
    }

    const boardInfo = PenpotBoardInfoSchema.parse(boardResult);

    logDesignSystem("Penpot render finished: create board", {
      fileId: boardInfo.fileId,
      boardId: boardInfo.boardId,
      boardName: boardInfo.boardName,
      contentShapeCount: boardResult.contentShapeCount,
      textShapeCount: boardResult.textShapeCount,
    });

    return boardInfo;
  } finally {
    await penpotMcpClient.disconnect();
  }
}

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

async function callPenpotTool(
  toolsets: Toolsets,
  toolName: "execute_code" | "export_shape",
  input: Record<string, unknown>,
): Promise<unknown> {
  const tool = toolsets.penpot?.[toolName];

  if (!tool?.execute) {
    throw new Error(`Penpot ${toolName} tool unavailable`);
  }

  logDesignSystem("MCP direct tool call", {
    toolName,
    input: summarizeToolInput(input),
  });

  try {
    const output = await tool.execute(input);

    logDesignSystem("MCP direct tool result", {
      toolName,
      output: summarizeToolOutput(output),
    });

    throwIfToolReturnedFailure(output);

    return output;
  } catch (error) {
    logDesignSystem("MCP direct tool error", {
      toolName,
      error: getErrorMessage(error),
    });
    throw error;
  }
}

function buildRenderBoardScript(boardPlan: PenpotBoardPlan) {
  return `
const boardPlan = ${JSON.stringify(boardPlan)};
const COLORS = {
  canvas: "#F9FAFB",
  surface: "#FFFFFF",
  ink900: "#111827",
  ink700: "#374151",
  ink500: "#6B7280",
  ink200: "#E5E7EB",
  ink100: "#F3F4F6",
  blue600: "#2563EB",
  blue50: "#EFF6FF"
};

function cleanText(value) {
  return String(value || "").trim();
}

function safeText(parent, text, x, y, width, options) {
  const opts = options || {};
  const value = cleanText(text);

  if (!value) {
    throw new Error("safeText received empty text");
  }

  const node = penpot.createText(value);

  if (!node) {
    throw new Error("penpot.createText failed: " + value.slice(0, 80));
  }

  node.name = opts.name || "Text";
  parent.appendChild(node);
  penpotUtils.setParentXY(node, x, y);
  node.growType = "auto-height";
  node.resize(width, opts.height || 28);
  node.fontSize = opts.fontSize || 14;
  node.fills = [{ fillColor: opts.color || COLORS.ink700, fillOpacity: 1 }];

  return node;
}

function rect(parent, name, x, y, width, height, fill, stroke, radius) {
  const node = penpot.createRectangle();
  node.name = name;
  node.resize(width, height);
  node.fills = fill ? [{ fillColor: fill, fillOpacity: 1 }] : [];
  node.strokes = stroke
    ? [{ strokeColor: stroke, strokeStyle: "solid", strokeWidth: 1, strokeAlignment: "center" }]
    : [];
  node.borderRadius = radius === undefined ? 8 : radius;
  parent.appendChild(node);
  penpotUtils.setParentXY(node, x, y);
  return node;
}

function removeOldBoards() {
  const oldBoards = penpotUtils.findShapes(
    function (shape) { return shape.name === "Design System" && shape.parent === penpot.root; },
    penpot.root,
  );

  for (const oldBoard of oldBoards) {
    oldBoard.remove();
  }
}

function colorFromItem(item) {
  const candidates = [item.color, item.value, item.description, item.usage, item.name];

  for (const candidate of candidates) {
    const match = String(candidate || "").match(/#[0-9A-Fa-f]{6}/);

    if (match) {
      return match[0].toUpperCase();
    }
  }

  return undefined;
}

function itemSummary(item) {
  return cleanText(item.usage || item.description || item.value || "");
}

function itemMeta(item) {
  const parts = [];

  if (item.value) parts.push(item.value);
  if (item.weight) parts.push(item.weight);
  if (item.size) parts.push(String(item.size));
  if (item.lineHeight) parts.push("/ " + String(item.lineHeight));
  if (item.variants && item.variants.length) parts.push("Variants: " + item.variants.join(", "));
  if (item.states && item.states.length) parts.push("States: " + item.states.join(", "));

  return parts.join(" · ");
}

function sectionHeight(section) {
  const itemCount = Math.max(1, section.items.length);

  if (section.kind === "color") return 96 + Math.ceil(itemCount / 2) * 72;
  if (section.kind === "typography") return 96 + itemCount * 58;
  if (section.kind === "spacing") return 96 + itemCount * 46;

  return 110 + itemCount * 52;
}

function drawSection(board, section, x, y, width) {
  const height = sectionHeight(section);
  rect(board, "Section " + section.title, x, y, width, height, COLORS.surface, COLORS.ink200, 12);
  safeText(board, section.title, x + 24, y + 22, width - 48, {
    fontSize: 20,
    color: COLORS.ink900,
    name: "Section heading"
  });

  if (section.description) {
    safeText(board, section.description, x + 24, y + 54, width - 48, {
      fontSize: 13,
      color: COLORS.ink500,
      name: "Section description",
      height: 24
    });
  }

  if (section.kind === "color") {
    drawColorItems(board, section.items, x + 24, y + 92, width - 48);
  } else if (section.kind === "typography") {
    drawTypographyItems(board, section.items, x + 24, y + 88, width - 48);
  } else if (section.kind === "spacing") {
    drawSpacingItems(board, section.items, x + 24, y + 88, width - 48);
  } else {
    drawTextItems(board, section.items, x + 24, y + 88, width - 48);
  }

  return height;
}

function drawColorItems(board, items, x, y, width) {
  const colWidth = Math.floor((width - 20) / 2);

  items.forEach(function (item, index) {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const itemX = x + col * (colWidth + 20);
    const itemY = y + row * 72;
    const color = colorFromItem(item) || COLORS.ink100;

    rect(board, "Color swatch " + item.name, itemX, itemY, 56, 44, color, COLORS.ink200, 8);
    safeText(board, item.name, itemX + 68, itemY, colWidth - 76, {
      fontSize: 13,
      color: COLORS.ink900,
      name: "Color name",
      height: 22
    });
    safeText(board, color, itemX + 68, itemY + 24, colWidth - 76, {
      fontSize: 12,
      color: COLORS.ink500,
      name: "Color value",
      height: 20
    });
  });
}

function drawTypographyItems(board, items, x, y, width) {
  items.forEach(function (item, index) {
    const itemY = y + index * 58;
    const size = Math.max(12, Math.min(30, Number(item.size || 16)));
    const meta = itemMeta(item);

    safeText(board, item.name, x, itemY, 170, {
      fontSize: 13,
      color: COLORS.ink500,
      name: "Typography name",
      height: 24
    });
    safeText(board, meta || "Type specimen", x + 190, itemY - 4, width - 190, {
      fontSize: size,
      color: COLORS.ink900,
      name: "Typography specimen",
      height: 42
    });
  });
}

function drawSpacingItems(board, items, x, y, width) {
  items.forEach(function (item, index) {
    const itemY = y + index * 46;
    const rawValue = String(item.value || item.name || "8");
    const match = rawValue.match(/\\d+/);
    const amount = Math.max(4, Math.min(80, Number(match ? match[0] : 8)));

    safeText(board, item.name, x, itemY, 150, {
      fontSize: 13,
      color: COLORS.ink700,
      name: "Spacing name",
      height: 22
    });
    rect(board, "Spacing specimen " + item.name, x + 170, itemY + 4, amount, 18, COLORS.blue600, null, 3);
    safeText(board, itemSummary(item) || String(amount), x + 270, itemY, width - 270, {
      fontSize: 12,
      color: COLORS.ink500,
      name: "Spacing usage",
      height: 22
    });
  });
}

function drawTextItems(board, items, x, y, width) {
  items.forEach(function (item, index) {
    const itemY = y + index * 52;
    const meta = itemMeta(item);
    const summary = itemSummary(item);

    rect(board, "Item marker " + item.name, x, itemY + 4, 8, 8, COLORS.blue600, null, 4);
    safeText(board, item.name, x + 20, itemY, width - 20, {
      fontSize: 14,
      color: COLORS.ink900,
      name: "Item name",
      height: 22
    });

    if (summary || meta) {
      safeText(board, summary || meta, x + 20, itemY + 24, width - 20, {
        fontSize: 12,
        color: COLORS.ink500,
        name: "Item summary",
        height: 22
      });
    }
  });
}

removeOldBoards();

const board = penpot.createBoard();
board.name = "Design System";
board.x = 0;
board.y = 0;
board.resize(1200, 1200);
board.fills = [{ fillColor: COLORS.canvas, fillOpacity: 1 }];

rect(board, "Header", 32, 32, 1136, 136, COLORS.surface, COLORS.ink200, 14);
safeText(board, boardPlan.title, 56, 54, 760, {
  fontSize: 32,
  color: COLORS.ink900,
  name: "Board title",
  height: 46
});
safeText(board, boardPlan.summary, 56, 108, 860, {
  fontSize: 15,
  color: COLORS.ink500,
  name: "Board summary",
  height: 40
});
rect(board, "Accent sample", 980, 78, 120, 44, COLORS.blue600, null, 8);
safeText(board, "Primary", 1014, 91, 80, {
  fontSize: 14,
  color: "#FFFFFF",
  name: "Accent label",
  height: 22
});

const columns = [32, 612];
const columnY = [200, 200];
const cardWidth = 556;

boardPlan.sections.forEach(function (section, index) {
  const column = columnY[0] <= columnY[1] ? 0 : 1;
  const x = columns[column];
  const y = columnY[column];
  const height = drawSection(board, section, x, y, cardWidth);
  columnY[column] += height + 24;
});

const finalHeight = Math.max(columnY[0], columnY[1]) + 32;
board.resize(1200, finalHeight);

const descendants = penpotUtils.findShapes(function () { return true; }, board);
const visible = descendants.filter(function (shape) { return shape.visible !== false; });
const texts = visible.filter(function (shape) { return shape.type === "text"; });

return {
  fileId: "unknown",
  boardId: board.id,
  boardName: board.name,
  boardUrl: "",
  contentShapeCount: visible.length,
  textShapeCount: texts.length,
};
`.trim();
}

function extractExecuteCodeResult(output: unknown): unknown {
  const text = extractFirstTextPart(output);

  if (!text) {
    throw new Error("Penpot execute_code returned no text output");
  }

  if (text.includes("Tool execution failed")) {
    throw new Error(text);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (_error) {
    throw new Error(
      `Penpot execute_code returned non-JSON text: ${text.slice(0, 500)}`,
    );
  }

  if (isObject(parsed) && "result" in parsed) {
    return parsed.result;
  }

  return parsed;
}

function parseBoardVerification(value: unknown): BoardVerification {
  if (!isObject(value)) {
    throw new Error("Penpot board verification returned invalid result");
  }

  const board = PenpotBoardInfoSchema.parse(value);
  const rawContentShapeCount = value.contentShapeCount;
  const rawTextShapeCount = value.textShapeCount;

  if (!Number.isInteger(rawContentShapeCount) || Number(rawContentShapeCount) < 1) {
    throw new Error("Penpot board verification returned invalid contentShapeCount");
  }

  if (!Number.isInteger(rawTextShapeCount) || Number(rawTextShapeCount) < 1) {
    throw new Error("Penpot board verification returned invalid textShapeCount");
  }

  return {
    ...board,
    contentShapeCount: Number(rawContentShapeCount),
    textShapeCount: Number(rawTextShapeCount),
  };
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

function summarizeToolInput(input: unknown) {
  if (isObject(input) && typeof input.code === "string") {
    return { ...input, code: `[${input.code.length} chars]` };
  }

  return input;
}

function summarizeToolOutput(output: unknown) {
  if (
    !isObject(output) ||
    !("content" in output) ||
    !Array.isArray(output.content)
  ) {
    return output;
  }

  return {
    content: output.content.map((part) => {
      if (!isObject(part)) {
        return part;
      }

      if (part.type === "image" && typeof part.data === "string") {
        return { ...part, data: `[base64 ${part.data.length} chars]` };
      }

      if (part.type === "resource" && isObject(part.resource)) {
        const resource = part.resource;

        if (typeof resource.blob === "string") {
          return {
            ...part,
            resource: {
              ...resource,
              blob: `[base64 ${resource.blob.length} chars]`,
            },
          };
        }
      }

      return part;
    }),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
