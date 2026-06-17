import { Agent } from "@mastra/core/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { env } from "../../env.js";
import { logDesignSystem } from "./log.js";
import type { ProjectContext } from "./types.js";

const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export async function generateDesignSystemText(
  context: ProjectContext,
): Promise<string> {
  logDesignSystem("LLM text agent start", { model: env.OPENAI_MODEL });

  const agent = new Agent({
    id: "design-system-text-agent",
    name: "Design System Text Agent",
    model: openai(env.OPENAI_MODEL),
    instructions:
      "You are a senior product designer. Return concise design-system guidance in markdown.",
  });

  const result = await agent.generate(
    [
      "Create a small design system from this PRD and ubiquitous language.",
      "Include: design principles, colors, typography, spacing, components, interaction rules.",
      "Keep it compact enough to fit on one Penpot board.",
      "Do not include placeholder content.",
      "",
      "PRD:",
      context.prd,
      "",
      "Ubiquitous Language:",
      context.ubiquitousLanguage,
    ].join("\n"),
  );

  const text = result.text.trim();
  logDesignSystem("LLM text agent finished", { chars: text.length });

  if (!text) {
    throw new Error("LLM returned empty design-system text");
  }

  return text;
}
