/**
 * SSE/HTTP entry point — listens on port 8775 for use in Docker/NAS deployments.
 * Claude Code config: { "url": "http://nas:8775/sse" }
 */
import './logger';
import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer } from "./server.js";

const PORT = parseInt(process.env.PORT ?? "8775", 10);

const app = express();

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "claude-monarch", port: PORT });
});

// MCP SSE endpoint — each GET /sse creates a new server instance + transport
app.get("/sse", async (_req, res) => {
  const server = createServer();
  const transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

// MCP message POST endpoint (SSE transport uses this for client→server messages)
// The SSEServerTransport registers its own handler; we just need the route.
app.post("/messages", express.json(), (_req, res) => {
  // Handled internally by SSEServerTransport; this stub satisfies express routing
  res.status(200).end();
});

app.listen(PORT, () => {
  console.log(`[claude-monarch] SSE server listening on port ${PORT}`);
  console.log(`[claude-monarch]   Health:  http://localhost:${PORT}/health`);
  console.log(`[claude-monarch]   MCP SSE: http://localhost:${PORT}/sse`);
});
