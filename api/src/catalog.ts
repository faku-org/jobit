import { Elysia, t } from "elysia";
import { usdRate } from "./fx.ts";
import * as queue from "./queue.ts";
import { REPORT_REASONS } from "./queue.ts";
import * as services from "./services.ts";
import { CURRENCIES, SERVICE_SORTS, WORK_MODES } from "./services.ts";

/**
 * Lo público de los servicios: la lista, la ficha, las facetas y la vía de
 * denuncia. Nada de acá pide sesión y nada de acá muestra lo que no está
 * publicado.
 */
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;
const MAX_RATING = 5;

const literals = (values: readonly string[]) => t.Union(values.map((value) => t.Literal(value)));

const listQuery = t.Object({
  q: t.Optional(t.String({ maxLength: 120 })),
  category: t.Optional(t.String({ maxLength: 60 })),
  department: t.Optional(t.String({ maxLength: 120 })),
  remote: t.Optional(literals(WORK_MODES)),
  price_min: t.Optional(t.Numeric({ minimum: 0 })),
  price_max: t.Optional(t.Numeric({ minimum: 0 })),
  currency: t.Optional(literals(CURRENCIES)),
  rating_min: t.Optional(t.Numeric({ minimum: 0, maximum: MAX_RATING })),
  sort: t.Optional(literals(SERVICE_SORTS)),
  limit: t.Optional(t.Numeric()),
  offset: t.Optional(t.Numeric()),
});

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const catalog = new Elysia()
  .get(
    "/api/services",
    ({ query }) => {
      const rate = usdRate();
      const page = services.search(
        {
          q: query.q,
          category: query.category,
          department: query.department,
          remote: query.remote,
          price_min: query.price_min,
          price_max: query.price_max,
          currency: query.currency,
          rating_min: query.rating_min,
          sort: query.sort,
          limit: clamp(Math.floor(query.limit ?? DEFAULT_LIMIT), 1, MAX_LIMIT),
          offset: Math.max(Math.floor(query.offset ?? 0), 0),
        },
        rate?.usd_uyu ?? null,
      );

      /** La tasa viaja con la lista: quien ordena por precio tiene que poder
       * decir de cuándo es y que es aproximada. */
      return { ...page, services: page.services.map(services.publicView), rate };
    },
    { query: listQuery },
  )
  /** Las facetas de los filtros, contadas sobre lo publicado. */
  .get("/api/services/meta", () => services.meta())
  .get("/api/services/:slug", ({ params, status }) => {
    const service = services.bySlug(params.slug);
    return service && service.status === "published"
      ? services.publicView(service)
      : status(404, { error: "ese servicio no existe" });
  })
  /**
   * Denunciar no pide cuenta y no guarda quién fue: un motivo de una lista
   * corta y el día, que es lo que hace falta para que alguien lo mire.
   */
  .post(
    "/api/services/:slug/report",
    ({ body, params, status }) => {
      const service = services.bySlug(params.slug);
      if (!service || service.status !== "published") {
        return status(404, { error: "ese servicio no existe" });
      }

      queue.report(service.id, body.reason);
      return { status: "ok" };
    },
    { body: t.Object({ reason: literals(REPORT_REASONS) }) },
  );
