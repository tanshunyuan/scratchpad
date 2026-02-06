import { createTool } from "@mastra/core/tools";
import z from "zod";
import Exa from "exa-js";

export const exa = new Exa(process.env.EXA_API_KEY);

export const webSearch = createTool({
  id: "exa-web-search",
  description: "Search the web",
  inputSchema: z.object({
    query: z.string().min(1).max(50).describe("The search query"),
  }),
  outputSchema: z.array(
    z.object({
      title: z.string().nullable(),
      url: z.string(),
      content: z.string(),
      publishedDate: z.string().optional(),
    }),
  ),
  execute: async (inputData) => {
    const { results } = await exa.search(inputData.query, {
      numResults: 2,
    });

    return results.map((result) => ({
      title: result.title,
      url: result.url,
      content: result.text.slice(0, 500),
      publishedDate: result.publishedDate,
    }));
  },
});
