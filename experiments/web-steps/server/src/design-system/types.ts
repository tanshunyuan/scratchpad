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
  penpot: PenpotBoardInfoSchema,
  preview: PreviewSchema.optional(),
});

export type GenerateDesignSystemResult = z.infer<
  typeof GenerateDesignSystemResultSchema
>;
