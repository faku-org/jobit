import { describe, expect, test } from "bun:test";
import { JobitApiError, createApi } from "./client.ts";

const respond = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

type Captured = { url: URL; init: RequestInit | undefined };

function capture(response: () => Response): { seen: Captured[]; fetchImpl: typeof fetch } {
  const seen: Captured[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    seen.push({ url, init });
    return response();
  }) as typeof fetch;
  return { seen, fetchImpl };
}

describe("createApi", () => {
  test("searchJobs arma la query con los filtros y omite los vacíos", async () => {
    const { seen, fetchImpl } = capture(() =>
      respond({ total: 0, offset: 0, limit: 10, jobs: [] }),
    );
    const api = createApi({ baseUrl: "https://api.test/", fetchImpl });

    await api.searchJobs({
      q: "cajero",
      category: "ventas",
      no_experience: true,
      days: 7,
      limit: 5,
      offset: 10,
    });

    expect(seen).toHaveLength(1);
    const { url } = seen[0]!;
    expect(url.pathname).toBe("/api/jobs");
    expect(url.searchParams.get("q")).toBe("cajero");
    expect(url.searchParams.get("category")).toBe("ventas");
    expect(url.searchParams.get("no_experience")).toBe("true");
    expect(url.searchParams.get("days")).toBe("7");
    expect(url.searchParams.get("limit")).toBe("5");
    expect(url.searchParams.get("offset")).toBe("10");
  });

  test("getJob codifica el id en la ruta", async () => {
    const { seen, fetchImpl } = capture(() =>
      respond({ id: "a b", title: "Oferta", apply_url: "" }),
    );
    const api = createApi({ baseUrl: "https://api.test", fetchImpl });

    await api.getJob("a b");

    expect(seen[0]!.url.pathname).toBe("/api/jobs/a%20b");
  });

  test("un error de la API se traduce con su status y su detalle", async () => {
    const { fetchImpl } = capture(() =>
      respond({ error: "las ofertas no están disponibles" }, 503),
    );
    const api = createApi({ baseUrl: "https://api.test", fetchImpl });

    const failure = api.searchJobs({});
    await expect(failure).rejects.toBeInstanceOf(JobitApiError);
    await expect(failure).rejects.toThrow(/503.*las ofertas/);
  });

  test("una caída de red no filtra el error crudo", async () => {
    const fetchImpl = (async () => {
      throw new Error("connect ECONNREFUSED");
    }) as unknown as typeof fetch;
    const api = createApi({ baseUrl: "https://api.test", fetchImpl });

    await expect(api.market()).rejects.toThrow(/No se pudo contactar la API/);
  });

  test("usa JOBIT_API_URL cuando no se pasa base", async () => {
    const previous = process.env.JOBIT_API_URL;
    process.env.JOBIT_API_URL = "https://self-host.test";
    try {
      const { seen, fetchImpl } = capture(() => respond({ count: 0 }));
      const api = createApi({ fetchImpl });
      await api.meta();
      expect(seen[0]!.url.origin).toBe("https://self-host.test");
    } finally {
      if (previous === undefined) delete process.env.JOBIT_API_URL;
      else process.env.JOBIT_API_URL = previous;
    }
  });
});
