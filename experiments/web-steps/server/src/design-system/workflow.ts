import { Mastra } from "@mastra/core/mastra";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { runPenpotSimpleExport } from "./flue.js";
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

    const designSystemText = `# Web Steps — Mini Design System

## 1) Design principles
- **Focused:** one primary action per screen.
- **Calm:** low-noise layouts, restrained color, clear hierarchy.
- **Practical:** every element supports task completion.
- **Trustworthy:** consistent patterns, explicit states, readable content.
- **Fast-feeling:** compact flows, immediate feedback, minimal friction.

---

## 2) Foundations

### Color
**Neutrals**
- \`--bg: #F7F8FA\` page background
- \`--surface: #FFFFFF\` cards, panels
- \`--surface-muted: #F1F3F5\` secondary areas
- \`--border: #D9DEE5\`
- \`--text: #17202A\`
- \`--text-muted: #5B6673\`

**Brand / Action**
- \`--primary: #2F6FED\`
- \`--primary-hover: #2459C7\`
- \`--primary-soft: #EAF1FF\`

**Status**
- \`--success: #1F9D68\`
- \`--warning: #C58A16\`
- \`--danger: #C94A4A\`
- \`--info: #3C7BEA\`

**Usage rules**
- Use primary blue only for key actions and active states.
- Prefer neutral surfaces; avoid large saturated areas.
- Status colors support feedback only, never as decoration.

### Typography
**Style**
- Sans-serif, modern, highly legible.

**Scale**
- **Display / Page title:** 28 / 36, semibold
- **H1 / Section title:** 22 / 30, semibold
- **H2 / Panel title:** 18 / 26, semibold
- **Body:** 14 / 22, regular
- **Body strong:** 14 / 22, medium
- **Meta / Label:** 12 / 18, medium
- **Code / structured term:** 13 / 20, medium

**Rules**
- Left-align all text.
- Limit to 3 weights: regular, medium, semibold.
- Use sentence case for UI labels and headings.

### Spacing
**Base unit: 8px**

**Scale**
- 4, 8, 12, 16, 24, 32, 40, 48

**Layout rules**
- Card padding: 16
- Section spacing: 24
- Page gutter: 24
- Form field gap: 12
- Inline icon gap: 8

### Radius & elevation
- **Radius:** 10 for cards/inputs/buttons, 16 for large panels
- **Border:** 1px \`--border\`
- **Shadow:** subtle only
  \`0 1px 2px rgba(16,24,40,.06), 0 4px 12px rgba(16,24,40,.06)\`

---

## 3) Core components

### Button
**Variants**
- **Primary:** filled \`--primary\`, white text
- **Secondary:** white background, border
- **Tertiary:** text-only, muted text
- **Destructive:** \`--danger\`

**Sizes**
- M: height 40, padding 0 14
- S: height 32, padding 0 10

**Rules**
- One primary button per area.
- Buttons use clear verbs: Create project, Save PRD, Generate artifacts.

### Input
Includes text field, textarea, select.
- Height: 40
- Background: \`--surface\`
- Border: \`--border\`
- Label above field, helper text below when needed
- Textarea min height: 96

**States**
- Default, hover, focus, error, disabled

### Card
Used for Project, PRD, Ubiquitous Language, Design System blocks.
- Surface background
- 16 padding
- Optional header, body, footer
- Use for grouping, not decoration

### Tabs
For switching between project artifacts.
- Active tab indicated by blue text + 2px underline
- Max 5 visible top-level tabs

### Stepper
For guided creation flow.
- Horizontal on desktop, vertical on narrow screens
- States: upcoming, current, complete
- Current step highlighted with primary color
- Completed step uses success accent minimally

### Tag
Used for domain terms and artifact labels.
- Small pill, muted background
- Types: neutral, info, success, warning

### List row
For project and artifact indexes.
- Min height 44
- Optional leading icon
- Hover highlights surface-muted
- Row click opens detail; trailing actions stay secondary

### Feedback message
Inline or banner.
- Info, success, warning, danger
- Include concise action-oriented copy

### Modal
Use only for confirmation or short creation tasks.
- Max width 560
- Primary action right-aligned
- Avoid multi-step flows inside modal

---

## 4) Interaction rules
- **Clarity first:** show next best action prominently.
- **Progressive disclosure:** reveal advanced options only when needed.
- **Immediate feedback:** save, generate, and validation states appear instantly.
- **Visible status:** draft, saved, generating, complete, error.
- **Safe actions:** destructive actions require confirmation.
- **Keyboard support:** visible focus ring on all interactive elements.
- **Empty states:** always direct toward creating a Project, PRD, or Ubiquitous Language entry.
- **Loading:** prefer skeletons for panels, spinners only for short inline waits.

---

## 5) State styles
- **Hover:** darken border or background slightly
- **Focus:** 2px ring \`--primary-soft\` + border \`--primary\`
- **Disabled:** lower contrast, no shadow, no hover
- **Error:** border \`--danger\`, helper text in danger color
- **Selected:** primary-soft background + primary text

---

## 6) Page composition
- Use a **two-level hierarchy**:
  1. Page title + primary action
  2. Main content in cards or step sections
- Keep line lengths moderate for PRD reading/editing.
- Prefer **single-column forms**; use two columns only for short metadata.
- For artifact generation, pair **input context** on left/top with **generated result** on right/below.

---

## 7) Product voice in UI
- **Focused:** concise labels
- **Calm:** avoid exclamation marks
- **Practical:** use direct verbs
- **Trustworthy:** explain system actions clearly
- **Fast:** short progress messages, minimal interruption

Example tone patterns:
- Create project
- Save PRD
- Define domain language
- Generate design system`;

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
