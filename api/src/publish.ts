import { Elysia, t } from "elysia";
import { USER_COOKIE } from "./account.ts";
import { accountsEnabled } from "./secrets.ts";
import * as services from "./services.ts";
import {
  CONTACT_KINDS,
  CURRENCIES,
  PRICE_KINDS,
  PRICE_UNITS,
  RESPONSE_TIMES,
  WORK_STYLES,
} from "./services.ts";
import * as users from "./users.ts";

/**
 * El CRUD de servicios del lado del dueño. La lista pública, la ficha y los
 * filtros son otra cosa (#30) y no cuelgan de una sesión.
 *
 * Nada de acá deja publicar: lo máximo que puede pedir el dueño es que su
 * servicio entre a la cola. Publicar lo hace la moderación, desde el panel.
 */
const tokenOf = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const literals = <T extends string>(values: readonly T[]) =>
  t.Union(values.map((value) => t.Literal(value)));

const priceSchema = t.Object({
  kind: t.Optional(literals(PRICE_KINDS)),
  label: t.Optional(t.String({ maxLength: 60 })),
  amount: t.Number(),
  currency: t.Optional(literals(CURRENCIES)),
  unit: t.Optional(literals(PRICE_UNITS)),
  notes: t.Optional(t.String({ maxLength: 200 })),
});

const hoursSchema = t.Object({
  weekday: t.Integer({ minimum: 0, maximum: 6 }),
  starts_at: t.String({ maxLength: 5 }),
  ends_at: t.String({ maxLength: 5 }),
});

const serviceBody = t.Object({
  title: t.String({ maxLength: 160 }),
  summary: t.Optional(t.String({ maxLength: 300 })),
  description: t.Optional(t.String({ maxLength: 10_000 })),
  category: t.Optional(t.String({ maxLength: 60 })),
  department: t.Optional(t.String({ maxLength: 120 })),
  city: t.Optional(t.String({ maxLength: 120 })),
  remote: t.Optional(t.Boolean()),
  fixed_price: t.Optional(t.Boolean()),
  work_style: t.Optional(literals(WORK_STYLES)),
  experience_years: t.Optional(t.Union([t.Number(), t.Null()])),
  availability_note: t.Optional(t.String({ maxLength: 300 })),
  response_time: t.Optional(literals(RESPONSE_TIMES)),
  contact_kind: t.Optional(literals(CONTACT_KINDS)),
  contact_value: t.Optional(t.String({ maxLength: 200 })),
  /** Lo único que el dueño puede pedir. services.ts lo vuelve a acotar. */
  status: t.Optional(t.Union([t.Literal("draft"), t.Literal("pending")])),
  skills: t.Optional(t.Array(t.String({ maxLength: 60 }), { maxItems: 20 })),
  prices: t.Optional(t.Array(priceSchema, { maxItems: 12 })),
  hours: t.Optional(t.Array(hoursSchema, { maxItems: 24 })),
});

export const publish = new Elysia({ prefix: "/api/services" })
  .guard({
    beforeHandle({ status }) {
      if (!accountsEnabled()) return status(404, { error: "no encontrado" });
    },
  })
  .resolve(({ cookie, status }) => {
    const user = users.sessionUser(tokenOf(cookie[USER_COOKIE]?.value));
    if (!user) return status(401, { error: "sesión vencida" });
    return { user };
  })
  /** Va antes que /:id: si no, "mine" entraría como un id. */
  .get("/mine", ({ user }) => ({
    services: services.listByUser(user.id),
    counts: services.countByUser(user.id),
    max: services.MAX_PER_USER,
  }))
  .post(
    "/",
    ({ user, body, status }) => {
      const created = services.create(user.id, body);
      return created.ok ? status(201, created.value) : status(422, { error: created.error });
    },
    { body: serviceBody },
  )
  /** Solo lo propio: un servicio ajeno se contesta igual que uno que no
   * existe, así que el id no sirve para saber si hay algo del otro lado. */
  .get("/:id", ({ user, params, status }) => {
    const service = services.byId(params.id);
    return service && service.user_id === user.id
      ? service
      : status(404, { error: "ese servicio no existe" });
  })
  .patch(
    "/:id",
    ({ user, params, body, status }) => {
      const updated = services.update(params.id, user.id, body);
      if (updated.ok) return updated.value;
      return updated.error === "ese servicio no existe"
        ? status(404, { error: updated.error })
        : status(422, { error: updated.error });
    },
    { body: t.Partial(serviceBody) },
  )
  .delete("/:id", ({ user, params, status }) =>
    services.remove(params.id, user.id)
      ? { status: "ok" }
      : status(404, { error: "ese servicio no existe" }),
  );
