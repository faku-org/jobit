import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { JobitApiError, type Api } from "./client.ts";

/** Menos que el tope de la API: un agente no necesita cincuenta fichas de una. */
const LIMIT_MAX = 50;
const LIMIT_DEFAULT = 10;

const text = (value: unknown): string => JSON.stringify(value, null, 2);

/** Un fallo se devuelve como resultado, no se lanza: el protocolo sigue vivo. */
function failure(cause: unknown): CallToolResult {
  const message =
    cause instanceof JobitApiError
      ? cause.message
      : cause instanceof Error
        ? cause.message
        : String(cause);
  return { content: [{ type: "text", text: message }], isError: true };
}

function ok(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: text(value) }] };
}

/**
 * Las cuatro herramientas. Todas son de lectura: el MCP no escribe nada y no
 * toca lo guardado en el navegador de nadie, que vive del lado del cliente.
 */
export function registerTools(server: McpServer, api: Api): void {
  server.registerTool(
    "search_jobs",
    {
      title: "Buscar ofertas de trabajo en Uruguay",
      description:
        "Busca ofertas de trabajo en Uruguay y devuelve { total, offset, limit, jobs }. " +
        "Todos los filtros son opcionales y combinables. Los valores de category y department " +
        "son slugs/etiquetas que se obtienen con list_filters. Paginá con offset y limit " +
        `(máximo ${LIMIT_MAX}).`,
      inputSchema: {
        q: z.string().optional().describe("Texto libre sobre título, empresa, ubicación y rubro."),
        category: z.string().optional().describe("Slug de rubro, por ejemplo tecnologia o ventas."),
        department: z.string().optional().describe("Departamento, tal cual lo publica la fuente."),
        level: z.enum(["entry", "mid", "senior"]).optional().describe("Nivel del puesto."),
        remote: z
          .enum(["onsite", "remote", "hybrid"])
          .optional()
          .describe("Modalidad; sin teletrabajo cuenta como onsite."),
        job_type: z
          .enum(["full_time", "part_time", "internship"])
          .optional()
          .describe("Tipo de jornada."),
        no_experience: z
          .boolean()
          .optional()
          .describe("true para ofertas que no piden experiencia previa."),
        days: z.coerce
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Solo ofertas publicadas en los últimos N días."),
        source: z
          .string()
          .optional()
          .describe("Fuentes separadas por coma: jobit, buscojobs, uruguayconcursa."),
        sort: z
          .enum(["recent", "closing"])
          .optional()
          .describe("recent por fecha de publicación; closing por fecha de cierre."),
        limit: z.coerce
          .number()
          .int()
          .min(1)
          .max(LIMIT_MAX)
          .optional()
          .describe(`Cuántas traer; por defecto ${LIMIT_DEFAULT}, máximo ${LIMIT_MAX}.`),
        offset: z.coerce.number().int().min(0).optional().describe("Desde qué fila empezar."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args): Promise<CallToolResult> => {
      try {
        return ok(
          await api.searchJobs({
            ...args,
            limit: args.limit ?? LIMIT_DEFAULT,
            offset: args.offset ?? 0,
          }),
        );
      } catch (cause) {
        return failure(cause);
      }
    },
  );

  server.registerTool(
    "get_job",
    {
      title: "Ver una oferta completa",
      description:
        "Devuelve una oferta por id, con la descripción completa y el enlace para postularse.",
      inputSchema: {
        id: z.string().min(1).describe("El id de la oferta, como viene en search_jobs."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args): Promise<CallToolResult> => {
      try {
        return ok(await api.getJob(args.id));
      } catch (cause) {
        return failure(cause);
      }
    },
  );

  server.registerTool(
    "market_overview",
    {
      title: "Resumen del mercado laboral",
      description:
        "El tablero entero resumido: totales, puestos, rubros, departamentos, modalidad, " +
        "jornada y sueldos. No lleva nada sobre quien pregunta.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (): Promise<CallToolResult> => {
      try {
        return ok(await api.market());
      } catch (cause) {
        return failure(cause);
      }
    },
  );

  server.registerTool(
    "list_filters",
    {
      title: "Rubros, departamentos y fuentes disponibles",
      description:
        "Devuelve los rubros y departamentos con su conteo, las fuentes y el total de ofertas. " +
        "Es lo que hay que mirar antes de filtrar con search_jobs.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (): Promise<CallToolResult> => {
      try {
        return ok(await api.meta());
      } catch (cause) {
        return failure(cause);
      }
    },
  );
}
