import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURES = join(import.meta.dir, "../../data/test-employer-page");
mkdirSync(FIXTURES, { recursive: true });

const JOBS_FILE = join(FIXTURES, "jobs.json");

process.env.DB_FILE = ":memory:";
process.env.JOBS_FILE = JOBS_FILE;
process.env.PUBLIC_ORIGIN = "https://jobs.test";

const { closeDb } = await import("./db.ts");
const { resetLimits } = await import("./limit.ts");
const { clearFeedCache } = await import("./feed.ts");
const { app } = await import("./index.ts");
const companies = await import("./companies.ts");
const { employerLd, employerPageHtml, employerSitemapEntries, safeWebsite } =
  await import("./employer-page.ts");
const { employerJobs, employerProfile } = await import("./employers.ts");
const { layout } = await import("./pages.ts");

const job = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  source: "buscojobs",
  source_id: id,
  title: "Vendedor de mostrador",
  company: "ACME S.A.",
  department: "Montevideo",
  city: "Montevideo",
  category: "ventas",
  category_label: "Ventas y comercial",
  category_raw: "ventas",
  date_posted: "2026-09-01T00:00:00.000Z",
  level: "entry",
  remote: null,
  job_type: "full_time",
  salary: { min: 30_000, max: 40_000, currency: "UYU" },
  experience_years_min: null,
  no_experience: true,
  education_level: null,
  schedule: null,
  vacancies: null,
  closes_at: null,
  description: "",
  requirements: null,
  apply_url: `https://ejemplo.com/${id}`,
  duplicates: [],
  ...overrides,
});

const JOBS = [
  job("a1", { salary: null }),
  job("a2", { company: "Acme S.A.", title: "Cajero", date_posted: "2026-09-03T00:00:00.000Z" }),
  job("a3", { remote: "hybrid", department: "Canelones", city: "Las Piedras" }),
  job("solo", { company: "Solita", title: "Peón de campo" }),
  job("script", { company: "Mala </script><b>x</b>" }),
  ...["p1", "p2", "p3", "p4", "p5"].map((id) =>
    job(id, { company: "Pagadora", salary: { min: 40_000, max: 60_000, currency: "UYU" } }),
  ),
];

beforeEach(() => {
  closeDb();
  resetLimits();
  clearFeedCache();
  process.env.JOBS_FILE = JOBS_FILE;
  writeFileSync(
    JOBS_FILE,
    JSON.stringify({
      scraped_at: "2026-09-05T06:00:00.000Z",
      sources: ["buscojobs"],
      count: JOBS.length,
      jobs: JOBS,
    }),
    "utf8",
  );
});

const get = (path: string): Promise<Response> => app.handle(new Request(`http://localhost${path}`));

