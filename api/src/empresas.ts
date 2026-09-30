import { Elysia, t } from "elysia";
import { secureCookies } from "./auth.ts";
import * as accounts from "./company-accounts.ts";
import * as companies from "./companies.ts";
import type { Company } from "./companies.ts";
import * as metrics from "./metrics.ts";
import * as offers from "./offers.ts";
import { OFFER_STATUSES } from "./offers.ts";

/**
 * El panel de la empresa: entra con su cuenta y administra lo suyo.
 *
 * Es el camino autogestionado de lo que el admin venía haciendo a mano. La
 * empresa se registra sola y queda `pending`; el admin la aprueba desde
 * `/admin`; recién ahí puede publicar. Todo lo de acá está acotado a la
 * empresa de la sesión: no hay forma de tocar la oferta de otra.
 */
const SECURE_COOKIES = secureCookies();
export const COMPANY_COOKIE = "jobit_company";
/** La cookie viaja solo a las rutas de este panel, como la del admin. */
const COOKIE_PATH = "/api/empresas";

/** Elysia entrega la cookie como unknown mientras no se le declare esquema. */
const tokenOf = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const setSession = (
  cookie: Record<string, { set: (options: Record<string, unknown>) => void } | undefined>,
  session: accounts.CompanySession,
): void => {
  cookie[COMPANY_COOKIE]?.set({
    value: session.token,
    httpOnly: true,
    secure: SECURE_COOKIES,
    /** strict: ningún sitio ajeno puede disparar una acción con la cookie puesta. */
    sameSite: "strict",
    path: COOKIE_PATH,
    expires: new Date(session.expiresAt),
  });
};

/** Lo que la empresa puede ver de sí misma. Las notas internas no salen. */
const publicCompany = (company: Company) => ({
  id: company.id,
  name: company.name,
  slug: company.slug,
  email: company.email,
  website: company.website,
  status: company.status,
  created_at: company.created_at,
  updated_at: company.updated_at,
});

const offerStatusSchema = t.Union(OFFER_STATUSES.map((value) => t.Literal(value)));

