import { CATEGORIES, categoryLabel } from "@jobit/worker/categories";
import { ROLES, roleOf } from "@jobit/worker/roles";
import { type MarketReport, buildMarketReport } from "./market.ts";
import { loadFeed, lookupJob } from "./feed.ts";
import type { Service } from "./services.ts";
import type { Job, JobsFile } from "./types.ts";

/**
 * Las páginas que un buscador puede leer sin ejecutar JavaScript.
 *
 * La app es una sola URL con query params, así que un scraper de WhatsApp o
 * LinkedIn solo ve la portada, y Google con suerte ve "Bienvenido a JobIt". Acá
 * cada cosa que se busca con intención alta tiene su dirección con contenido
 * real: la ficha de una oferta, el mercado, y los agregados por rubro,
 * departamento y puesto.
 *
 * Son documentos sueltos, sin React: el mismo patrón que /terminos y
 * /privacidad. La app sigue siendo la experiencia; esto es lo que se indexa y lo
 * que se previsualiza cuando alguien comparte un enlace.
 */
const DEFAULT_ORIGIN = "https://jobs.wefaber.net";

export const publicOrigin = (): string =>
  (process.env.PUBLIC_ORIGIN ?? DEFAULT_ORIGIN).replace(/\/+$/, "");

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const STYLE = `
:root { color-scheme: light dark; --ink:#0f172a; --muted:#5b6b82; --line:#dbe4ef; --sky:#7cc4f0; --mist:#eef5fb; --bg:#f7fafc; }
@media (prefers-color-scheme: dark) { :root { --ink:#e8eef6; --muted:#9fb0c6; --line:#233247; --mist:#132033; --bg:#0a1220; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
a { color:inherit; }
.wrap { max-width:44rem; margin:0 auto; padding:1.5rem 1.25rem 4rem; }
header.brand { display:flex; align-items:center; gap:.6rem; padding:1rem 1.25rem; border-bottom:1px solid var(--line); }
header.brand a { font-weight:700; text-decoration:none; letter-spacing:-.01em; }
h1 { font-size:1.6rem; line-height:1.25; letter-spacing:-.02em; margin:1.5rem 0 .5rem; }
h2 { font-size:1.1rem; margin:2rem 0 .5rem; }
p { color:var(--ink); }
.muted { color:var(--muted); font-size:.85rem; }
.chips { display:flex; flex-wrap:wrap; gap:.4rem; margin:.75rem 0 1rem; }
.chip { border:1px solid var(--line); border-radius:999px; padding:.15rem .6rem; font-size:.75rem; color:var(--muted); }
.cta { display:inline-block; background:var(--sky); color:#0f172a; font-weight:600; text-decoration:none; border-radius:.75rem; padding:.6rem 1rem; margin:.5rem .5rem .5rem 0; }
.cta.ghost { background:transparent; color:var(--ink); border:1px solid var(--line); }
ul.jobs { list-style:none; padding:0; margin:1rem 0; }
ul.jobs li { border-top:1px solid var(--line); padding:.9rem 0; }
ul.jobs a { font-weight:600; text-decoration:none; }
ul.jobs .where { color:var(--muted); font-size:.85rem; }
table { width:100%; border-collapse:collapse; font-size:.9rem; }
td,th { text-align:left; padding:.35rem .5rem; border-bottom:1px solid var(--line); }
footer { border-top:1px solid var(--line); padding:1.25rem; }
footer nav { display:flex; flex-wrap:wrap; gap:1rem; font-size:.85rem; }
`;

