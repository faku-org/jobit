import { Elysia, t } from "elysia";
import {
  SESSION_COOKIE,
  adminEnabled,
  createSession,
  destroySession,
  sessionValid,
  verifyPassword,
} from "./auth.ts";
import * as companies from "./companies.ts";
import { COMPANY_STATUSES } from "./companies.ts";
import { type Limit, clientKey, take } from "./limit.ts";
import * as offers from "./offers.ts";
import { OFFER_STATUSES } from "./offers.ts";

/**
 * Probar claves es lo único que se puede atacar sin estar adentro, así que
 * tiene su propio presupuesto y es mucho más chico que el del resto.
 */
const LOGIN_LIMIT: Limit = { windowMs: 15 * 60_000, max: 10 };

const SECURE_COOKIES = process.env.ADMIN_INSECURE_COOKIES !== "true";

const statusSchema = t.Union(COMPANY_STATUSES.map((value) => t.Literal(value)));

/** Elysia entrega el valor de la cookie como unknown mientras no se le declare
 * un esquema; acá alcanza con quedarse solo con lo que sea texto. */
const tokenOf = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const offerStatusSchema = t.Union(OFFER_STATUSES.map((value) => t.Literal(value)));

/** Los enums viajan como texto libre y offers.ts descarta lo que no reconoce:
 * un valor raro deja el campo vacío en vez de rechazar la oferta entera. */
const offerBody = t.Object({
  company_id: t.String({ maxLength: 64 }),
  title: t.String({ maxLength: 200 }),
  description: t.Optional(t.String({ maxLength: 20_000 })),
  requirements: t.Optional(t.String({ maxLength: 20_000 })),
  category: t.Optional(t.String({ maxLength: 60 })),
  department: t.Optional(t.String({ maxLength: 120 })),
  city: t.Optional(t.String({ maxLength: 120 })),
  level: t.Optional(t.String({ maxLength: 20 })),
  remote: t.Optional(t.String({ maxLength: 20 })),
  job_type: t.Optional(t.String({ maxLength: 20 })),
  salary_min: t.Optional(t.Union([t.Number(), t.Null()])),
  salary_max: t.Optional(t.Union([t.Number(), t.Null()])),
  no_experience: t.Optional(t.Boolean()),
  closes_at: t.Optional(t.String({ maxLength: 10 })),
  apply_url: t.Optional(t.String({ maxLength: 500 })),
  status: t.Optional(offerStatusSchema),
});

const companyBody = t.Object({
  name: t.String({ maxLength: 200 }),
  email: t.Optional(t.String({ maxLength: 300 })),
  website: t.Optional(t.String({ maxLength: 300 })),
  status: t.Optional(statusSchema),
  notes: t.Optional(t.String({ maxLength: 4000 })),
});

/**
 * Todo cuelga de /api/admin y nada de acá se sirve si falta la credencial en
 * el entorno: sin ADMIN_PASSWORD_HASH las rutas contestan 404, de modo que un
 * despliegue sin configurar no expone ni siquiera que el panel existe.
 */
export const admin = new Elysia({ prefix: "/api/admin" })
  .guard({
    beforeHandle({ status }) {
      if (!adminEnabled()) return status(404, { error: "no encontrado" });
    },
  })
  .post(
    "/login",
    async ({ body, cookie, request, server, status }) => {
      const key = clientKey(request, server?.requestIP(request)?.address ?? null);
      const allowance = take(`login:${key}`, LOGIN_LIMIT);
      if (!allowance.ok) {
        return status(429, { error: "demasiados intentos, probá más tarde" });
      }

      if (!(await verifyPassword(body.password))) {
        return status(401, { error: "clave incorrecta" });
      }

      const session = createSession();
      cookie[SESSION_COOKIE]?.set({
        value: session.token,
        httpOnly: true,
        secure: SECURE_COOKIES,
        /** strict: ningún sitio ajeno puede disparar una acción del panel
         * llevando la cookie puesta, que es el vector de CSRF acá. */
        sameSite: "strict",
        path: "/api/admin",
        expires: new Date(session.expiresAt),
      });

      return { status: "ok" };
    },
    { body: t.Object({ password: t.String({ maxLength: 200 }) }) },
  )
  .post("/logout", ({ cookie }) => {
    destroySession(tokenOf(cookie[SESSION_COOKIE]?.value));
    cookie[SESSION_COOKIE]?.remove();
    return { status: "ok" };
  })
  /** De acá para abajo hay que estar adentro. */
  .guard({
    beforeHandle({ cookie, status }) {
      if (!sessionValid(tokenOf(cookie[SESSION_COOKIE]?.value))) {
        return status(401, { error: "sesión vencida" });
      }
    },
  })
  .get("/session", () => ({ status: "ok" }))
  .get(
    "/companies",
    ({ query }) => ({
      companies: companies.list({ status: query.status, q: query.q }),
      counts: companies.counts(),
    }),
    { query: t.Object({ status: t.Optional(statusSchema), q: t.Optional(t.String()) }) },
  )
  .post(
    "/companies",
    ({ body, status }) => {
      const created = companies.create(body);
      return created.ok ? status(201, created.value) : status(422, { error: created.error });
    },
    { body: companyBody },
  )
  .patch(
    "/companies/:id",
    ({ params, body, status }) => {
      const updated = companies.update(params.id, body);
      if (updated.ok) return updated.value;
      return updated.error === "esa empresa no existe"
        ? status(404, { error: updated.error })
        : status(422, { error: updated.error });
    },
    { body: t.Partial(companyBody) },
  )
  .delete("/companies/:id", ({ params, status }) =>
    companies.remove(params.id)
      ? { status: "ok" }
      : status(404, { error: "esa empresa no existe" }),
  )
  .get(
    "/offers",
    ({ query }) => ({
      offers: offers.list({ company_id: query.company_id, status: query.status }),
      counts: offers.counts(),
    }),
    {
      query: t.Object({
        company_id: t.Optional(t.String()),
        status: t.Optional(offerStatusSchema),
      }),
    },
  )
  .post(
    "/offers",
    ({ body, status }) => {
      const created = offers.create(body);
      return created.ok ? status(201, created.value) : status(422, { error: created.error });
    },
    { body: offerBody },
  )
  .patch(
    "/offers/:id",
    ({ params, body, status }) => {
      const updated = offers.update(params.id, body);
      if (updated.ok) return updated.value;
      return updated.error === "esa oferta no existe"
        ? status(404, { error: updated.error })
        : status(422, { error: updated.error });
    },
    { body: t.Partial(offerBody) },
  )
  .delete("/offers/:id", ({ params, status }) =>
    offers.remove(params.id) ? { status: "ok" } : status(404, { error: "esa oferta no existe" }),
  );
