import { afterEach, describe, expect, test } from "bun:test";
import {
  type CachedJobs,
  expireJobs,
  isStale,
  loadJob,
  prefetchJobIds,
  readJob,
  readJobs,
  rememberJobs,
  writeJobs,
} from "./jobsCache.ts";
import type { Job } from "./types.ts";

const job = (id: string, title = "Cajero"): Job => ({
  id,
  source: "buscojobs",
  source_id: id,
  title,
  company: "Empresa SA",
  department: "Montevideo",
  city: "Montevideo",
  category: "ventas",
  category_label: "Ventas y comercial",
  date_posted: "2026-09-04T00:00:00.000Z",
  level: "entry",
  remote: null,
  job_type: "full_time",
  salary: null,
  experience_years_min: null,
  no_experience: true,
  education_level: null,
  schedule: null,
  vacancies: null,
  closes_at: null,
  description: "Atención al público.",
  requirements: null,
  apply_url: `https://ejemplo.com/${id}`,
  duplicates: [],
});

afterEach(() => {
  expireJobs();
});

describe("rememberJobs / readJob", () => {
  test("una oferta que ya pasó por una lista se encuentra por id", () => {
    writeJobs("q=cajero", [job("a"), job("b", "Repositor")], 2);
    expect(readJob("a")?.title).toBe("Cajero");
    expect(readJob("b")?.title).toBe("Repositor");
    expect(readJob("c")).toBeUndefined();
  });

  test("tirar las consultas no olvida las ofertas ya vistas", () => {
    writeJobs("q=cajero", [job("a")], 1);
    writeJobs("q=otra", [job("b")], 1);
    expect(readJob("a")?.id).toBe("a");
  });

  test("una tanda nueva sí vacía el índice", () => {
    rememberJobs([job("a")]);
    expireJobs();
    expect(readJob("a")).toBeUndefined();
  });
});

describe("loadJob", () => {
  test("si ya está, no va a la red", async () => {
    const offer = job("a");
    rememberJobs([offer]);
    await expect(loadJob("a")).resolves.toBe(offer);
  });
});

describe("prefetchJobIds", () => {
  test("no pide nada si todas ya están", () => {
    rememberJobs([job("a"), job("b")]);
    prefetchJobIds(["a", "b", "a"]);
  });
});

describe("expireJobs", () => {
  test("la lista guardada sigue estando, pero vieja", () => {
    writeJobs("q=expira", [job("a"), job("b")], 2);
    expect(isStale(readJobs("q=expira") as CachedJobs)).toBe(false);

    expireJobs();

    const hit = readJobs("q=expira");
    /** Lo que se estaba mirando no se tira: se revalida encima. */
    expect(hit?.jobs).toHaveLength(2);
    expect(hit?.total).toBe(2);
    expect(isStale(hit as CachedJobs)).toBe(true);
  });
});
