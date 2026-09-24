#!/usr/bin/env bun
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DEFAULT_BASE_URL, createApi } from "./client.ts";
import { createServer } from "./server.ts";

if (import.meta.main) {
  const api = createApi();
  const server = createServer(api);
  await server.connect(new StdioServerTransport());
  /** A stderr y no a stdout: stdout es el canal del protocolo. */
  console.error(`[jobit-mcp] escuchando; API en ${process.env.JOBIT_API_URL ?? DEFAULT_BASE_URL}`);
}
