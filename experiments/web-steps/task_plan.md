# Task Plan: Markdown -> Board Plan -> Penpot Renderer

## Goal
Keep markdown design system as source of truth. Add structured LLM board-plan step, then render plan in Penpot via deterministic MCP calls.

## Phases
1. Research current design-system flow — complete
2. Add board-plan schema/types — complete
3. Add LLM board-plan generator with structuredOutput — complete
4. Update workflow/result shape — complete
5. Simplify Penpot renderer to render board plan — complete
6. Build/test — pending

## Decisions
- Markdown remains primary saved artifact.
- LLM may plan board with structuredOutput; LLM must not write Penpot JS.
- Penpot MCP calls stay direct through `listToolsets()`.
- Renderer fails hard on MCP tool failure and invalid verification.

## Errors Encountered
| Error | Resolution |
|---|---|
| None yet | |
