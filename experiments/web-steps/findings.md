# Findings

- Existing `generator.ts` creates markdown via LLM text output.
- Existing `workflow.ts` passes markdown directly to `createDesignSystemBoardInPenpot`.
- Current `penpot.ts` already uses direct MCP calls after previous change, but script parses markdown itself and is too large.
- Need add intermediate `PenpotBoardPlan` generated via `structuredOutput` from markdown.
- Store/result types currently include `designSystemText`, `penpot`, optional `preview` only.
