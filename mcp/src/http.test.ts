import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { describe, expect, test } from "bun:test";
import type { Api } from "./client.ts";
import { createHttpHandler } from "./http.ts";

const fakeApi: Api = {
  searchJobs: async () => ({
    total: 1,
    offset: 0,
    limit: 10,
    jobs: [
      {
        id: "jobit:1",
        source: "jobit",
        source_id: "1",
        title: "Cajero/a",
        company: "Almacén",
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
        description: "",
        requirements: null,
        apply_url: "",
      },
    ],
  }),
  getJob: async (id) => ({
    id,
    source: "jobit",
    source_id: id,
    title: "Cajero/a",
    company: "Almacén",
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
    description: "",
    requirements: null,
    apply_url: "",
  }),
  market: async () => ({ count: 1 }),
  meta: async () => ({
    count: 1,
    scraped_at: "2026-09-01T00:00:00.000Z",
    sources: ["jobit"],
    categories: [],
    departments: [],
    no_experience_count: 1,
  }),
};

describe("servidor MCP por HTTP", () => {
  test("un cliente se conecta por URL y usa las herramientas", async () => {
    const handler = createHttpHandler(fakeApi);
    const server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: (request) => handler(request),
    });

    try {
      const transport = new StreamableHTTPClientTransport(
        new URL(`http://127.0.0.1:${server.port}/mcp`),
      );
      const client = new Client({ name: "test", version: "0.0.0" });
      await client.connect(transport);

      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name).sort()).toEqual([
        "get_job",
        "list_filters",
        "market_overview",
        "search_jobs",
      ]);

      const result = await client.callTool({ name: "search_jobs", arguments: { q: "cajero" } });
      const content = result.content as { type: string; text?: string }[];
      expect(content[0]?.text).toContain("Cajero/a");

      await client.close();
    } finally {
      await server.stop(true);
    }
  });

  test("GET y las rutas que no son /mcp se rechazan sin tocar la API", async () => {
    const handler = createHttpHandler(fakeApi);
    expect((await handler(new Request("http://x/mcp", { method: "GET" }))).status).toBe(405);
    expect((await handler(new Request("http://x/otra"))).status).toBe(404);
    expect((await handler(new Request("http://x/mcp", { method: "OPTIONS" }))).status).toBe(204);
  });
});