export interface PageMeta {
  title: string;
  description: string;
  path: string;
  /** Uno o varios bloques JSON-LD: una ficha puede marcar el servicio y, con
   * el mismo proveedor, quién está atrás. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[] | null;
}

export function layout(meta: PageMeta, body: string): string {
  const origin = publicOrigin();
  const url = `${origin}${meta.path}`;
  const blocks = meta.jsonLd
    ? Array.isArray(meta.jsonLd)
      ? meta.jsonLd
      : [meta.jsonLd]
    : [];
  const jsonLd = blocks
    .map((block) => `<script type="application/ld+json">${JSON.stringify(block)}</script>`)
    .join("");

  return `<!doctype html>
<html lang="es-UY">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escapeHtml(meta.title)}</title>
<meta name="description" content="${escapeHtml(meta.description)}"/>
<link rel="canonical" href="${escapeHtml(url)}"/>
<meta name="robots" content="index, follow, max-image-preview:large"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="JobIt"/>
<meta property="og:locale" content="es_UY"/>
<meta property="og:url" content="${escapeHtml(url)}"/>
<meta property="og:title" content="${escapeHtml(meta.title)}"/>
<meta property="og:description" content="${escapeHtml(meta.description)}"/>
<meta property="og:image" content="${escapeHtml(origin)}/og.png"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(meta.title)}"/>
<meta name="twitter:description" content="${escapeHtml(meta.description)}"/>
<link rel="icon" type="image/png" href="/logo.png"/>
${jsonLd}
<style>${STYLE}</style>
</head>
<body>
<header class="brand"><a href="${escapeHtml(origin)}/">JobIt</a><span class="muted">Ofertas de trabajo en Uruguay</span></header>
<main class="wrap">
${body}
</main>
<footer>
<nav>
<a href="${escapeHtml(origin)}/">Buscar ofertas</a>
<a href="${escapeHtml(origin)}/mercado">Mercado</a>
<a href="${escapeHtml(origin)}/terminos">Términos</a>
<a href="${escapeHtml(origin)}/privacidad">Privacidad</a>
</nav>
</footer>
</body>
</html>`;
}

const htmlResponse = (body: string, status = 200): Response =>
  new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });

const dateLabel = (value: string | null): string => {
  if (!value) return "";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toLocaleDateString("es-UY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const salaryLabel = (job: Job): string => {
  if (!job.salary) return "";
  const { min, max, currency } = job.salary;
  if (min === null && max === null) return "";
  const format = (value: number): string => new Intl.NumberFormat("es-UY").format(value);
  const range =
    min !== null && max !== null
      ? `${format(min)} – ${format(max)}`
      : format((min ?? max) as number);
  return `${range} ${currency} por mes`;
};

/**
 * Una oferta marcada como propia solo cuando vive acá: es el caso en el que
 * Google acepta —y premia— un `JobPosting`. Si enlaza a otro lado, marcarla
 * sería lo que sanciona a los agregadores, así que no se marca.
 */
export const isNativeOffer = (job: Job): boolean =>
  job.source === "jobit" && job.apply_url.trim() === "";

const EMPLOYMENT_TYPE: Record<string, string> = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  internship: "INTERN",
};

export function jobPostingLd(job: Job): Record<string, unknown> | null {
  if (!isNativeOffer(job)) return null;

  const address = {
    "@type": "PostalAddress",
    addressLocality: job.city ?? job.department ?? "Montevideo",
    addressRegion: job.department ?? "",
    addressCountry: "UY",
  };

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description || job.requirements || job.title,
    datePosted: job.date_posted.slice(0, 10),
    hiringOrganization: { "@type": "Organization", name: job.company ?? "JobIt" },
    jobLocation: { "@type": "Place", address },
    directApply: true,
    url: `${publicOrigin()}/empleo/${encodeURIComponent(job.id)}`,
  };

  if (job.closes_at) ld.validThrough = `${job.closes_at}T23:59:59-03:00`;
  const employmentType = job.job_type ? EMPLOYMENT_TYPE[job.job_type] : undefined;
  if (employmentType) ld.employmentType = employmentType;

  if (job.salary) {
    ld.baseSalary = {
      "@type": "MonetaryAmount",
      currency: job.salary.currency || "UYU",
      value: {
        "@type": "QuantitativeValue",
        ...(job.salary.min !== null ? { minValue: job.salary.min } : {}),
        ...(job.salary.max !== null ? { maxValue: job.salary.max } : {}),
        unitText: "MONTH",
      },
    };
  }

  return ld;
}

