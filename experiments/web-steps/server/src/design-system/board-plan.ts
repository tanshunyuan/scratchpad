import { createOpenAI } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { env } from "../../env.js";
import { logDesignSystem } from "./log.js";
import {
  PenpotBoardPlanSchema,
  type PenpotBoardPlan,
} from "./types.js";

const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export async function generatePenpotBoardPlan(input: {
  designSystemText: string;
}): Promise<PenpotBoardPlan> {
  logDesignSystem("LLM board-plan agent start", { model: env.OPENAI_MODEL });

  const agent = new Agent({
    id: "design-system-board-plan-agent",
    name: "Design System Board Plan Agent",
    model: openai(env.OPENAI_MODEL),
    instructions: [
      "You are a senior product designer planning a Penpot design-system reference board.",
      "Use the markdown design system as the sole source of truth.",
      "Choose representative, readable board content. Do not invent tokens or components not supported by the markdown.",
      "Prioritize header, color, typography, spacing, and core components.",
    ].join("\n"),
  });

  const result = await agent.generate(
    [
      "Plan one Penpot board from this markdown design system.",
      "Make the board concise, visual, and scannable.",
      "Prefer representative specimens over exhaustive dumps.",
      "Include enough items for the renderer to create a useful board.",
      "",
      "Markdown design system:",
      input.designSystemText,
    ].join("\n"),
    {
      structuredOutput: {
        schema: PenpotBoardPlanSchema,
      },
    },
  );

  const boardPlan = PenpotBoardPlanSchema.parse(result.object);

  logDesignSystem("LLM board-plan agent finished", {
    title: boardPlan.title,
    sections: boardPlan.sections.length,
    items: boardPlan.sections.reduce(
      (total, section) => total + section.items.length,
      0,
    ),
  });

  return boardPlan;
}
