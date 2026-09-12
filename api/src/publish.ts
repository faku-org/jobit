import { Elysia, t } from "elysia";
import * as services from "./services.ts";
import {
  CURRENCIES,
  MAX_SERVICES_PER_USER,
  OWNER_STATUSES,
  PRICE_KINDS,
  PRICE_UNITS,
  RESPONSE_TIMES,
  WORK_MODES,
  WORK_STYLES,
} from "./services.ts";
import { type CookieJar, sessionToken } from "./session.ts";
import * as users from "./users.ts";

/**
 * Lo que hace quien publica con lo suyo. Todo pide sesión y todo mira al
 * dueño: el `user_id` va en el WHERE y no en un `if` de más arriba.
 *
 * Lo público (la lista, la ficha, las facetas) no vive acá.
 */
const literals = (values: readonly string[]) => t.Union(values.map((value) => t.Literal(value)));

const priceSchema = t.Object({
  kind: t.Optional(literals(PRICE_KINDS)),
  label: t.Optional(t.String({ maxLength: 120 })),
  amount: t.Number(),
  currency: literals(CURRENCIES),
  unit: t.Optional(literals(PRICE_UNITS)),
  notes: t.Optional(t.String({ maxLength: 400 })),
});

const hourSchema = t.Object({
  weekday: t.Number({ minimum: 0, maximum: 6 }),
  from: t.String({ maxLength: 5 }),
  to: t.String({ maxLength: 5 }),
});

const serviceBody = t.Object({
  title: t.String({ maxLength: 200 }),
  summary: t.Optional(t.String({ maxLength: 400 })),
  description: t.Optional(t.String({ maxLength: 20_000 })),
  category: t.Optional(t.String({ maxLength: 60 })),
  department: t.Optional(t.String({ maxLength: 120 })),
  city: t.Optional(t.String({ maxLength: 120 })),
  remote: t.Optional(literals(WORK_MODES)),
  fixed_price: t.Optional(t.Boolean()),
  work_style: t.Optional(literals(WORK_STYLES)),
  experience_years: t.Optional(t.Union([t.Number(), t.Null()])),
  availability_note: t.Optional(t.String({ maxLength: 400 })),
  response_time: t.Optional(literals(RESPONSE_TIMES)),
  /** draft o pending: publicar lo decide la moderación, no quien publica. */
  status: t.Optional(literals(OWNER_STATUSES)),
  skills: t.Optional(t.Array(t.String({ maxLength: 80 }), { maxItems: 40 })),
  prices: t.Optional(t.Array(priceSchema, { maxItems: 20 })),
  hours: t.Optional(t.Array(hourSchema, { maxItems: 40 })),
});

/** El saneo de services.ts recorta y descarta; acá solo hace falta que la
 * forma sea la esperada, como ya pasa con las ofertas del panel. */
type ServiceBody = typeof serviceBody.static;

const toInput = (body: Partial<ServiceBody>): Partial<services.ServiceInput> =>
  body as Partial<services.ServiceInput>;

export const publish = new Elysia()
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
  .get("/api/services/mine", ({ me }) => ({
    services: services.list({ user_id: me.id }),
    max: MAX_SERVICES_PER_USER,
  }))
  .post(
    "/api/services",
    ({ body, me, status }) => {
      const created = services.create(me.id, { ...toInput(body), title: body.title });
      return created.ok ? status(201, created.value) : status(422, { error: created.error });
    },
    { body: serviceBody },
  )
  .patch(
    "/api/services/:id",
    ({ body, me, params, status }) => {
      const updated = services.update(params.id, me.id, toInput(body));
      if (updated.ok) return updated.value;

      /** El servicio de otra persona y el que no existe contestan lo mismo:
       * saber cuál es cuál diría qué ids existen. */
      return updated.error === "ese servicio no existe"
        ? status(404, { error: updated.error })
        : status(422, { error: updated.error });
    },
    { body: t.Partial(serviceBody) },
  )
  .delete("/api/services/:id", ({ me, params, status }) =>
    services.remove(params.id, me.id)
      ? { status: "ok" }
      : status(404, { error: "ese servicio no existe" }),
  );
