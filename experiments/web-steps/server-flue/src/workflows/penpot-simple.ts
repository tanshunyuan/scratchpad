import {
  connectMcpServer,
  createAgent,
  defineAgentProfile,
  type FlueContext,
  type ToolDefinition,
  type WorkflowRouteHandler,
} from "@flue/runtime";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import * as v from "valibot";

export const route: WorkflowRouteHandler = async (_c, next) => next();

export const description =
  "Creates or reuses a simple Penpot artboard with design-system color swatches and exports it as PNG.";

const ARTBOARD_NAME = "Design System Color Swatches";

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

const coordinator = createAgent(() => ({
  model: "openai/gpt-5.4-mini",
  thinkingLevel: "medium",
}));

function createPenpotChecker(tools: ToolDefinition[]) {
  return defineAgentProfile({
    name: "penpot_checker",
    description:
      "Inspects the already-open Penpot document for an existing artboard.",
    instructions: [
      "You inspect Penpot documents.",
      "Use the Penpot MCP tools only against the already-open document.",
      "Useful tools:",
      "- mcp__penpot__execute_code for Penpot Plugin API work.",
      "Inspect only. Do not create, edit, delete, or export anything.",
      "Return whether the requested artboard exists, plus its real id and name when found.",
    ].join("\n"),
    tools,
  });
}

function createPenpotBuilder(tools: ToolDefinition[]) {
  return defineAgentProfile({
    name: "penpot_builder",
    description:
      "Creates the requested artboard in the already-open Penpot document.",
    instructions: [
      "You create simple Penpot boards.",
      "Use the Penpot MCP tools only against the already-open document.",
      "Useful tools:",
      "- mcp__penpot__execute_code for Penpot Plugin API work.",
      "Inside execute_code, use penpot.createBoard(), penpot.createRectangle(), and penpot.createText(text).",
      "Do not use penpot.createShape. It does not exist.",
      "Do not export images. Workflow code exports the final board after you return its id.",
    ].join("\n"),
    tools,
  });
}

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

  console.log("client ==> ", client);

  try {
    const result = await client.callTool({
      name: "export_shape",
      arguments: {
        shapeId: input.shapeId,
        format: "png",
        mode: "shape",
      },
    });
    console.log("result ==> ", result);

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
        throw new Error(
          `Expected PNG export, got ${String(resource.mimeType)}`,
        );
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
    artboardName: ARTBOARD_NAME,
    hasCustomDesignSystemText: Boolean(payload.designSystemText),
    designSystemTextChars: designSystemText.length,
  });

  console.info("penpot-simple started", {
    artboardName: ARTBOARD_NAME,
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
    const harness = await init(coordinator, {
      subagents: [
        createPenpotChecker(penpot.tools),
        createPenpotBuilder(penpot.tools),
      ],
    });
    const session = await harness.session();

    log.info("checking Penpot artboard", { artboardName: ARTBOARD_NAME });
    console.info("checking Penpot artboard", { artboardName: ARTBOARD_NAME });

    const check = await session.task(
      [
        "Inspect the already-open Penpot document.",
        `Find an artboard named exactly \`${ARTBOARD_NAME}\`.`,
        "Do not create, edit, delete, or export anything.",
        "If found, return exists=true with the real artboard id and name from Penpot.",
        "If not found, return exists=false and explain briefly in note.",
      ].join("\n"),
      {
        agent: "penpot_checker",
        result: v.object({
          exists: v.boolean(),
          artboard_id: v.optional(v.string()),
          artboard_name: v.optional(v.string()),
          note: v.string(),
        }),
      },
    );

    let artboard = check.data.exists
      ? {
          artboard_id: check.data.artboard_id,
          artboard_name: check.data.artboard_name,
          note: check.data.note,
          reused: true,
        }
      : undefined;

    if (artboard) {
      if (!artboard.artboard_id || !artboard.artboard_name) {
        throw new Error("Penpot checker found artboard without id or name");
      }

      log.info("reusing Penpot artboard", {
        artboardId: artboard.artboard_id,
        artboardName: artboard.artboard_name,
      });
      console.info("reusing Penpot artboard", {
        artboardId: artboard.artboard_id,
        artboardName: artboard.artboard_name,
      });
    } else {
      log.info("creating Penpot artboard", { artboardName: ARTBOARD_NAME });
      console.info("creating Penpot artboard", { artboardName: ARTBOARD_NAME });

      const built = await session.task(
        [
          "Create one simple Penpot artboard in the already-open document.",
          `Artboard name: \`${ARTBOARD_NAME}\`.`,
          "Before creating, do one final inspection. If the artboard already exists, reuse it and return its real id/name.",
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
          designSystemText,
        ].join("\n"),
        {
          agent: "penpot_builder",
          result: v.object({
            artboard_id: v.string(),
            artboard_name: v.string(),
            note: v.string(),
          }),
        },
      );

      artboard = {
        ...built.data,
        reused: false,
      };
    }

    log.info("exporting Penpot PNG", {
      artboardId: artboard.artboard_id,
      reused: artboard.reused,
    });
    console.info("exporting Penpot PNG", {
      artboardId: artboard.artboard_id,
      reused: artboard.reused,
    });

    const image = await exportShapeAsPng({
      mcpUrl: env.PENPOT_MCP_URL,
      shapeId: artboard.artboard_id,
    });

    const result = {
      ...artboard,
      image,
    };

    log.info("penpot-simple completed", {
      artboardId: result.artboard_id,
      artboardName: result.artboard_name,
      reused: result.reused,
      imageChars: result.image.base64.length,
    });
    console.info("penpot-simple completed", {
      artboardId: result.artboard_id,
      artboardName: result.artboard_name,
      reused: result.reused,
      imageChars: result.image.base64.length,
    });

    return result;
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
