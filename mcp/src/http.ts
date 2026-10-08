import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createApi, type Api } from "./client.ts";
import { createServer } from "./server.ts";

/**
 * La versión hosteada: el mismo servidor, pero por HTTP, para agregarlo en
 * Claude, Cursor o cualquier cliente por URL en vez de clonar el repo.
 *
 * Es **sin sesión** y responde JSON (no SSE): las cuatro herramientas son de
 * lectura y no mandan nada del servidor al cliente, así que no hay stream que
 * sostener. Cada pedido monta su propio par servidor+transporte y lo cierra al
 * terminar, que es lo que deja atender a varios clientes a la vez sin guardar
 * estado en memoria.
 */
export const MCP_PATH = "/mcp";

/** El endpoint es público y de solo lectura; el navegador de un cliente MCP
 * puede llamarlo. */
const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, DELETE, OPTIONS",
  "access-control-allow-headers":
    "content-type, mcp-session-id, mcp-protocol-version, authorization",
  "access-control-expose-headers": "mcp-session-id",
};

export function createHttpHandler(api: Api = createApi()): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const { pathname } = new URL(request.url);
    if (pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "content-type": "application/json", ...CORS },
      });
    }
    if (pathname !== MCP_PATH && pathname !== "/") {
      return new Response("not found", { status: 404, headers: CORS });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    /** No hay mensajes del servidor al cliente que justifiquen un stream. */
    if (request.method === "GET") {
      return new Response("method not allowed", {
        status: 405,
        headers: { ...CORS, allow: "POST, DELETE, OPTIONS" },
      });
    }

    const server = createServer(api);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await server.connect(transport);
    try {
      const response = await transport.handleRequest(request);
      for (const [key, value] of Object.entries(CORS)) response.headers.set(key, value);
      return response;
    } finally {
      await transport.close().catch(() => {});
      await server.close().catch(() => {});
    }
  };
}

export function startHttp(port: number, host: string, api: Api = createApi()): void {
  const handler = createHttpHandler(api);
  Bun.serve({ port, hostname: host, fetch: (request) => handler(request) });
}

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3300);
  const host = process.env.HOST ?? "127.0.0.1";
  startHttp(port, host);
  console.error(`[jobit-mcp] HTTP en http://${host}:${port}${MCP_PATH}`);
}
