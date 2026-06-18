import {
  connectMcpServer,
  createAgent,
  type FlueContext,
  type WorkflowRouteHandler,
} from "@flue/runtime";
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
  "You create simple Penpot boards and export images.",
  "Use the Penpot MCP tools only against the already-open document.",
  "Useful tools:",
  "- mcp__penpot__execute_code for Penpot Plugin API work.",
  "- mcp__penpot__export_shape for PNG export.",
  "Inside execute_code, use penpot.createBoard(), penpot.createRectangle(), and penpot.createText(text).",
  "Do not use penpot.createShape. It does not exist.",
  "After creating the artboard, always export the artboard with mcp__penpot__export_shape using format png and mode shape.",
].join("\n");

function buildPrompt(input: { designSystemText: string }) {
  return [
    "Inspect the already-open Penpot document first.",
    "If an artboard named `Design System Color Swatches` already exists, do not create a new one.",
    "When an existing artboard is found, return that artboard's real id and name, then export that artboard.",
    "Only create one simple Penpot artboard named `Design System Color Swatches` if no matching artboard exists.",
    "Do not open or create another Penpot document.",
    "Use the design-system tokens below as the only color source when creating a new artboard.",
    "Layout: clean white/neutral artboard, title, short subtitle, grid of swatches.",
    "Each swatch must show token name, hex value, and short usage note when present.",
    "Use readable text and enough spacing. Keep it simple.",
    "When finished or when reusing an existing artboard, get the real artboard id and name from Penpot.",
    "Then call mcp__penpot__export_shape with:",
    "- shapeId: real artboard id",
    "- format: png",
    "- mode: shape",
    "Final answer must include artboard id, artboard name, and a short note only.",
    "Do not include image data in final answer. The MCP adapter only exposes image placeholders to you.",
    "Do not skip export.",
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


    log.info("penpot-simple completed", {
      artboardId: response.data.artboard_id,
      artboardName: response.data.artboard_name,
      tokens: response.usage.totalTokens,
      cost: response.usage.cost.total,
    });
    console.info("penpot-simple completed", {
      artboardId: response.data.artboard_id,
      artboardName: response.data.artboard_name,
      tokens: response.usage.totalTokens,
      cost: response.usage.cost.total,
    });

    return response.data
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
