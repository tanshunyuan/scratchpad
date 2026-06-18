import { createFlueClient } from "@flue/sdk";
import { z } from "zod";
import { env } from "../../env.js";

const FluePenpotSimpleResultSchema = z.object({
  artboard_id: z.string().min(1),
  artboard_name: z.string().min(1),
  note: z.string().optional(),
  image: z.object({
    mimeType: z.literal("image/png"),
    base64: z.string().min(1),
    imageUrl: z.string().min(1),
  }),
});

export async function runPenpotSimpleExport(input: {
  designSystemText: string;
}) {
  const client = createFlueClient({
    baseUrl: env.FLUE_BASE_URL ?? 'http://localhost:3583',
  });

  const result = await client.workflows.invoke("penpot-simple", {
    payload: {
      designSystemText: input.designSystemText,
    },
    wait: "result",
  });

  return FluePenpotSimpleResultSchema.parse(result.result);
}
