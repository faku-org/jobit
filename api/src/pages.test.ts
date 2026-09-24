import { describe, expect, test } from "bun:test";
import type { ContentItem } from "@jobit/worker/content/types";
import type { Job } from "./types.ts";
import {
  escapeHtml,
  faqPageLd,
  interviewPageHtml,
  isNativeOffer,
  jobPageHtml,
  jobPostingLd,
  jobsByCategory,
  marketPageHtml,
  notFoundPage,
} from "./pages.ts";
import type { JobsFile } from "./types.ts";
import { buildMarketReport } from "./market.ts";

process.env.PUBLIC_ORIGIN = "https://jobs.test";

const job = (overrides: Partial<Job> = {}): Job => ({
  id: "job-1",
  source: "jobit",
  source_id: "job-1",
  title: "Vendedor de mostrador",
  company: "Acme",
  department: "Montevideo",
  city: "Montevideo",
  category: "ventas",
  category_label: "Ventas y comercial",
  category_raw: "ventas",
  date_posted: "2026-09-01T12:00:00.000Z",
  level: "entry",
  remote: null,
  job_type: "full_time",
  salary: { min: 25_000, max: 30_000, currency: "UYU" },
  experience_years_min: null,
  no_experience: true,
  education_level: null,
  schedule: null,
  vacancies: null,
  closes_at: null,
  description: "Atender al público.\n\nManejar la caja.",
  requirements: null,
  apply_url: "",
  duplicates: [],
  ...overrides,
});

describe("escapeHtml", () => {
  test("neutraliza lo que rompería el documento", () => {
    expect(escapeHtml('<a href="x">&')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;");
  });
});

describe("isNativeOffer", () => {
  test("propia y sin enlace externo: vive acá", () => {
    expect(isNativeOffer(job())).toBe(true);
  });

  test("propia con enlace externo: no vive acá", () => {
    expect(isNativeOffer(job({ apply_url: "https://acme.com/postulate" }))).toBe(false);
  });

  test("scrapeada nunca", () => {
    expect(isNativeOffer(job({ source: "buscojobs", apply_url: "" }))).toBe(false);
  });
});

describe("jobPostingLd", () => {
  test("no marca una oferta scrapeada", () => {
    expect(jobPostingLd(job({ source: "buscojobs" }))).toBeNull();
  });

  test("marca la propia con los campos que Google pide", () => {
    const ld = jobPostingLd(job());
    expect(ld?.["@type"]).toBe("JobPosting");
    expect(ld?.title).toBe("Vendedor de mostrador");
    expect(ld?.datePosted).toBe("2026-09-01");
    expect(ld?.directApply).toBe(true);
    expect(ld?.employmentType).toBe("FULL_TIME");
    expect(ld?.baseSalary).toMatchObject({ currency: "UYU" });
    expect(ld?.jobLocation).toMatchObject({ address: { addressCountry: "UY" } });
  });

  test("la fecha de cierre entra como validThrough", () => {
    const ld = jobPostingLd(job({ closes_at: "2026-10-15" }));
    expect(ld?.validThrough).toBe("2026-10-15T23:59:59-03:00");
  });

  test("sin sueldo no inventa un baseSalary", () => {
    expect(jobPostingLd(job({ salary: null }))?.baseSalary).toBeUndefined();
  });
});

describe("jobPageHtml", () => {
  test("trae el contenido y su canonical", () => {
    const html = jobPageHtml(job());
    expect(html).toContain("<h1>Vendedor de mostrador</h1>");
    expect(html).toContain('rel="canonical" href="https://jobs.test/empleo/job-1"');
    expect(html).toContain("Atender al público.");
  });

  test("una propia lleva el JobPosting", () => {
    expect(jobPageHtml(job())).toContain('"@type":"JobPosting"');
  });

  test("una scrapeada no lo lleva y enlaza al original", () => {
    const html = jobPageHtml(job({ source: "buscojobs", apply_url: "https://x.test/aviso" }));
    expect(html).not.toContain('"@type":"JobPosting"');
    expect(html).toContain("https://x.test/aviso");
  });
});

describe("marketPageHtml", () => {
  test("resume el tablero", () => {
    const file: JobsFile = {
      scraped_at: "2026-09-01",
      sources: ["jobit"],
      count: 1,
      jobs: [job()],
    };
    const html = marketPageHtml(buildMarketReport(file.jobs, file.scraped_at));
    expect(html).toContain("<h1>El mercado laboral uruguayo, ahora</h1>");
    expect(html).toContain("Ventas y comercial");
  });
});

describe("jobsByCategory", () => {
  test("filtra por rubro", () => {
    const file: JobsFile = {
      scraped_at: "2026-09-01",
      sources: [],
      count: 2,
      jobs: [job(), job({ id: "job-2", category: "salud" })],
    };
    expect(jobsByCategory(file, "ventas").map((entry) => entry.id)).toEqual(["job-1"]);
  });
});

describe("notFoundPage", () => {
  test("dice que no está y ofrece volver", () => {
    const html = notFoundPage();
    expect(html).toContain("No encontramos eso");
    expect(html).toContain("https://jobs.test/");
  });
});

const content = (overrides: Partial<ContentItem> = {}): ContentItem => ({
  id: "c1",
  kind: "faq",
  title: "¿Qué es una API?",
  body: "Una forma de que dos programas se hablen.",
  url: null,
  source: "jobit",
  source_label: "JobIt",
  license: null,
  sponsored: false,
  categories: ["tecnologia"],
  roles: [],
  level: null,
  tags: [],
  fetched_at: "2026-09-01",
  ...overrides,
});

describe("faqPageLd", () => {
  test("arma un FAQPage solo con las preguntas", () => {
    const ld = faqPageLd([
      content(),
      content({ id: "c2", kind: "topic", title: "Trabajo en equipo" }),
    ]);
    expect(ld?.["@type"]).toBe("FAQPage");
    const entities = ld?.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
    expect(entities).toHaveLength(1);
    expect(entities[0]?.name).toBe("¿Qué es una API?");
    expect(entities[0]?.acceptedAnswer.text).toContain("dos programas");
  });

  test("sin preguntas no marca nada", () => {
    expect(faqPageLd([content({ kind: "topic" })])).toBeNull();
  });
});

describe("interviewPageHtml", () => {
  test("trae preguntas, temas, FAQPage y enlace a la app", () => {
    const html = interviewPageHtml(
      "tecnologia",
      [job({ category: "tecnologia" })],
      [
        content(),
        content({ id: "c2", kind: "topic", title: "Trabajo en equipo", body: "Importa." }),
      ],
    );

    expect(html).toContain("Preguntas de entrevista de Tecnología en Uruguay");
    expect(html).toContain("¿Qué es una API?");
    expect(html).toContain("Trabajo en equipo");
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain('rel="canonical" href="https://jobs.test/entrevista/tecnologia"');
    expect(html).toContain("https://jobs.test/?category=tecnologia");
    expect(html).toContain("Vendedor de mostrador");
  });

  test("sin ofertas igual sale, sin la sección de avisos", () => {
    const html = interviewPageHtml("tecnologia", [], [content()]);
    expect(html).toContain("Preguntas de entrevista de Tecnología");
    expect(html).not.toContain("Ofertas de Tecnología");
  });
});