function jobChips(job: Job): string {
  const chips = [
    job.category_label,
    job.department ?? "",
    job.remote === "remote" ? "Remoto" : job.remote === "hybrid" ? "Híbrido" : "",
    job.level === "entry" ? "Junior" : job.level === "mid" ? "Semi senior" : job.level === "senior" ? "Senior" : "",
    job.job_type === "part_time" ? "Medio horario" : job.job_type === "internship" ? "Pasantía" : "",
    job.no_experience ? "Sin experiencia" : "",
  ].filter(Boolean);

  return `<div class="chips">${chips
    .map((label) => `<span class="chip">${escapeHtml(label)}</span>`)
    .join("")}</div>`;
}

const paragraphs = (text: string): string =>
  text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br/>")}</p>`)
    .join("");

export function jobPageHtml(job: Job): string {
  const title = job.company ? `${job.title} · ${job.company}` : `${job.title} · JobIt`;
  const where = [job.city, job.department].filter(Boolean).join(", ") || "Uruguay";
  const pay = salaryLabel(job);
  const description = job.description.replace(/\s+/g, " ").trim().slice(0, 155);
  const meta: PageMeta = {
    title,
    description: `${job.title} en ${where}.${pay ? ` ${pay}.` : ""} ${description}`.slice(0, 300),
    path: `/empleo/${encodeURIComponent(job.id)}`,
    jsonLd: jobPostingLd(job),
  };

  const body = `
<article>
<h1>${escapeHtml(job.title)}</h1>
<p class="muted">${escapeHtml(job.company ?? "JobIt")} · ${escapeHtml(where)}${job.date_posted ? ` · Publicada el ${dateLabel(job.date_posted)}` : ""}</p>
${jobChips(job)}
${pay ? `<p><strong>${escapeHtml(pay)}</strong></p>` : ""}
${job.closes_at ? `<p class="muted">Cierra el ${dateLabel(job.closes_at)}</p>` : ""}
${job.apply_url ? `<a class="cta" href="${escapeHtml(job.apply_url)}" rel="noopener nofollow" target="_blank">Postularme en el aviso original</a>` : `<a class="cta" href="${escapeHtml(publicOrigin())}/?job=${encodeURIComponent(job.id)}">Abrir en JobIt y postularme</a>`}
<a class="cta ghost" href="${escapeHtml(publicOrigin())}/?job=${encodeURIComponent(job.id)}">Ver en JobIt</a>
<h2>Descripción</h2>
${job.description ? paragraphs(job.description) : "<p>La fuente no publicó una descripción.</p>"}
${job.requirements ? `<h2>Requisitos</h2>${paragraphs(job.requirements)}` : ""}
</article>
<p class="muted">JobIt reúne avisos de portales uruguayos y llamados del Estado, y siempre enlaza al aviso original.</p>`;

  return layout(meta, body);
}

/* --- Servicios ------------------------------------------------------------- */

const PRICE_UNIT_TEXT: Record<string, string> = {
  hora: "por hora",
  jornada: "por jornada",
  semana: "por semana",
  mes: "por mes",
  proyecto: "por proyecto",
  unidad: "por unidad",
};

const MODE_LABEL: Record<string, string> = {
  onsite: "Presencial",
  remote: "Remoto",
  hybrid: "Híbrido",
};

const WEEKDAY_LABEL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const serviceKind = (service: Service): string =>
  [categoryLabel(service.category), MODE_LABEL[service.remote] ?? "", service.department]
    .filter(Boolean)
    .join(" · ");

export const serviceLocation = (service: Service): string =>
  [service.city, service.department].filter(Boolean).join(", ") || "Uruguay";

