/**
 * stdio entry point — for use with Claude Code's MCP config:
 *   { "command": "node", "args": ["dist/index.js"] }
 */
import * as dotenv from "dotenv";
dotenv.config();

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdio mode — don't log to stdout (it would corrupt the MCP stream)
  process.stderr.write("[claude-monarch] MCP server running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`[claude-monarch] Fatal: ${err}\n`);
  process.exit(1);
});
