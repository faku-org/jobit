import { beforeEach, describe, expect, test } from "bun:test";
import type { Job } from "./types.ts";

process.env.DB_FILE = ":memory:";

const { closeDb } = await import("./db.ts");
const { backfill } = await import("./embed-backfill.ts");
const { EmbedderError, embeddingCount, embeddingOf } = await import("./embeddings.ts");

const job = (id: string, overrides: Partial<Job> = {}): Job => ({
  id,
  source: "buscojobs",
  source_id: id,
  title: `Título ${id}`,
  company: null,
  department: null,
  city: null,
  category: "otros",
  category_label: "Otros",
  category_raw: "otros",
  date_posted: "2026-09-01T00:00:00.000Z",
  level: null,
  remote: null,
  job_type: null,
  salary: null,
  experience_years_min: null,
  no_experience: false,
  education_level: null,
  schedule: null,
  vacancies: null,
  closes_at: null,
  description: `Descripción ${id}`,
  requirements: null,
  apply_url: "https://ejemplo.com",
  duplicates: [],
  ...overrides,
});

/** Un embedder falso que registra lo que le pidieron y devuelve vectores de 3
 * dimensiones derivados del texto. */
function recorder() {
  const seen: string[][] = [];
  const embed = async (texts: string[]): Promise<Float32Array[]> => {
    seen.push(texts);
    return texts.map((text) => Float32Array.from([text.length, 1, 0]));
  };
  return { seen, embed };
}

beforeEach(closeDb);

describe("backfill", () => {
  test("embebe las ofertas y guarda el vector de cada una", async () => {
    const { seen, embed } = recorder();
    const jobs = [job("a"), job("b")];

    const result = await backfill(jobs, { model: "fake-model", embed });

    expect(result).toEqual({ embedded: 2, skipped: 0, failed: 0, dim: 3 });
    expect(embeddingCount("fake-model")).toBe(2);
    expect(embeddingOf("a")?.dim).toBe(3);
    expect(seen).toHaveLength(1);
  });

  test("arma el texto con título, descripción y requisitos", async () => {
    const { seen, embed } = recorder();
    await backfill([job("a", { description: "Producto", requirements: "Portfolio" })], {
      model: "fake-model",
      embed,
    });

    expect(seen[0]?.[0]).toBe("Título a\nProducto\nPortfolio");
  });

  test("es idempotente: la segunda corrida saltea lo ya embebido", async () => {
    const first = recorder();
    const jobs = [job("a"), job("b")];
    await backfill(jobs, { model: "fake-model", embed: first.embed });

    const second = recorder();
    const result = await backfill(jobs, { model: "fake-model", embed: second.embed });

    expect(result).toEqual({ embedded: 0, skipped: 2, failed: 0, dim: null });
    expect(second.seen).toHaveLength(0);
  });

  test("force reembebe aunque ya estuviera", async () => {
    const jobs = [job("a")];
    await backfill(jobs, { model: "fake-model", embed: recorder().embed });

    const again = recorder();
    const result = await backfill(jobs, { model: "fake-model", force: true, embed: again.embed });

    expect(result.embedded).toBe(1);
    expect(again.seen).toHaveLength(1);
  });

  test("otro modelo no se saltea nada: son vectores distintos", async () => {
    const jobs = [job("a")];
    await backfill(jobs, { model: "viejo", embed: recorder().embed });

    const result = await backfill(jobs, { model: "nuevo", embed: recorder().embed });

    expect(result).toEqual({ embedded: 1, skipped: 0, failed: 0, dim: 3 });
    expect(embeddingOf("a")?.model).toBe("nuevo");
  });

  test("una tanda que falla cuenta y sigue con la próxima", async () => {
    let call = 0;
    const embed = async (texts: string[]): Promise<Float32Array[]> => {
      call++;
      if (call === 2) throw new EmbedderError("unavailable", "se cayó");
      return texts.map(() => Float32Array.from([1, 0, 0]));
    };

    const jobs = Array.from({ length: 130 }, (_, i) => job(`j${i}`));
    const result = await backfill(jobs, { model: "fake-model", embed });

    /** 130 en tandas de 64: la del medio falla, las otras dos entran. */
    expect(result).toEqual({ embedded: 66, skipped: 0, failed: 64, dim: 3 });
    expect(embeddingCount("fake-model")).toBe(66);
  });
});
