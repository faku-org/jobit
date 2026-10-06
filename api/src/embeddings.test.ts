import { beforeEach, describe, expect, test } from "bun:test";
import type { EmbedderError as EmbedderFailure } from "./embeddings.ts";

process.env.DB_FILE = ":memory:";

const { closeDb } = await import("./db.ts");
const {
  EmbedderError,
  embedTexts,
  embeddedIds,
  embeddingCount,
  embeddingOf,
  embeddingsFor,
  upsertEmbedding,
} = await import("./embeddings.ts");
const { startFakeEmbedder } = await import("./test/fake-embedder.ts");

beforeEach(() => {
  closeDb();
  delete process.env.EMBEDDER_URL;
  delete process.env.EMBEDDER_BATCH;
  delete process.env.EMBEDDER_TIMEOUT_MS;
});

/** Corre el cuerpo con el embedder falso apuntado y lo apaga al salir. */
async function withEmbedder(
  options: Parameters<typeof startFakeEmbedder>[0],
  run: (fake: ReturnType<typeof startFakeEmbedder>) => Promise<void>,
): Promise<void> {
  const fake = startFakeEmbedder(options);
  process.env.EMBEDDER_URL = fake.url;
  try {
    await run(fake);
  } finally {
    fake.stop();
  }
}

describe("embedTexts", () => {
  test("manda un texto y devuelve su vector", async () => {
    await withEmbedder({ vectorFor: (text) => [text.length, 0.5, -0.25] }, async (fake) => {
      const vectors = await embedTexts(["hola"]);

      expect(vectors).toHaveLength(1);
      expect([...(vectors[0] as Float32Array)]).toEqual([4, 0.5, -0.25]);
      expect(fake.requests).toHaveLength(1);
      expect(fake.requests[0]?.model).toBe("embeddinggemma-2");
    });
  });

  test("parte en lotes del tamaño configurado y respeta el orden", async () => {
    process.env.EMBEDDER_BATCH = "6";
    const texts = Array.from({ length: 20 }, (_, i) => `t${i}`);

    await withEmbedder({ vectorFor: (text) => [text.length], shuffle: true }, async (fake) => {
      const vectors = await embedTexts(texts);

      expect(fake.requests.map((request) => request.input.length)).toEqual([6, 6, 6, 2]);
      expect(vectors.map((vector) => vector[0])).toEqual(texts.map((text) => text.length));
    });
  });

  test("sin textos no le pega al embedder", async () => {
    await withEmbedder({}, async (fake) => {
      expect(await embedTexts([])).toEqual([]);
      expect(fake.requests).toHaveLength(0);
    });
  });

  test("un embedder caído es un error 'unavailable', no una excepción suelta", async () => {
    const fake = startFakeEmbedder({});
    const url = fake.url;
    fake.stop();
    process.env.EMBEDDER_URL = url;

    const error = await embedTexts(["x"]).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(EmbedderError);
    expect((error as EmbedderFailure).kind).toBe("unavailable");
  });

  test("una respuesta con status raro se marca como 'status'", async () => {
    await withEmbedder({ status: 500 }, async () => {
      const error = await embedTexts(["x"]).catch((cause: unknown) => cause);
      expect(error).toBeInstanceOf(EmbedderError);
      expect((error as EmbedderFailure).kind).toBe("status");
      expect((error as EmbedderFailure).status).toBe(500);
    });
  });

  test("un vector vacío de respuesta se marca como 'malformed'", async () => {
    await withEmbedder({ vectorFor: () => [] }, async () => {
      const error = await embedTexts(["x"]).catch((cause: unknown) => cause);
      expect(error).toBeInstanceOf(EmbedderError);
      expect((error as EmbedderFailure).kind).toBe("malformed");
    });
  });

  test("si el embedder se cuelga, el timeout corta", async () => {
    process.env.EMBEDDER_TIMEOUT_MS = "20";
    await withEmbedder({ delayMs: 500 }, async () => {
      const error = await embedTexts(["x"]).catch((cause: unknown) => cause);
      expect(error).toBeInstanceOf(EmbedderError);
      expect((error as EmbedderFailure).kind).toBe("timeout");
    });
  });
});

describe("storage de vectores", () => {
  test("guarda, lee y pisa el vector de una oferta", () => {
    upsertEmbedding("offer-1", Float32Array.from([0.1, 0.2, 0.3]), {
      model: "m1",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const stored = embeddingOf("offer-1");
    expect(stored?.model).toBe("m1");
    expect(stored?.dim).toBe(3);
    expect(stored?.updated_at).toBe("2026-01-01T00:00:00.000Z");
    expect([...(stored?.vec ?? [])].map((n) => Number(n.toFixed(3)))).toEqual([0.1, 0.2, 0.3]);

    upsertEmbedding("offer-1", Float32Array.from([9]), { model: "m2" });
    expect(embeddingOf("offer-1")?.model).toBe("m2");
    expect(embeddingCount("m2")).toBe(1);
    expect(embeddingCount("m1")).toBe(0);
  });

  test("embeddingsFor trae solo los ids pedidos y del modelo pedido", () => {
    upsertEmbedding("a", Float32Array.from([1]), { model: "m1" });
    upsertEmbedding("b", Float32Array.from([2]), { model: "m1" });
    upsertEmbedding("c", Float32Array.from([3]), { model: "otro" });

    expect([...embeddingsFor(["a", "b", "c"], "m1").keys()].sort()).toEqual(["a", "b"]);
    expect([...embeddingsFor(["a"], "m1").values()][0]?.[0]).toBe(1);
  });

  test("embeddedIds junta los ids del modelo vigente", () => {
    upsertEmbedding("a", Float32Array.from([1]), { model: "m1" });
    upsertEmbedding("b", Float32Array.from([1]), { model: "m1" });
    upsertEmbedding("c", Float32Array.from([1]), { model: "otro" });

    expect([...embeddedIds("m1")].sort()).toEqual(["a", "b"]);
    expect([...embeddedIds("otro")]).toEqual(["c"]);
  });

  test("lee más de 500 vectores sin chocar con el techo de parámetros de SQLite", () => {
    const ids = Array.from({ length: 600 }, (_, i) => `offer-${i}`);
    for (const id of ids) upsertEmbedding(id, Float32Array.from([1, 0]), { model: "m1" });

    expect(embeddingsFor(ids, "m1").size).toBe(600);
  });
});
