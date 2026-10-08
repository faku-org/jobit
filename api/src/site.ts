import { Elysia } from "elysia";
import { loadFeed, lookupJob } from "./feed.ts";
import { buildMarketReport } from "./market.ts";
import {
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
  rolePageHtml,
} from "./pages.ts";
import type { ContentKind } from "@jobit/worker/content/types";
import { loadContent, queryContent } from "./content.ts";

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
      limit: 60,
      offset: 0,
    }).items;

    if (!categorySlugs().includes(params.slug) || items.length === 0) {
      return htmlResponse(notFoundPage(), 404);
    }

    const feed = await loadFeed();
    const jobs = feed.ok ? jobsByCategory(feed.value, params.slug) : [];
    return htmlResponse(interviewPageHtml(params.slug, jobs, items));
  });