const formatAmount = (amount: number): string => new Intl.NumberFormat("es-UY").format(amount);

const priceText = (price: Service["prices"][number]): string => {
  const unit = price.unit ? ` ${PRICE_UNIT_TEXT[price.unit] ?? `por ${price.unit}`}` : "";
  return `${formatAmount(price.amount)} ${price.currency}${unit}`;
};

/**
 * El `Service` vive acá, así que marcarlo es legítimo —al contrario de las
 * ofertas, que son de terceros—. `AggregateRating` solo entra con votos de
 * verdad: marcarlo con cero, o con uno solo, es lo que Google castiga.
 */
export function serviceJsonLd(service: Service): Record<string, unknown>[] {
  const origin = publicOrigin();
  const url = `${origin}/servicios/${encodeURIComponent(service.slug)}`;
  const provider: Record<string, unknown> = {
    "@type": "Person",
    name: service.owner_name,
    alternateName: service.owner_handle,
    url,
  };

  const base = service.prices.filter((price) => price.kind === "base");
  const listed = base.length > 0 ? base : service.prices;
  const offers = listed.map((price) => ({
    "@type": "Offer",
    price: price.amount,
    priceCurrency: price.currency,
    ...(price.label ? { name: price.label } : {}),
  }));

  const where = [service.city, service.department].filter(Boolean).join(", ");
  const marked: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    description: service.description || service.summary || service.title,
    url,
    serviceType: categoryLabel(service.category),
    provider,
    ...(where ? { areaServed: { "@type": "Place", name: where } } : {}),
    ...(offers.length > 0 ? { offers: offers.length === 1 ? offers[0] : offers } : {}),
  };

  if (service.rating_count >= 2) {
    marked.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: service.rating_avg,
      ratingCount: service.rating_count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  const profile: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url,
    dateCreated: service.created_at.slice(0, 10),
    dateModified: (service.published_at || service.updated_at).slice(0, 10),
    mainEntity: provider,
  };

  return [marked, profile];
}

export function servicePageHtml(service: Service): string {
  const origin = publicOrigin();
  const where = serviceLocation(service);
  const kind = serviceKind(service);
  const base = service.prices.filter((price) => price.kind === "base");
  const extras = service.prices.filter((price) => price.kind === "extra");
  const rating =
    service.rating_count > 0
      ? `${service.rating_avg.toFixed(1)} de 5 · ${service.rating_count} ${
          service.rating_count === 1 ? "calificación" : "calificaciones"
        }`
      : "Todavía sin calificaciones";
  const description = (service.description || service.summary || service.title)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 155);

  const meta: PageMeta = {
    title: `${service.title} · ${service.owner_name} · JobIt`,
    description: `${service.title} en ${where}. ${description}`.slice(0, 300),
    path: `/servicios/${encodeURIComponent(service.slug)}`,
    jsonLd: serviceJsonLd(service),
  };

  const priceRows = (prices: Service["prices"]): string =>
    prices
      .map(
        (price) =>
          `<tr><td>${escapeHtml(price.label || "Precio")}${
            price.notes ? `<br/><span class="muted">${escapeHtml(price.notes)}</span>` : ""
          }</td><td>${escapeHtml(priceText(price))}</td></tr>`,
      )
      .join("");

  const hours = service.hours
    .slice()
    .sort((a, b) => a.weekday - b.weekday || a.from.localeCompare(b.from))
    .map(
      (hour) =>
        `<tr><td>${escapeHtml(WEEKDAY_LABEL[hour.weekday] ?? "")}</td><td>${escapeHtml(
          `${hour.from} a ${hour.to}`,
        )}</td></tr>`,
    )
    .join("");

  const body = `
<article>
<h1>${escapeHtml(service.title)}</h1>
<p class="muted">${escapeHtml(service.owner_name)} · ${escapeHtml(where)}</p>
<div class="chips">${[kind, rating].filter(Boolean).map((label) => `<span class="chip">${escapeHtml(label)}</span>`).join("")}</div>
${service.summary ? `<p>${escapeHtml(service.summary)}</p>` : ""}
<a class="cta" href="${escapeHtml(origin)}/?service=${encodeURIComponent(service.slug)}">Ver en JobIt</a>
${
  base.length > 0
    ? `<h2>Precios</h2><table><tbody>${priceRows(base)}</tbody></table>${
        service.fixed_price
          ? ""
          : `<p class="muted">Los precios son de referencia: se terminan de acordar con la persona.</p>`
      }`
    : ""
}
${extras.length > 0 ? `<h2>Extras</h2><table><tbody>${priceRows(extras)}</tbody></table>` : ""}
${
  service.skills.length > 0
    ? `<h2>Habilidades</h2><div class="chips">${service.skills
        .map((skill) => `<span class="chip">${escapeHtml(skill)}</span>`)
        .join("")}</div>`
    : ""
}
<h2>Qué hace</h2>
${service.description ? paragraphs(service.description) : `<p>${escapeHtml(service.summary || service.title)}</p>`}
${hours ? `<h2>Horarios</h2><table><tbody>${hours}</tbody></table>` : ""}
${
  service.availability_note
    ? `<p class="muted">${escapeHtml(service.availability_note)}</p>`
    : ""
}
</article>
<p class="muted">JobIt no guarda datos de contacto de quien publica: el contacto se arregla adentro.</p>`;

  return layout(meta, body);
}

