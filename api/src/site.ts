import { Elysia } from "elysia";
import { loadFeed, lookupJob } from "./feed.ts";
import { buildMarketReport } from "./market.ts";
import {
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
} from "./pages.ts";

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
  });
