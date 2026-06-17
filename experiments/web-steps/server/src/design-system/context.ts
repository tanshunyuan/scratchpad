import type { GenerateDesignSystemInput, ProjectContext } from "./types.js";

export async function loadProjectContext(
  input: GenerateDesignSystemInput,
): Promise<ProjectContext> {
  if (input.projectId !== "demo-project") {
    throw new Error(`Unknown projectId: ${input.projectId}`);
  }

  return {
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
}
