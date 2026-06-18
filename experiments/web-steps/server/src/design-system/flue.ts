import { createFlueClient } from "@flue/sdk";
import { z } from "zod";
import { env } from "../../env.js";

export const FluePenpotSimpleResultSchema = z.object({
  artboard_id: z.string().min(1),
  artboard_name: z.string().min(1),
  note: z.string().optional(),
  image: z.object({
    mimeType: z.literal("image/png"),
    base64: z.string().min(1),
    imageUrl: z.string().min(1),
  }),
});

export type FluePenpotSimpleResult = z.infer<
  typeof FluePenpotSimpleResultSchema
>;

export function createFlueDesignSystemClient() {
  return createFlueClient({
    baseUrl: env.FLUE_BASE_URL,
  });
}

export async function runPenpotSimpleExport(input: {
  designSystemText: string;
}) {
  const client = createFlueDesignSystemClient();

  const result = await client.workflows.invoke("penpot-simple", {
    payload: {
      designSystemText: input.designSystemText,
    },
    wait: "result",
  });

  return FluePenpotSimpleResultSchema.parse(result.result);
}
