import {
  connectMcpServer,
  createAgent,
  type FlueContext,
  type WorkflowRouteHandler,
} from "@flue/runtime";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import * as v from 'valibot'

export const route: WorkflowRouteHandler = async (_c, next) => next();

export const description =
  "Creates a simple Penpot artboard with design-system color swatches and exports it as PNG.";

const DESIGN_SYSTEM_COLORS = `# Web Steps color tokens

- --bg: #F7F8FA — page background
- --surface: #FFFFFF — cards and panels
- --surface-muted: #F1F3F5 — secondary areas
- --border: #D9DEE5 — borders
- --text: #17202A — primary text
- --text-muted: #5B6673 — secondary text
- --primary: #2F6FED — key actions and active states
- --primary-hover: #2459C7 — primary hover
- --primary-soft: #EAF1FF — focus rings and selected backgrounds
- --success: #1F9D68 — success feedback
- --warning: #C58A16 — warning feedback
- --danger: #C94A4A — destructive and error states
- --info: #3C7BEA — informational feedback`;

const PENPOT_AGENT_INSTRUCTIONS = [
  "You create simple Penpot boards.",
  "Use the Penpot MCP tools only against the already-open document.",
  "Useful tools:",
  "- mcp__penpot__execute_code for Penpot Plugin API work.",
  "Inside execute_code, use penpot.createBoard(), penpot.createRectangle(), and penpot.createText(text).",
  "Do not use penpot.createShape. It does not exist.",
  "Do not export images. Workflow code exports the final board after you return its id.",
].join("\n");

function buildPrompt(input: { designSystemText: string }) {
  return [
    "Inspect the already-open Penpot document first.",
    "If an artboard named `Design System Color Swatches` already exists, do not create a new one.",
    "When an existing artboard is found, return that artboard's real id and name.",
    "Only create one simple Penpot artboard named `Design System Color Swatches` if no matching artboard exists.",
    "Do not open or create another Penpot document.",
    "Use the design-system tokens below as the only color source when creating a new artboard.",
    "Layout: clean white/neutral artboard, title, short subtitle, grid of swatches.",
    "Each swatch must show token name, hex value, and short usage note when present.",
    "Use readable text and enough spacing. Keep it simple.",
    "When finished or when reusing an existing artboard, get the real artboard id and name from Penpot.",
    "Final answer must include artboard id, artboard name, and a short note only.",
    "Do not export. Workflow code exports PNG after your final answer.",
    "",
    "## Design system colors",
    input.designSystemText,
  ].join("\n");
}

const agent = createAgent(() => ({
  model: "openai/gpt-5.4-mini",
  thinkingLevel: "medium",
  instructions: PENPOT_AGENT_INSTRUCTIONS,
}));

type Env = {
  PENPOT_MCP_URL: string;
};

type Payload = {
  designSystemText?: string;
};

type PngImage = {
  mimeType: "image/png";
  base64: string;
  imageUrl: string;
};

async function exportShapeAsPng(input: {
  mcpUrl: string;
  shapeId: string;
}): Promise<PngImage> {
  const client = new Client({
    name: "web-steps-penpot-export",
    version: "1.0.0",
  });
  const transport = new StreamableHTTPClientTransport(new URL(input.mcpUrl));

  await client.connect(transport);

  try {
    const result = await client.callTool({
      name: "export_shape",
      arguments: {
        shapeId: input.shapeId,
        format: "png",
        mode: "shape",
      },
    });

    return extractPngImage(result);
  } finally {
    await client.close();
  }
}

function extractPngImage(result: unknown): PngImage {
  if (!isObject(result) || !Array.isArray(result.content)) {
    throw new Error("Penpot export returned invalid result");
  }

  for (const part of result.content) {
    if (!isObject(part)) {
      continue;
    }

    if (part.type === "image" && typeof part.data === "string") {
      if (part.mimeType !== "image/png") {
        throw new Error(`Expected PNG export, got ${String(part.mimeType)}`);
      }

      return buildPngImage(part.data);
    }

    if (part.type === "resource" && isObject(part.resource)) {
      const resource = part.resource;

      if (resource.mimeType !== "image/png") {
        throw new Error(`Expected PNG export, got ${String(resource.mimeType)}`);
      }

      if (typeof resource.blob === "string") {
        return buildPngImage(resource.blob);
      }
    }
  }

  throw new Error("Penpot export did not include PNG image data");
}

function buildPngImage(base64: string): PngImage {
  return {
    mimeType: "image/png",
    base64,
    imageUrl: `data:image/png;base64,${base64}`,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function run({
  init,
  payload,
  env,
  log,
}: FlueContext<Payload, Env>) {
  const designSystemText = payload.designSystemText ?? DESIGN_SYSTEM_COLORS;

  log.info("penpot-simple started", {
    hasCustomDesignSystemText: Boolean(payload.designSystemText),
    designSystemTextChars: designSystemText.length,
  });

  console.info("penpot-simple started", {
    hasCustomDesignSystemText: Boolean(payload.designSystemText),
    designSystemTextChars: designSystemText.length,
  });

  const penpot = await connectMcpServer("penpot", {
    url: env.PENPOT_MCP_URL,
    timeoutMs: 120_000,
  });

  log.info("penpot MCP connected", {
    tools: penpot.tools.map((tool) => tool.name),
  });

  console.info("penpot MCP connected", {
    tools: penpot.tools.map((tool) => tool.name),
  });

  try {
    const harness = await init(agent, { tools: penpot.tools });
    const session = await harness.session();

    log.info("prompting Penpot agent");
    console.info("prompting Penpot agent");

    const response = await session.prompt(
      buildPrompt({
        designSystemText,
      }), {
        result: v.object({
          artboard_id: v.string(),
          artboard_name: v.string(),
          note: v.string()
        })
      }
    );

    log.info("exporting Penpot PNG", {
      artboardId: response.data.artboard_id,
    });
    console.info("exporting Penpot PNG", {
      artboardId: response.data.artboard_id,
    });

    const image = await exportShapeAsPng({
      mcpUrl: env.PENPOT_MCP_URL,
      shapeId: response.data.artboard_id,
    });

    const result = {
      ...response.data,
      image,
    };

    log.info("penpot-simple completed", {
      artboardId: result.artboard_id,
      artboardName: result.artboard_name,
      imageChars: result.image.base64.length,
      tokens: response.usage.totalTokens,
      cost: response.usage.cost.total,
    });
    console.info("penpot-simple completed", {
      artboardId: result.artboard_id,
      artboardName: result.artboard_name,
      imageChars: result.image.base64.length,
      tokens: response.usage.totalTokens,
      cost: response.usage.cost.total,
    });

    return result
  } catch (error) {
    log.error("penpot-simple failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    console.error("penpot-simple failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  } finally {
    await penpot.close();
    log.info("penpot MCP closed");
    console.info("penpot MCP closed");
  }
}
