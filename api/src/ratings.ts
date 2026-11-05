import { Elysia, t } from "elysia";
import * as queue from "./queue.ts";
import { REPORT_REASONS } from "./queue.ts";
import * as reviews from "./reviews.ts";
import { MAX_RATING, MIN_RATING } from "./reviews.ts";
import * as services from "./services.ts";
import { type CookieJar, sessionToken } from "./session.ts";
import * as users from "./users.ts";

/**
 * La calificación: leerla no pide nada, escribirla pide cuenta. Las dos cosas
 * viven juntas acá porque son la misma pieza; lo que cambia es de qué lado del
 * guard queda cada ruta.
 *
 * Calificar no es "lo propio": el dueño del servicio no es quien escribe y por
 * eso no está en publish.ts, donde el `user_id` siempre va en el WHERE.
 */
const reviewBody = t.Object({
  rating: t.Number({ minimum: MIN_RATING, maximum: MAX_RATING }),
  comment: t.Optional(t.String({ maxLength: 2000 })),
});

const reasonBody = t.Object({
  reason: t.Union(REPORT_REASONS.map((value) => t.Literal(value))),
});

/** El que no existe y el de otra persona contestan lo mismo. */
const notFound = "esa calificación no existe";

const published = (slug: string): services.Service | null => {
  const service = services.bySlug(slug);
  return service && service.status === "published" ? service : null;
};

export const ratings = new Elysia()
  /**
   * Lo que se ve en la ficha. `mine` viaja solo cuando hay sesión: es lo que
   * le deja a quien ya calificó ver su propia nota aunque la moderación la
   * haya bajado, sin tener que pedir otra ruta.
   */
  .get("/api/services/:slug/reviews", ({ cookie, params, status }) => {
    const service = published(params.slug);
    if (!service) return status(404, { error: "ese servicio no existe" });

    const me = users.sessionUser(sessionToken(cookie as CookieJar));
    const mine = me ? reviews.mineFor(service.id, me.id) : null;

    return {
      reviews: reviews.listFor(service.id).map(reviews.publicView),
      summary: { average: service.rating_avg, count: service.rating_count },
      mine: mine ? reviews.publicView(mine) : null,
      /** Para que la ficha sepa si mostrar el formulario antes de que alguien
       * escriba algo y se coma un 422. */
      can_review: me ? me.id !== service.user_id : null,
      is_owner: me ? me.id === service.user_id : false,
    };
  })
  /** Denunciar una calificación no pide cuenta, como denunciar un servicio. */
  .post(
    "/api/reviews/:id/report",
    ({ body, params, status }) =>
      queue.reportReview(params.id, body.reason)
        ? { status: "ok" }
        : status(404, { error: notFound }),
    { body: reasonBody },
  )
  /** De acá para abajo hace falta la sesión. */
  .guard({
    beforeHandle({ cookie, status }) {
      if (!users.sessionUser(sessionToken(cookie as CookieJar))) {
        return status(401, { error: "no hay sesión" });
      }
    },
  })
  .derive(({ cookie }) => ({
    /** El guard de arriba ya se aseguró de que exista. */
    me: users.sessionUser(sessionToken(cookie as CookieJar)) as users.User,
  }))
  .post(
    "/api/services/:slug/reviews",
    ({ body, me, params, status }) => {
      const service = published(params.slug);
      if (!service) return status(404, { error: "ese servicio no existe" });

      const created = reviews.create(service.id, me.id, body);
      return created.ok
        ? status(201, reviews.publicView(created.value))
        : status(422, { error: created.error });
    },
    { body: reviewBody },
  )
  .patch(
    "/api/reviews/:id",
    ({ body, me, params, status }) => {
      const updated = reviews.update(params.id, me.id, body);
      if (updated.ok) return reviews.publicView(updated.value);

      return updated.error === notFound
        ? status(404, { error: updated.error })
        : status(422, { error: updated.error });
    },
    { body: reviewBody },
  )
  .delete("/api/reviews/:id", ({ me, params, status }) =>
    reviews.remove(params.id, me.id) ? { status: "ok" } : status(404, { error: notFound }),
  )
  /** La respuesta de quien publica, una sola. */
  .post(
    "/api/reviews/:id/reply",
    ({ body, me, params, status }) => {
      const answered = reviews.reply(params.id, me.id, body.text);
      if (answered.ok) return reviews.publicView(answered.value);

      return answered.error === notFound
        ? status(404, { error: answered.error })
        : status(422, { error: answered.error });
    },
    { body: t.Object({ text: t.String({ maxLength: 2000 }) }) },
  );