export interface SitemapEntry {
  path: string;
  /** El día, no el momento. */
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: number;
}

export function sitemapXml(entries: SitemapEntry[]): string {
  const origin = publicOrigin();
  const urls = entries
    .map((entry) => {
      const lastmod = entry.lastmod
        ? `<lastmod>${escapeHtml(entry.lastmod.slice(0, 10))}</lastmod>`
        : "";
      const changefreq = entry.changefreq ? `<changefreq>${entry.changefreq}</changefreq>` : "";
      const priority = entry.priority !== undefined ? `<priority>${entry.priority}</priority>` : "";
      return `<url><loc>${escapeHtml(`${origin}${entry.path}`)}</loc>${lastmod}${changefreq}${priority}</url>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

export function listPageHtml(options: {
  title: string;
  description: string;
  path: string;
  intro: string;
  jobs: Job[];
  appQuery: string;
}): string {
  const { jobs } = options;
  const items = jobs
    .slice(0, 100)
    .map((job) => {
      const where = [job.city, job.department].filter(Boolean).join(", ") || "Uruguay";
      return `<li><a href="${escapeHtml(publicOrigin())}/empleo/${encodeURIComponent(job.id)}">${escapeHtml(job.title)}</a><div class="where">${escapeHtml(job.company ?? "JobIt")} · ${escapeHtml(where)}</div></li>`;
    })
    .join("");

  const body = `
<h1>${escapeHtml(options.title)}</h1>
<p>${escapeHtml(options.intro)}</p>
<a class="cta" href="${escapeHtml(publicOrigin())}/${options.appQuery}">Ver y filtrar en JobIt</a>
<ul class="jobs">${items}</ul>
<p class="muted">${jobs.length} ofertas${jobs.length > 100 ? " (mostrando las primeras 100)" : ""}.</p>`;

  return layout({ title: options.title, description: options.description, path: options.path }, body);
}

export function marketPageHtml(report: MarketReport): string {
  const rows = (entries: { label: string; count: number }[]): string =>
    entries
      .slice(0, 15)
      .map((entry) => `<tr><td>${escapeHtml(entry.label)}</td><td>${entry.count}</td></tr>`)
      .join("");

  const body = `
<h1>El mercado laboral uruguayo, ahora</h1>
<p>Un resumen de las <strong>${report.count}</strong> ofertas que JobIt tiene publicadas, sin nada de quien pregunta. Se rearma con cada scrapeo.</p>
<h2>Puestos más pedidos</h2>
<table><tbody>${rows(report.roles.map((role) => ({ label: role.label, count: role.count })))}</tbody></table>
<h2>Rubros con más ofertas</h2>
<table><tbody>${rows(report.categories.map((category) => ({ label: category.label, count: category.count })))}</tbody></table>
<h2>Departamentos</h2>
<table><tbody>${rows(report.departments.map((entry) => ({ label: entry.value, count: entry.count })))}</tbody></table>
<h2>Habilidades más pedidas</h2>
<table><tbody>${rows(report.skills.map((skill) => ({ label: skill.label, count: skill.count })))}</tbody></table>
<p class="muted">Actualizado el ${dateLabel(report.scraped_at)}.</p>`;

  return layout(
    {
      title: "Mercado laboral en Uruguay · JobIt",
      description:
        "Totales, puestos, rubros y departamentos con más ofertas en Uruguay, armado con las ofertas publicadas en JobIt.",
      path: "/mercado",
    },
    body,
  );
}

export const notFoundPage = (): string =>
  layout(
    {
      title: "No encontramos eso · JobIt",
      description: "La página o la oferta no existe o ya no está publicada.",
      path: "/",
    },
    `<h1>No encontramos eso</h1><p>La página o la oferta no existe, o ya no está publicada.</p><a class="cta" href="${escapeHtml(publicOrigin())}/">Volver a las ofertas</a>`,
  );

const feedJobs = (feed: JobsFile, predicate: (job: Job) => boolean): Job[] =>
  feed.jobs.filter(predicate);

export const jobsByCategory = (feed: JobsFile, slug: string): Job[] =>
  feedJobs(feed, (job) => job.category === slug);

export const jobsByDepartment = (feed: JobsFile, department: string): Job[] =>
  feedJobs(feed, (job) => job.department === department);

export const jobsByRole = (feed: JobsFile, slug: string): Job[] =>
  feedJobs(feed, (job) => roleOf(job.title)?.slug === slug);

export const categoryPageHtml = (slug: string, jobs: Job[]): string =>
  listPageHtml({
    title: `Ofertas en ${categoryLabel(slug)}`,
    description: `Todas las ofertas de ${categoryLabel(slug)} publicadas en JobIt, actualizadas con cada scrapeo.`,
    path: `/rubro/${encodeURIComponent(slug)}`,
    intro: `Estas son las ofertas de ${categoryLabel(slug)} que hay hoy en el tablero.`,
    jobs,
    appQuery: `?category=${encodeURIComponent(slug)}`,
  });

export const departmentPageHtml = (department: string, jobs: Job[]): string =>
  listPageHtml({
    title: `Ofertas de trabajo en ${department}`,
    description: `Ofertas de trabajo en ${department}, Uruguay, reunidas en JobIt y actualizadas con cada scrapeo.`,
    path: `/departamento/${encodeURIComponent(department)}`,
    intro: `Estas son las ofertas publicadas para ${department}.`,
    jobs,
    appQuery: `?department=${encodeURIComponent(department)}`,
  });

export const rolePageHtml = (slug: string, jobs: Job[]): string => {
  const label = ROLES.find((role) => role.slug === slug)?.label ?? slug;
  return listPageHtml({
    title: `Ofertas de ${label}`,
    description: `Ofertas de ${label} en Uruguay, reunidas en JobIt.`,
    path: `/puesto/${encodeURIComponent(slug)}`,
    intro: `Estas son las ofertas para ${label} que hay hoy.`,
    jobs,
    appQuery: `?q=${encodeURIComponent(label)}`,
  });
};

export const categorySlugs = (): string[] => CATEGORIES.map((category) => category.slug);
export { buildMarketReport };
export { loadFeed, lookupJob };
export { htmlResponse };
