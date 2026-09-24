import { Elysia } from "elysia";
import { loadFeed, lookupJob } from "./feed.ts";
import { buildMarketReport } from "./market.ts";
import {
  type SitemapEntry,
  categoryPageHtml,
  departmentPageHtml,
  htmlResponse,
  jobPageHtml,
  jobsByCategory,
  jobsByDepartment,
  jobsByRole,
  marketPageHtml,
  notFoundPage,
  rolePageHtml,
  servicePageHtml,
  sitemapXml,
} from "./pages.ts";
import * as services from "./services.ts";

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
   * El sitemap se arma con lo que hay hoy: las direcciones fijas y una entrada
   * por servicio publicado. Es lo que el estático no podía hacer.
   */
  .get("/sitemap.xml", () => {
    const entries: SitemapEntry[] = [
      { path: "/", changefreq: "daily", priority: 1 },
      { path: "/mercado", changefreq: "daily", priority: 0.8 },
      { path: "/terminos", changefreq: "yearly", priority: 0.2 },
      { path: "/privacidad", changefreq: "yearly", priority: 0.2 },
      ...services.list({ status: "published" }).map((service) => ({
        path: `/servicios/${encodeURIComponent(service.slug)}`,
        lastmod: service.published_at || service.updated_at,
        changefreq: "weekly" as const,
        priority: 0.6,
      })),
    ];

    return new Response(sitemapXml(entries), {
      headers: { "content-type": "application/xml; charset=utf-8" },
    });
  });
