import { MCPServer } from "@mastra/mcp";
import { resourceHandlers } from "./resources";
import { writeNoteTool } from "../tools/write-tool";
import { promptHandlers } from "./prompts";

/**
 * @qn why not put resources as part of tools?
 * @ans to let the model know that these action are always available and don't need to figure out extra tool calls
 */
export const notes = new MCPServer({
  id: "notes",
  name: "Notes Server",
  version: "0.1.0",
  prompts: promptHandlers,
  tools: { writeNoteTool },
  resources: resourceHandlers
});
