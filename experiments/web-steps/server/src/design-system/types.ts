import { z } from "zod";

export const GenerateDesignSystemInputSchema = z.object({
  projectId: z.string().min(1),
});

export type GenerateDesignSystemInput = z.infer<
  typeof GenerateDesignSystemInputSchema
>;

export const ProjectContextSchema = z.object({
  prd: z.string().min(1),
  ubiquitousLanguage: z.string().min(1),
});

export type ProjectContext = z.infer<typeof ProjectContextSchema>;

export const PenpotBoardPlanItemSchema = z.object({
  name: z.string().min(1),
  value: z.string().optional(),
  usage: z.string().optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  size: z.number().int().positive().max(96).optional(),
  lineHeight: z.number().int().positive().max(120).optional(),
  weight: z.string().optional(),
  variants: z.array(z.string().min(1)).max(6).default([]),
  states: z.array(z.string().min(1)).max(6).default([]),
});

export const PenpotBoardPlanSectionSchema = z.object({
  title: z.string().min(1),
  kind: z.enum([
    "overview",
    "color",
    "typography",
    "spacing",
    "components",
    "patterns",
    "interaction",
  ]),
  description: z.string().optional(),
  items: z.array(PenpotBoardPlanItemSchema).min(1).max(12),
});

export const PenpotBoardPlanSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  sections: z.array(PenpotBoardPlanSectionSchema).min(3).max(8),
});

export type PenpotBoardPlan = z.infer<typeof PenpotBoardPlanSchema>;

export const PenpotBoardInfoSchema = z.object({
  fileId: z
    .string()
    .min(1)
    .describe("Penpot file id. Use 'unknown' if the Plugin API does not expose it."),
  boardId: z.string().min(1).describe("Created Penpot board id."),
  boardName: z.string().min(1).describe("Created Penpot board name."),
  boardUrl: z.string().optional().describe("URL to the board, if available."),
});

export type PenpotBoardInfo = z.infer<typeof PenpotBoardInfoSchema>;

export const PreviewSchema = z.object({
  imageUrl: z.string().optional(),
  imageBase64: z.string().optional(),
  mimeType: z.literal("image/png"),
});

export type Preview = z.infer<typeof PreviewSchema>;

export const GenerateDesignSystemResultSchema = z.object({
  designSystemText: z.string().min(1),
  penpotBoardPlan: PenpotBoardPlanSchema,
  penpot: PenpotBoardInfoSchema,
  preview: PreviewSchema.optional(),
});

export type GenerateDesignSystemResult = z.infer<
  typeof GenerateDesignSystemResultSchema
>;
