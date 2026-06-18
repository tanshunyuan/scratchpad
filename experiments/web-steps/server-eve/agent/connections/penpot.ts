import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: process.env.PENPOT_MCP_URL!,
  description:
    "Penpot MCP for the already-open Penpot document. Use it to inspect/create boards and export a board as PNG.",
});
