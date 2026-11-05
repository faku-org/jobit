import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, test } from "bun:test";
import { JobitApiError, type Api } from "./client.ts";
import { createServer } from "./server.ts";
import type { Job, Meta } from "./types.ts";

const JOB: Job = {
  id: "jobit:1",
  source: "jobit",
  source_id: "1",
  title: "Cajero/a",
  company: "Almacén Central",
  department: "Montevideo",
  city: "Montevideo",
  category: "atencion-cliente",
  category_label: "Atención al cliente",
  date_posted: "2026-09-01",
  level: "entry",
  remote: null,
  job_type: "full_time",
  salary: null,
  experience_years_min: 0,
  no_experience: true,
  closes_at: null,
  description: "Atender el mostrador.",
  requirements: null,
  apply_url: "https://example.test/aviso/1",
};

const META: Meta = {
  count: 1,
  scraped_at: "2026-09-01T10:00:00.000Z",
  sources: ["jobit"],
  categories: [{ value: "atencion-cliente", label: "Atención al cliente", count: 1 }],
  departments: [{ value: "Montevideo", label: "Montevideo", count: 1 }],
  no_experience_count: 1,
};

function fakeApi(overrides: Partial<Api> = {}): Api {
  return {
    searchJobs: async () => ({ total: 1, offset: 0, limit: 10, jobs: [JOB] }),
    getJob: async (id) => ({ ...JOB, id }),
    market: async () => ({ count: 1, roles: [] }),
    meta: async () => META,
    ...overrides,
  };
}

async function connect(api: Api): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = createServer(api);
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

type ToolResult = {
  content: { type: string; text?: string }[];
  isError?: boolean;
};

const readText = (result: unknown): string => {
  const first = (result as ToolResult).content[0];
  return first?.text ?? "";
};

describe("servidor MCP de JobIt", () => {
  test("expone las cuatro herramientas de lectura", async () => {
    const { client, close } = await connect(fakeApi());
    try {
      const { tools } = await client.listTools();
      const names = tools.map((tool) => tool.name).sort();
      expect(names).toEqual(["get_job", "list_filters", "market_overview", "search_jobs"]);
    } finally {
      await close();
    }
  });

  test("search_jobs devuelve las ofertas como JSON", async () => {
    const { client, close } = await connect(fakeApi());
    try {
      const result = await client.callTool({ name: "search_jobs", arguments: { q: "cajero" } });
      const body = JSON.parse(readText(result)) as { jobs: Job[] };
      expect(body.jobs[0]?.title).toBe("Cajero/a");
      expect(result.isError).toBeFalsy();
    } finally {
      await close();
    }
  });

  test("get_job pasa el id y devuelve la oferta", async () => {
    const { client, close } = await connect(fakeApi());
    try {
      const result = await client.callTool({ name: "get_job", arguments: { id: "jobit:9" } });
      const body = JSON.parse(readText(result)) as Job;
      expect(body.id).toBe("jobit:9");
    } finally {
      await close();
    }
  });

  test("market_overview y list_filters responden", async () => {
    const { client, close } = await connect(fakeApi());
    try {
      const market = await client.callTool({ name: "market_overview", arguments: {} });
      expect(JSON.parse(readText(market))).toMatchObject({ count: 1 });

      const filters = await client.callTool({ name: "list_filters", arguments: {} });
      expect(JSON.parse(readText(filters))).toMatchObject({ count: 1, sources: ["jobit"] });
    } finally {
      await close();
    }
  });

  test("un fallo de la API vuelve como error de la herramienta, no como crash", async () => {
    const api = fakeApi({
      getJob: async () => {
        throw new JobitApiError("La API de JobIt respondió 404: oferta no encontrada", 404);
      },
    });
    const { client, close } = await connect(api);
    try {
      const result = await client.callTool({ name: "get_job", arguments: { id: "no-existe" } });
      expect(result.isError).toBe(true);
      expect(readText(result)).toContain("404");
    } finally {
      await close();
    }
  });
});