const offerBody = t.Object({
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

const registerBody = t.Object({
  name: t.String({ maxLength: 200 }),
  email: t.String({ maxLength: 300 }),
  website: t.Optional(t.String({ maxLength: 300 })),
  password: t.String({ minLength: 8, maxLength: 200 }),
});

const loginBody = t.Object({
  identifier: t.String({ maxLength: 300 }),
  password: t.String({ maxLength: 200 }),
});

const patchMeBody = t.Object({
  name: t.Optional(t.String({ maxLength: 200 })),
  email: t.Optional(t.String({ maxLength: 300 })),
  website: t.Optional(t.String({ maxLength: 300 })),
  current_password: t.Optional(t.String({ maxLength: 200 })),
  new_password: t.Optional(t.String({ minLength: 8, maxLength: 200 })),
});

/**
 * Publicar pide la empresa aprobada. `offers.ts` ya filtra `published` por
 * estado al armar el feed, así que esto es la respuesta honesta en el momento:
 * un borrador siempre se puede guardar, publicar no hasta que el admin apruebe.
 */
function canPublish(company: Company, status: offers.OfferStatus | undefined): boolean {
  return status !== "published" || company.status === "approved";
}

export const empresas = new Elysia({ prefix: "/api/empresas" })
  .post(
    "/auth/register",
    async ({ body, cookie, status }) => {
      const email = body.email.trim();
      if (!email) return status(422, { error: "hace falta un correo de contacto" });
      if (companies.byEmail(email)) {
        return status(422, { error: "ese correo ya está registrado" });
      }

      const created = await companies.create({ name: body.name, email, website: body.website });
      if (!created.ok) return status(422, { error: created.error });

      const account = await accounts.register(created.value.id, body.password);
      if (!account.ok) {
        /** Sin cuenta no queda media empresa colgando. */
        companies.remove(created.value.id);
        return status(422, { error: account.error });
      }

      setSession(cookie, accounts.createSession(created.value.id));
      return status(201, { status: "ok", company: publicCompany(created.value) });
    },
    { body: registerBody },
  )
  .post(
    "/auth/login",
    async ({ body, cookie, status }) => {
      const company = companies.byEmailOrSlug(body.identifier);
      /** Una sola respuesta para la empresa que no existe y la clave que no es. */
      if (!company || !(await accounts.verifyPassword(company.id, body.password))) {
        return status(401, { error: "empresa o contraseña incorrectos" });
      }
      if (company.status === "suspended") {
        return status(403, { error: "esa empresa está suspendida" });
      }

      setSession(cookie, accounts.createSession(company.id));
      return { status: "ok", company: publicCompany(company) };
    },
    { body: loginBody },
  )
  .post("/auth/logout", ({ cookie }) => {
    accounts.destroySession(tokenOf(cookie[COMPANY_COOKIE]?.value));
    cookie[COMPANY_COOKIE]?.remove();
    return { status: "ok" };
  })
  /** De acá para abajo hay que estar adentro. */
  .guard({
    beforeHandle({ cookie, status }) {
      if (!accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value))) {
        return status(401, { error: "sesión vencida" });
      }
    },
  })
  .get("/session", ({ cookie, status }) => {
    const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
    if (!company) return status(401, { error: "sesión vencida" });
    return { status: "ok", company: publicCompany(company) };
  })
  .patch(
    "/me",
    async ({ body, cookie, status }) => {
      const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
      if (!company) return status(401, { error: "sesión vencida" });

      if (body.new_password !== undefined) {
        const current = body.current_password;
        if (!current || !(await accounts.verifyPassword(company.id, current))) {
          return status(401, { error: "la contraseña actual no coincide" });
        }
        const changed = await accounts.setPassword(company.id, body.new_password);
        if (!changed.ok) return status(422, { error: changed.error });
      }

      if (body.name !== undefined || body.email !== undefined || body.website !== undefined) {
        const updated = companies.update(company.id, {
          name: body.name,
          email: body.email,
          website: body.website,
        });
        if (!updated.ok) return status(422, { error: updated.error });
        return { company: publicCompany(updated.value) };
      }

      return { company: publicCompany(company) };
    },
    { body: patchMeBody },
  )
  /** Lo que la empresa ve de sí misma: contadores por oferta, nunca por persona. */
  .get(
    "/metrics",
    ({ query, cookie, status }) => {
      const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
      if (!company) return status(401, { error: "sesión vencida" });
      return metrics.companyMetrics(company.id, query.days ?? 30);
    },
    { query: t.Object({ days: t.Optional(t.Numeric({ minimum: 1, maximum: 365 })) }) },
  )
  .get("/offers", ({ cookie, status }) => {
    const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
    if (!company) return status(401, { error: "sesión vencida" });
    return { offers: offers.list({ company_id: company.id }), counts: offers.counts() };
  })
  .post(
    "/offers",
    ({ body, cookie, status }) => {
      const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
      if (!company) return status(401, { error: "sesión vencida" });
      if (!canPublish(company, body.status)) {
        return status(422, { error: "tu empresa todavía no está aprobada para publicar" });
      }

      const created = offers.create({ ...body, company_id: company.id });
      return created.ok ? status(201, created.value) : status(422, { error: created.error });
    },
    { body: offerBody },
  )
  .patch(
    "/offers/:id",
    ({ params, body, cookie, status }) => {
      const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
      if (!company) return status(401, { error: "sesión vencida" });

      const current = offers.byId(params.id);
      /** Una oferta ajena responde lo mismo que una que no existe. */
      if (!current || current.company_id !== company.id) {
        return status(404, { error: "esa oferta no existe" });
      }
      if (!canPublish(company, body.status)) {
        return status(422, { error: "tu empresa todavía no está aprobada para publicar" });
      }

      const updated = offers.update(params.id, body);
      if (updated.ok) return updated.value;
      return updated.error === "esa oferta no existe"
        ? status(404, { error: updated.error })
        : status(422, { error: updated.error });
    },
    { body: t.Partial(offerBody) },
  )
  .delete("/offers/:id", ({ params, cookie, status }) => {
    const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
    if (!company) return status(401, { error: "sesión vencida" });

    const current = offers.byId(params.id);
    if (!current || current.company_id !== company.id) {
      return status(404, { error: "esa oferta no existe" });
    }
    return offers.remove(params.id)
      ? { status: "ok" }
      : status(404, { error: "esa oferta no existe" });
  });
