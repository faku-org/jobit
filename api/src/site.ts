import { Elysia } from "elysia";
import * as companies from "./companies.ts";
import { employerPageHtml, employerSitemapEntries, sameEmployerName } from "./employer-page.ts";
import { employerJobs, employerProfile } from "./employers.ts";
import { loadFeed, lookupJob } from "./feed.ts";
import { buildMarketReport } from "./market.ts";
import {
  type SitemapEntry,
  categoryPageHtml,
  categorySlugs,
  departmentPageHtml,
  htmlResponse,
  interviewPageHtml,
  jobPageHtml,
  jobsByCategory,
  jobsByDepartment,
  jobsByRole,
  marketPageHtml,
  notFoundPage,
  publishPageHtml,
  rolePageHtml,
  servicePageHtml,
  sitemapXml,
} from "./pages.ts";
import * as services from "./services.ts";
import type { ContentItem, ContentKind } from "@jobit/worker/content/types";
import { loadContent, queryContent } from "./content.ts";
import {
  resourceCategories,
  resourcesIndexHtml,
  resourcesOf,
  resourcesPageHtml,
} from "./resources.ts";
import { roleGuides, roleInterviewPageHtml } from "./interview.ts";

/**
 * Las direcciones con contenido para un buscador, servidas por la API y puestas
 * delante de la app por nginx. Son documentos HTML sueltos: el navegador que
 * entra a una los lee, y desde ahí salta a la app para la experiencia completa.
 */