describe("GET /empresa/:slug", () => {
  test("sale en HTML con canonical, Organization y el resumen del stand", async () => {
    const response = await get("/empresa/acme-s-a");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");

    const html = await response.text();
    expect(html).toContain("<h1>Trabajar en ACME S.A.</h1>");
    expect(html).toContain('rel="canonical" href="https://jobs.test/empresa/acme-s-a"');
    expect(html).toContain('"@type":"Organization"');
    expect(html).toContain('"name":"ACME S.A."');
    expect(html).toContain("<td>Ofertas publicadas</td><td>3</td>");
    expect(html).toContain("Vendedor");
    expect(html).toContain("Cajero");
    expect(html).toContain("Canelones (1)");
    expect(html).toContain("Híbrido (1)");
    expect(html).not.toContain("Sueldo mensual");
    expect(html).toContain('href="https://jobs.test/empleo/a1"');
    expect(html).toContain('href="https://jobs.test/?company=acme-s-a"');
  });

  test("con sueldos suficientes muestra la mediana publicada", async () => {
    const html = await (await get("/empresa/pagadora")).text();
    expect(html).toContain("Sueldo mensual publicado (mediana)");
    expect(html).toContain("$ 40.000");
    expect(html).toContain("según 5 avisos");
  });

  test("sin cuenta de empresa no inventa un sitio", async () => {
    const html = await (await get("/empresa/acme-s-a")).text();
    expect(html).not.toContain('"url":"http');
    expect(html).not.toContain("Sitio de ");
  });

  test("con cuenta aprobada, el sitio entra al JSON-LD y como enlace", async () => {
    const created = companies.create({
      name: "ACME S.A.",
      website: "https://acme.example",
      status: "approved",
    });
    if (!created.ok) throw new Error(created.error);

    const html = await (await get("/empresa/acme-s-a")).text();
    expect(html).toContain('"url":"https://acme.example/"');
    expect(html).toContain('href="https://acme.example/"');
  });

  test("una cuenta sin aprobar no aporta su sitio", async () => {
    const created = companies.create({
      name: "ACME S.A.",
      website: "https://acme.example",
      status: "pending",
    });
    if (!created.ok) throw new Error(created.error);

    const html = await (await get("/empresa/acme-s-a")).text();
    expect(html).not.toContain("acme.example");
  });

  test("una empresa que no existe da 404 en HTML", async () => {
    const response = await get("/empresa/no-existe");
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("No encontramos eso");
  });

  test("un nombre con </script> no rompe el bloque JSON-LD", async () => {
    const html = await (await get(`/empresa/${encodeURIComponent("mala-script-b-x-b")}`)).text();
    expect(html).toContain('"@type":"Organization"');
    expect(html).not.toContain("</script><b>");
    expect(html).toContain("\\u003c/script>");
  });
});

describe("sitemap", () => {
  test("lista las empresas con varias ofertas y deja afuera las de una sola", async () => {
    const xml = await (await get("/sitemap.xml")).text();
    expect(xml).toContain("<loc>https://jobs.test/empresa/acme-s-a</loc>");
    expect(xml).toContain("<loc>https://jobs.test/empresa/pagadora</loc>");
    expect(xml).not.toContain("/empresa/solita");
  });

  test("employerSitemapEntries respeta el mínimo", () => {
    const entries = employerSitemapEntries(JOBS as never);
    expect(entries.map((entry) => entry.path)).toEqual(["/empresa/pagadora", "/empresa/acme-s-a"]);
  });
});

describe("piezas", () => {
  test("employerJobs sigue el mismo grupo que employerProfile, lo más nuevo primero", () => {
    const jobs = JOBS as never;
    const own = employerJobs(jobs, "acme-s-a");
    expect(own.map((entry) => entry.id)).toEqual(["a2", "a1", "a3"]);
    expect(own.length).toBe(employerProfile(jobs, "acme-s-a")?.count ?? -1);
    expect(employerJobs(jobs, "no-existe")).toEqual([]);
  });

  test("safeWebsite solo deja pasar http(s)", () => {
    expect(safeWebsite("https://acme.example")).toBe("https://acme.example/");
    expect(safeWebsite("javascript:alert(1)")).toBeNull();
    expect(safeWebsite("")).toBeNull();
    expect(safeWebsite(undefined)).toBeNull();
  });

  test("employerLd lleva nombre y, solo si hay, sitio", () => {
    expect(employerLd("Acme", null)).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Acme",
    });
    expect(employerLd("Acme", "https://acme.example/").url).toBe("https://acme.example/");
  });

  test("employerPageHtml escapa el nombre en el HTML", () => {
    const profile = employerProfile(JOBS as never, "mala-script-b-x-b");
    if (!profile) throw new Error("falta la empresa del fixture");
    const html = employerPageHtml(profile, employerJobs(JOBS as never, profile.value));
    expect(html).toContain("Mala &lt;/script&gt;&lt;b&gt;x&lt;/b&gt;");
  });

  test("layout escapa < en el JSON-LD", () => {
    const html = layout(
      { title: "t", description: "d", path: "/", jsonLd: { name: "</script>" } },
      "",
    );
    expect(html).toContain('"name":"\\u003c/script>"');
  });
});
