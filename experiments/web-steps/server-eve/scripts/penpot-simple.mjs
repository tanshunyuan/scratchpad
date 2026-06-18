import { Client } from "eve/client";

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

const resultSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    artboard_id: { type: "string" },
    artboard_name: { type: "string" },
    note: { type: "string" },
    image: {
      type: "object",
      additionalProperties: false,
      properties: {
        mimeType: { const: "image/png" },
        base64: { type: "string" },
        imageUrl: { type: "string" },
      },
      required: ["mimeType", "base64", "imageUrl"],
    },
  },
  required: ["artboard_id", "artboard_name", "note", "image"],
};

function buildPrompt(designSystemText) {
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
    "Then export that artboard as PNG using the Penpot `export_shape` tool with mode `shape` and format `png`.",
    "Final structured output must include artboard id, artboard name, short note, and PNG image data.",
    "For `image.base64`, copy the base64 string from the export result exactly.",
    "For `image.imageUrl`, return `data:image/png;base64,` followed by the exact base64 string.",
    "Do not invent or summarize image data.",
    "",
    "## Design system colors",
    designSystemText,
  ].join("\n");
}

const host = process.env.EVE_HOST ?? "http://127.0.0.1:3000";
const designSystemText = process.env.DESIGN_SYSTEM_TEXT ?? DESIGN_SYSTEM_COLORS;

const client = new Client({ host });
const session = client.session();

const response = await session.send({
  message: buildPrompt(designSystemText),
  outputSchema: resultSchema,
});

const result = await response.result();

if (result.status !== "completed") {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result.data, null, 2));
