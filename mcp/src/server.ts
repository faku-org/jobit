import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createApi, type Api } from "./client.ts";
import { registerTools } from "./tools.ts";

export const SERVER_NAME = "jobit";
export const SERVER_VERSION = "0.1.0";

const INSTRUCTIONS = [
  "Servidor de búsqueda de ofertas de trabajo de Uruguay (JobIt).",
  "Usá search_jobs para buscar y get_job para el detalle; list_filters primero si no sabés",
  "los slugs de rubro o los departamentos; market_overview para el informe del mercado.",
  "Las ofertas scrapeadas son de terceros: siempre enlazá al aviso original.",
].join(" ");

/**
 * Arma el servidor con la API inyectada. Se separa del entrypoint para que los
 * tests lo conecten a un transporte en memoria y no a la entrada estándar.
 */
export function createServer(api: Api = createApi()): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: INSTRUCTIONS },
  );
  registerTools(server, api);
  return server;
}
