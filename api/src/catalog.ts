import { Elysia, t } from "elysia";
import * as queue from "./queue.ts";
import { REPORT_REASONS } from "./queue.ts";
import * as services from "./services.ts";

/**
 * Lo público de los servicios: lo que se ve sin sesión. Por ahora, la vía de
 * denuncia desde la ficha, que alimenta la misma cola que la moderación
 * previa.
 *
 * Denunciar no pide cuenta y no guarda quién fue: un motivo de una lista corta
 * y el día, que es lo que hace falta para que alguien lo mire.
 */
export const catalog = new Elysia().post(
  "/api/services/:slug/report",
  ({ body, params, status }) => {
    const service = services.bySlug(params.slug);
    if (!service || service.status !== "published") {
      return status(404, { error: "ese servicio no existe" });
    }

    queue.report(service.id, body.reason);
    return { status: "ok" };
  },
  {
    body: t.Object({
      reason: t.Union(REPORT_REASONS.map((value) => t.Literal(value))),
    }),
  },
);