export const site = new Elysia()
  .get("/empleo/:id", async ({ params, status }) => {
    const feed = await loadFeed();
    if (!feed.ok) return status(503, { error: "las ofertas no están disponibles" });

    const job = lookupJob(feed.value, params.id);
    return job ? htmlResponse(jobPageHtml(job)) : htmlResponse(notFoundPage(), 404);
  })
  .get("/mercado", async ({ status }) => {
    const feed = await loadFeed();
    if (!feed.ok) return status(503, { error: "las ofertas no están disponibles" });

    return htmlResponse(marketPageHtml(buildMarketReport(feed.value.jobs, feed.value.scraped_at)));
  })
  /** La puerta indexable para quien publica; el panel vive en /empresas. */
  .get("/publicar", () => htmlResponse(publishPageHtml()))
  .get("/rubro/:slug", async ({ params, status }) => {
    const feed = await loadFeed();
    if (!feed.ok) return status(503, { error: "las ofertas no están disponibles" });

    const jobs = jobsByCategory(feed.value, params.slug);
    return jobs.length > 0
      ? htmlResponse(categoryPageHtml(params.slug, jobs))
      : htmlResponse(notFoundPage(), 404);
  })
  .get("/departamento/:slug", async ({ params, status }) => {
    const feed = await loadFeed();
    if (!feed.ok) return status(503, { error: "las ofertas no están disponibles" });

    const jobs = jobsByDepartment(feed.value, params.slug);
    return jobs.length > 0
      ? htmlResponse(departmentPageHtml(params.slug, jobs))
      : htmlResponse(notFoundPage(), 404);
  })
  .get("/puesto/:slug", async ({ params, status }) => {
    const feed = await loadFeed();
    if (!feed.ok) return status(503, { error: "las ofertas no están disponibles" });

    const jobs = jobsByRole(feed.value, params.slug);
    return jobs.length > 0
      ? htmlResponse(rolePageHtml(params.slug, jobs))
      : htmlResponse(notFoundPage(), 404);
  })
  /**
   * La ficha de un servicio. El servicio vive acá, así que su página lleva
   * `Service` y `ProfilePage` en JSON-LD: marcar lo propio es lo que Google
   * premia, al revés que las ofertas, que son de terceros.
   */
  .get("/servicios/:slug", ({ params }) => {
    const service = services.bySlug(params.slug);
    return service && service.status === "published"
      ? htmlResponse(servicePageHtml(service))
      : htmlResponse(notFoundPage(), 404);
  })
  /**
   * El stand de una empresa como página: sale de las mismas ofertas que el
   * de la app. Una empresa que no existe, o sin ofertas, es un 404.
   */
  .get("/empresa/:slug", async ({ params, status }) => {
    const feed = await loadFeed();
    if (!feed.ok) return status(503, { error: "las ofertas no están disponibles" });

    const profile = employerProfile(feed.value.jobs, params.slug);
    const jobs = employerJobs(feed.value.jobs, params.slug);
    if (!profile || jobs.length === 0) return htmlResponse(notFoundPage(), 404);

    const account = companies
      .list({ status: "approved" })
      .find((company) => sameEmployerName(company.name, params.slug));
    return htmlResponse(employerPageHtml(profile, jobs, account?.website));
  })
  /**
   * El sitemap se arma con lo que hay hoy: las direcciones fijas y una entrada
   * por servicio publicado. Es lo que el estático no podía hacer.
   */
  .get("/sitemap.xml", async () => {
    const feed = await loadFeed();
    const content = await loadContent();
    const entries: SitemapEntry[] = [
      { path: "/", changefreq: "daily", priority: 1 },
      { path: "/mercado", changefreq: "daily", priority: 0.8 },
      { path: "/publicar", changefreq: "monthly", priority: 0.6 },
      { path: "/terminos", changefreq: "yearly", priority: 0.2 },
      { path: "/privacidad", changefreq: "yearly", priority: 0.2 },
      ...services.list({ status: "published" }).map((service) => ({
        path: `/servicios/${encodeURIComponent(service.slug)}`,
        lastmod: service.published_at || service.updated_at,
        changefreq: "weekly" as const,
        priority: 0.6,
      })),
      ...categorySlugs().map((slug) => ({
        path: `/entrevista/${encodeURIComponent(slug)}`,
        changefreq: "weekly" as const,
        priority: 0.5,
      })),
      ...(feed.ok ? employerSitemapEntries(feed.value.jobs) : []),
      ...(content.ok ? resourceSitemapEntries(content.value) : []),
      ...(content.ok ? roleGuides(content.value) : []).map((guide) => ({
        path: `/entrevista/${encodeURIComponent(guide.category)}/${encodeURIComponent(guide.role)}`,
        changefreq: "weekly" as const,
        priority: 0.5,
      })),
    ];

    return new Response(sitemapXml(entries), {
      headers: { "content-type": "application/xml; charset=utf-8" },
    });
  })
  /**
   * La guía de entrevista de un rubro. La página es sobre el contenido, no
   * sobre las ofertas: si el rubro no tiene preguntas ni temas, es un 404,
   * aunque haya avisos. Las ofertas son un agregado y van al pie.
   */
  .get("/entrevista/:slug", async ({ params, status }) => {
    const content = await loadContent();
    if (!content.ok) return status(503, { error: "el contenido no está disponible" });

    const items = queryContent(content.value, {
      kinds: new Set<ContentKind>(["faq", "topic"]),
      category: params.slug,
      rubroOnly: true,
      limit: 60,
      offset: 0,
    }).items;

    if (!categorySlugs().includes(params.slug) || items.length === 0) {
      return htmlResponse(notFoundPage(), 404);
    }

    const feed = await loadFeed();
    const jobs = feed.ok ? jobsByCategory(feed.value, params.slug) : [];
    const guides = roleGuides(content.value).filter((guide) => guide.category === params.slug);
    return htmlResponse(interviewPageHtml(params.slug, jobs, items, guides));
  })
  /**
   * La guía de un puesto, un nivel debajo de la del rubro. Existe solo para un
   * par rubro/puesto con contenido propio: el puesto se valida contra el
   * catálogo de roles y el 404 cubre tanto un puesto inventado como uno real
   * que todavía no tiene preguntas.
   */
  .get("/entrevista/:slug/:role", async ({ params, status }) => {
    const content = await loadContent();
    if (!content.ok) return status(503, { error: "el contenido no está disponible" });

    const items = queryContent(content.value, {
      kinds: new Set<ContentKind>(["faq", "topic"]),
      category: params.slug,
      role: params.role,
      limit: 60,
      offset: 0,
    }).items;

    const known = roleGuides(content.value).some(
      (guide) => guide.category === params.slug && guide.role === params.role,
    );
    if (!known || items.length === 0) return htmlResponse(notFoundPage(), 404);

    const feed = await loadFeed();
    const jobs = feed.ok ? jobsByRole(feed.value, params.role) : [];
    return htmlResponse(roleInterviewPageHtml(params.slug, params.role, jobs, items));
  })
  /**
   * Los recursos por rubro. Como la guía de entrevista: sin recursos, 404.
   * Los enlaces salen con `rel` según `sponsored` (ver `resources.ts`).
   */
  .get("/recursos", async ({ status }) => {
    const content = await loadContent();
    if (!content.ok) return status(503, { error: "el contenido no está disponible" });
    return htmlResponse(resourcesIndexHtml(content.value));
  })
  .get("/recursos/:slug", async ({ params, status }) => {
    const content = await loadContent();
    if (!content.ok) return status(503, { error: "el contenido no está disponible" });

    const items = resourcesOf(content.value, params.slug);
    if (!categorySlugs().includes(params.slug) || items.length === 0) {
      return htmlResponse(notFoundPage(), 404);
    }

    const hasInterview =
      queryContent(content.value, {
        kinds: new Set<ContentKind>(["faq", "topic"]),
        category: params.slug,
        limit: 1,
        offset: 0,
      }).total > 0;
    return htmlResponse(resourcesPageHtml(params.slug, items, hasInterview));
  });

/** El índice de recursos y una entrada por rubro que tenga recursos. */
function resourceSitemapEntries(items: ContentItem[]): SitemapEntry[] {
  return [
    { path: "/recursos", changefreq: "weekly", priority: 0.5 },
    ...resourceCategories(items).map((slug) => ({
      path: `/recursos/${encodeURIComponent(slug)}`,
      changefreq: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
