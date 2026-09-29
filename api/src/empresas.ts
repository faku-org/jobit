import { Elysia, t } from "elysia";
import * as accounts from "./company-accounts.ts";
import * as emails from "./company-emails.ts";
import * as members from "./company-members.ts";
import * as companies from "./companies.ts";
import type { Company } from "./companies.ts";
import { sign, verifySignature } from "./crypto.ts";
import { publicOrigin, sendMail } from "./mail.ts";
import * as media from "./media.ts";
import * as metrics from "./metrics.ts";
import * as offers from "./offers.ts";
import { OFFER_STATUSES } from "./offers.ts";
import { generateSecret, otpauthUrl, verifyTotp } from "./totp.ts";
import { topSearchRoles } from "./usage.ts";
import { challengeName, challengeValue, hasRecord, hostnameOf } from "./website.ts";

/**
 * El panel de la empresa: entra con su cuenta y administra lo suyo.
 *
 * Es el camino autogestionado de lo que el admin venía haciendo a mano. La
 * empresa se registra sola y queda `pending`; el admin la aprueba desde
 * `/admin`; recién ahí puede publicar. Todo lo de acá está acotado a la
 * empresa de la sesión: no hay forma de tocar la oferta de otra.
 *
 * El segundo paso es obligatorio: sin TOTP no hay sesión. El alta y el ingreso
 * devuelven el desafío, no la cookie; recién el código de seis dígitos la abre.
 */
const SECURE_COOKIES = process.env.ADMIN_INSECURE_COOKIES !== "true";
export const COMPANY_COOKIE = "jobit_company";
const CHALLENGE_COOKIE = "jobit_company_2fa";
const CHALLENGE_MS = 10 * 60_000;
/** La cookie de sesión viaja solo a las rutas de este panel, como la del admin. */
const COOKIE_PATH = "/api/empresas";
const ISSUER = "JobIt";

/** Elysia entrega la cookie como unknown mientras no se le declare esquema. */
const tokenOf = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

interface CookieJar {
  [key: string]: { set: (options: Record<string, unknown>) => void; remove: () => void } | undefined;
}

const setSession = (cookie: CookieJar, session: accounts.CompanySession): void => {
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

/** El segundo paso no crea sesión: el desafío viaja firmado y con vencimiento. */
async function signChallenge(companyId: string, now: number = Date.now()): Promise<string | null> {
  const payload = `${companyId}.${now + CHALLENGE_MS}`;
  const signature = await sign(payload);
  return signature.ok ? `${payload}.${signature.value}` : null;
}

async function readChallenge(token: string): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [companyId, expiresAt, signature] = parts;
  if (!companyId || !expiresAt || !signature) return null;

  const expires = Number(expiresAt);
  if (!Number.isFinite(expires) || expires < Date.now()) return null;
  return (await verifySignature(`${companyId}.${expiresAt}`, signature)) ? companyId : null;
}

const setChallenge = (cookie: CookieJar, token: string): void => {
  cookie[CHALLENGE_COOKIE]?.set({
    value: token,
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: "lax",
    path: "/api",
    maxAge: CHALLENGE_MS / 1000,
  });
};

/** Lo que la empresa necesita para cargar el TXT de su dominio. */
function websiteView(company: Company) {
  if (!company.website) return null;
  const host = hostnameOf(company.website);
  if (!host) return null;
  return {
    host,
    record_name: challengeName(host),
    record_value: challengeValue(company.website_token),
    verified: company.website_verified,
    checked_at: company.website_checked_at,
  };
}

/** Lo que la empresa ve de sí misma. Las notas internas no salen. */
function companyView(company: Company) {
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    email: company.email,
    website: company.website,
    phone: company.phone,
    phone_country: company.phone_country,
    logo: company.logo,
    banner: company.banner,
    socials: company.socials,
    privacy: company.privacy,
    website_verification: websiteView(company),
    status: company.status,
    created_at: company.created_at,
    updated_at: company.updated_at,
    totp_enabled: accounts.totpEnabled(company.id),
    recovery_codes_left: accounts.recoveryCodesLeft(company.id),
    emails: emails.list(company.id).map((entry) => ({
      kind: entry.kind,
      email: entry.email,
      verified: entry.verified,
      updated_at: entry.updated_at,
    })),
    members: members.list(company.id),
  };
}

const DAY_MS = 86_400_000;

/** Un dominio ya verificado se vuelve a mirar cada 24 h: si el TXT se borró, la
 * verificación se cae sola, que es el punto de que dependa de un registro vivo. */
async function refreshWebsite(company: Company): Promise<Company> {
  if (!company.website || !company.website_verified || !company.website_token) return company;

  const checked = Date.parse(company.website_checked_at);
  if (!Number.isNaN(checked) && Date.now() - checked < DAY_MS) return company;

  const host = hostnameOf(company.website);
  if (!host) return company;

  const verified = await hasRecord(host, company.website_token);
  const updated = companies.setWebsiteVerification(company.id, verified);
  return updated.ok ? updated.value : company;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const head = local.slice(0, 2);
  return `${head}${"*".repeat(Math.max(local.length - 2, 2))}@${domain}`;
}

/** El primer correo verificado que pueda recibir el código. */
function verifiedContact(company: Company): { kind: emails.CompanyEmailKind; email: string } | null {
  const list = emails.list(company.id);
  const order: emails.CompanyEmailKind[] = ["recovery", "contact", "support", "billing"];
  for (const kind of order) {
    const entry = list.find((candidate) => candidate.kind === kind);
    if (entry?.verified && entry.email) return { kind, email: entry.email };
  }
  return null;
}

const VERIFY_SUBJECT: Record<emails.CompanyEmailKind, string> = {
  billing: "Verificá el correo de facturación de tu empresa",
  contact: "Verificá el correo de contacto de tu empresa",
  support: "Verificá el correo de soporte de tu empresa",
  recovery: "Verificá el correo de recuperación de tu cuenta",
};

/** El enlace de verificación, al correo que se acaba de cargar. */
async function sendVerification(
  company: Company,
  kind: emails.CompanyEmailKind,
  token: string,
  to: string,
): Promise<void> {
  const link = `${publicOrigin()}/api/empresas/verify?c=${encodeURIComponent(company.id)}&k=${kind}&t=${encodeURIComponent(token)}`;
  await sendMail({
    to,
    subject: VERIFY_SUBJECT[kind],
    text: [
      `${company.name}: confirmá este correo para tu cuenta de JobIt.`,
      "",
      link,
      "",
      "El enlace vence en 24 horas. Si no fuiste vos, ignorá este mensaje.",
    ].join("\n"),
  });
}

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
  phone: t.Optional(t.String({ maxLength: 40 })),
  phone_country: t.Optional(t.String({ maxLength: 2 })),
  password: t.String({ minLength: 10, maxLength: 200 }),
  recovery_email: t.Optional(t.String({ maxLength: 300 })),
});

const loginBody = t.Object({
  identifier: t.String({ maxLength: 300 }),
  password: t.String({ maxLength: 200 }),
});

const totpSetupBody = t.Object({ code: t.Optional(t.String({ maxLength: 10 })) });
const totpCodeBody = t.Object({ code: t.String({ maxLength: 10 }) });
const recoverBody = t.Object({
  identifier: t.String({ maxLength: 300 }),
  code: t.String({ maxLength: 20 }),
});
const recoverEmailBody = t.Object({ identifier: t.String({ maxLength: 300 }) });
const resetBody = t.Object({
  company_id: t.String({ maxLength: 64 }),
  token: t.String({ maxLength: 200 }),
  new_password: t.String({ minLength: 10, maxLength: 200 }),
});

const privacyBody = t.Object({
  phone: t.Optional(t.Boolean()),
  email: t.Optional(t.Boolean()),
  website: t.Optional(t.Boolean()),
  members: t.Optional(t.Boolean()),
});

const patchMeBody = t.Object({
  name: t.Optional(t.String({ maxLength: 200 })),
  email: t.Optional(t.String({ maxLength: 300 })),
  website: t.Optional(t.String({ maxLength: 300 })),
  phone: t.Optional(t.String({ maxLength: 40 })),
  phone_country: t.Optional(t.String({ maxLength: 2 })),
  socials: t.Optional(t.Record(t.String(), t.String({ maxLength: 300 }))),
  privacy: t.Optional(privacyBody),
  current_password: t.Optional(t.String({ maxLength: 200 })),
  new_password: t.Optional(t.String({ minLength: 10, maxLength: 200 })),
  totp_code: t.Optional(t.String({ maxLength: 10 })),
  email_code: t.Optional(t.String({ maxLength: 10 })),
});

/** Cambiar el 2FA: la contraseña arranca el cambio y el código lo confirma. */
const changeTotpBody = t.Object({
  password: t.String({ maxLength: 200 }),
  code: t.Optional(t.String({ maxLength: 10 })),
});

/** Lockdown y desactivar piden las dos cosas: contraseña y segundo paso. */
const confirmSecurityBody = t.Object({
  password: t.String({ maxLength: 200 }),
  totp_code: t.String({ maxLength: 10 }),
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
      if (!(await accounts.encryptionReady())) {
        return status(503, { error: "el segundo paso no está disponible en este servidor" });
      }

      const email = body.email.trim();
      if (!email) return status(422, { error: "hace falta un correo de contacto" });
      if (companies.byEmail(email)) {
        return status(422, { error: "ese correo ya está registrado" });
      }

      const created = await companies.create({
        name: body.name,
        email,
        website: body.website,
        phone: body.phone,
        phone_country: body.phone_country,
      });
      if (!created.ok) return status(422, { error: created.error });

      const account = await accounts.register(created.value.id, body.password);
      if (!account.ok) {
        /** Sin cuenta no queda media empresa colgando. */
        companies.remove(created.value.id);
        return status(422, { error: account.error });
      }

      const recovery = body.recovery_email?.trim();
      if (recovery) {
        const saved = emails.set(created.value.id, "recovery", recovery);
        if (saved.ok && saved.value.token) {
          await sendVerification(created.value, "recovery", saved.value.token, recovery.toLowerCase());
        }
      }

      const challenge = await signChallenge(created.value.id);
      if (!challenge) {
        return status(503, { error: "el segundo paso no está disponible" });
      }
      setChallenge(cookie, challenge);
      return status(201, { status: "totp_setup_required", company: companyView(created.value) });
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
      if (accounts.isDeactivated(company.id)) {
        return status(403, {
          error: "esa cuenta está desactivada; recuperá el acceso por el correo de recuperación",
        });
      }
      if (company.status === "suspended") {
        return status(403, { error: "esa empresa está suspendida" });
      }

      const challenge = await signChallenge(company.id);
      if (!challenge) return status(503, { error: "el segundo paso no está disponible" });
      setChallenge(cookie, challenge);

      return {
        status: accounts.totpEnabled(company.id) ? "totp_required" : "totp_setup_required",
        company: companyView(company),
      };
    },
    { body: loginBody },
  )
  /**
   * Sin `code` genera la clave y la devuelve una vez para el QR; con `code` la
   * confirma, activa el segundo paso y recién ahí abre la sesión.
   */
  .post(
    "/auth/totp/setup",
    async ({ body, cookie, status }) => {
      const companyId = await readChallenge(tokenOf(cookie[CHALLENGE_COOKIE]?.value) ?? "");
      if (!companyId) return status(401, { error: "el segundo paso venció, volvé a entrar" });

      const company = companies.byId(companyId);
      if (!company || company.status === "suspended") {
        return status(401, { error: "esa empresa no está" });
      }
      if (accounts.isDeactivated(companyId)) {
        return status(403, { error: "esa cuenta está desactivada" });
      }

      if (body.code === undefined) {
        if (accounts.totpEnabled(companyId)) {
          return status(422, { error: "el segundo paso ya está activado" });
        }
        if (!(await accounts.encryptionReady())) {
          return status(503, { error: "el segundo paso no está disponible" });
        }

        const secret = generateSecret();
        const saved = await accounts.setTotpSecret(companyId, secret);
        if (!saved.ok) return status(503, { error: saved.error });

        return {
          status: "setup",
          account: company.email || company.slug,
          secret,
          otpauth: otpauthUrl({ secret, account: company.email || company.slug, issuer: ISSUER }),
        };
      }

      const secret = await accounts.totpSecret(companyId);
      if (!secret) return status(422, { error: "no hay un segundo paso pendiente" });

      const check = await verifyTotp(secret, body.code);
      if (!check.ok) return status(401, { error: "código incorrecto" });

      accounts.enableTotp(companyId);
      setSession(cookie, accounts.createSession(companyId));
      cookie[CHALLENGE_COOKIE]?.remove();
      return status(201, {
        status: "ok",
        company: companyView(company),
        /** Se muestran una sola vez: en la base queda el sha256. */
        recovery_codes: accounts.generateRecoveryCodes(companyId),
      });
    },
    { body: totpSetupBody },
  )
  .post(
    "/auth/totp",
    async ({ body, cookie, status }) => {
      const companyId = await readChallenge(tokenOf(cookie[CHALLENGE_COOKIE]?.value) ?? "");
      if (!companyId) return status(401, { error: "el segundo paso venció, volvé a entrar" });

      const company = companies.byId(companyId);
      if (!company || company.status === "suspended") {
        return status(401, { error: "esa empresa no está" });
      }
      if (accounts.isDeactivated(companyId)) {
        return status(403, { error: "esa cuenta está desactivada" });
      }

      const secret = await accounts.totpSecret(companyId);
      if (!secret || !accounts.totpEnabled(companyId)) {
        return status(401, { error: "esa empresa no tiene segundo paso" });
      }

      const check = await verifyTotp(secret, body.code);
      if (!check.ok) return status(401, { error: "código incorrecto" });

      setSession(cookie, accounts.createSession(companyId));
      cookie[CHALLENGE_COOKIE]?.remove();
      return { status: "ok", company: companyView(company) };
    },
    { body: totpCodeBody },
  )
  /** Entrar con un código de respaldo, para cuando se perdió el teléfono. */
  .post(
    "/auth/recover",
    ({ body, cookie, status }) => {
      const company = companies.byEmailOrSlug(body.identifier);
      if (!company || company.status === "suspended") {
        return status(401, { error: "empresa o código incorrectos" });
      }
      if (accounts.isDeactivated(company.id)) {
        return status(403, { error: "esa cuenta está desactivada" });
      }
      if (!accounts.consumeRecoveryCode(company.id, body.code)) {
        return status(401, { error: "empresa o código incorrectos" });
      }

      setSession(cookie, accounts.createSession(company.id));
      return { status: "ok", company: companyView(company) };
    },
    { body: recoverBody },
  )
  /** Manda el enlace de recuperación al correo alterno. Responde igual siempre,
   * para no decir si esa empresa existe. */
  .post(
    "/auth/recover/email",
    async ({ body }) => {
      const company = companies.byEmailOrSlug(body.identifier);
      if (company && company.status !== "suspended") {
        const recovery = emails.get(company.id, "recovery");
        if (recovery?.verified && recovery.email) {
          const token = accounts.startReset(company.id);
          const link = `${publicOrigin()}/empresas?recuperar=${encodeURIComponent(company.id)}.${encodeURIComponent(token)}`;
          await sendMail({
            to: recovery.email,
            subject: "Recuperar el acceso a tu empresa en JobIt",
            text: [
              `${company.name}: pediste recuperar el acceso.`,
              "",
              link,
              "",
              "El enlace vence en 30 minutos y sirve una sola vez. Si no fuiste vos,",
              "ignorá este mensaje: tu contraseña no cambia.",
            ].join("\n"),
          });
        }
      }
      return { status: "ok" };
    },
    { body: recoverEmailBody },
  )
  .post(
    "/auth/recover/reset",
    async ({ body, status }) => {
      const company = companies.byId(body.company_id);
      if (!company) return status(400, { error: "el enlace no vale o venció" });
      if (!accounts.consumeReset(company.id, body.token)) {
        return status(400, { error: "el enlace no vale o venció" });
      }

      const changed = await accounts.setPassword(company.id, body.new_password);
      if (!changed.ok) return status(422, { error: changed.error });
      /** Con la contraseña nueva se vuelve a pedir el segundo paso: es la
       * salida para quien perdió el teléfono y no tiene códigos. Y si la cuenta
       * estaba desactivada, recuperar el acceso la vuelve a encender. */
      accounts.disableTotp(company.id);
      accounts.clearPendingTotp(company.id);
      accounts.reactivate(company.id);
      return { status: "ok" };
    },
    { body: resetBody },
  )
  .post("/auth/logout", ({ cookie }) => {
    accounts.destroySession(tokenOf(cookie[COMPANY_COOKIE]?.value));
    cookie[COMPANY_COOKIE]?.remove();
    cookie[CHALLENGE_COOKIE]?.remove();
    return { status: "ok" };
  })
  /** Verificación de correo: el enlace que llega por mail cae acá y de ahí sale
   * para el panel. Es un GET porque lo abre el navegador. */
  .get(
    "/verify",
    ({ query }) => {
      let ok = false;
      if (emails.isKind(query.k)) {
        ok = emails.verify(query.c, query.k, query.t);
      }
      /** Relativo, para que valga igual en local y en producción: el enlace
       * llega al mismo host por el que se pidió. */
      const target = ok ? `/empresas?verificado=${query.k ?? ""}` : "/empresas?verificado=error";
      return new Response(null, { status: 302, headers: { location: target } });
    },
    { query: t.Object({ c: t.String(), k: t.String(), t: t.String() }) },
  )
  /** Las imágenes son públicas: las ve cualquiera que mire la ficha. */
  .get(
    "/media/:companyId/:kind",
    ({ params, status }) => {
      if (!media.isKind(params.kind) || !media.isSafeId(params.companyId)) {
        return status(404, { error: "no encontrado" });
      }
      const file = media.read(params.companyId, params.kind);
      if (!file) return status(404, { error: "no encontrado" });

      return new Response(file.bytes, {
        headers: {
          "content-type": file.type,
          "cache-control": "public, max-age=3600",
          "x-content-type-options": "nosniff",
        },
      });
    },
    { params: t.Object({ companyId: t.String(), kind: t.String() }) },
  )
  /** De acá para abajo hay que estar adentro. */
  .guard({
    beforeHandle({ cookie, status }) {
      if (!accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value))) {
        return status(401, { error: "sesión vencida" });
      }
    },
  })
  .get("/session", async ({ cookie, status }) => {
    const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
    if (!company) return status(401, { error: "sesión vencida" });
    return { status: "ok", company: companyView(await refreshWebsite(company)) };
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

        /** Cambiar la contraseña pide las dos cosas: el segundo paso y el código
         * que llega al correo verificado. */
        const secret = await accounts.totpSecret(company.id);
        if (!secret || !accounts.totpEnabled(company.id)) {
          return status(422, { error: "el segundo paso no está activo" });
        }
        if (!body.totp_code || !(await verifyTotp(secret, body.totp_code)).ok) {
          return status(401, { error: "el código del segundo paso no es correcto" });
        }
        if (!body.email_code || !accounts.consumePasswordCode(company.id, body.email_code)) {
          return status(401, { error: "el código del correo no es correcto o venció" });
        }

        const changed = await accounts.setPassword(company.id, body.new_password);
        if (!changed.ok) return status(422, { error: changed.error });
      }

      const touchesProfile =
        body.name !== undefined ||
        body.email !== undefined ||
        body.website !== undefined ||
        body.phone !== undefined ||
        body.phone_country !== undefined ||
        body.socials !== undefined ||
        body.privacy !== undefined;

      if (touchesProfile) {
        const updated = companies.update(company.id, {
          name: body.name,
          email: body.email,
          website: body.website,
          phone: body.phone,
          phone_country: body.phone_country,
          socials: body.socials,
          privacy: body.privacy,
        });
        if (!updated.ok) return status(422, { error: updated.error });
        return { company: companyView(updated.value) };
      }

      return { company: companyView(company) };
    },
    { body: patchMeBody },
  )
  /** Manda el código de seis dígitos para un cambio de contraseña. */
  .post("/me/password/email", async ({ cookie, status }) => {
    const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
    if (!company) return status(401, { error: "sesión vencida" });

    const contact = verifiedContact(company);
    if (!contact) {
      return status(422, { error: "primero cargá y verificá un correo" });
    }

    const code = accounts.startPasswordCode(company.id);
    const sent = await sendMail({
      to: contact.email,
      subject: "Código para cambiar la contraseña",
      text: [
        `${company.name}: para cambiar la contraseña, poné este código.`,
        "",
        code,
        "",
        "Vence en 15 minutos. Si no fuiste vos, ignorá este mensaje: tu contraseña no cambia.",
      ].join("\n"),
    });
    if (!sent.ok) return status(503, { error: sent.error });

    return { sent: true, to: maskEmail(contact.email), kind: contact.kind };
  })
  /**
   * Cambiar el segundo paso. Sin `code` genera la clave nueva y la deja
   * pendiente; con `code` la confirma y reemplaza la vieja. El 2FA actual sigue
   * activo hasta ese momento, así que abandonar el cambio no deja la cuenta sin
   * segundo paso. Al confirmar se cierran las otras sesiones y se renuevan los
   * códigos de respaldo.
   */
  .post(
    "/me/totp/setup",
    async ({ body, cookie, status }) => {
      const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
      if (!company) return status(401, { error: "sesión vencida" });
      if (!(await accounts.verifyPassword(company.id, body.password))) {
        return status(401, { error: "la contraseña no coincide" });
      }
      if (!accounts.totpEnabled(company.id)) {
        return status(422, { error: "el segundo paso todavía no está activo" });
      }
      if (!(await accounts.encryptionReady())) {
        return status(503, { error: "el segundo paso no está disponible" });
      }

      if (body.code === undefined) {
        const secret = generateSecret();
        const saved = await accounts.setPendingTotp(company.id, secret);
        if (!saved.ok) return status(503, { error: saved.error });

        return {
          status: "setup",
          account: company.email || company.slug,
          secret,
          otpauth: otpauthUrl({ secret, account: company.email || company.slug, issuer: ISSUER }),
        };
      }

      const secret = await accounts.pendingTotpSecret(company.id);
      if (!secret) return status(422, { error: "no hay un segundo paso pendiente" });

      const check = await verifyTotp(secret, body.code);
      if (!check.ok) return status(401, { error: "código incorrecto" });

      accounts.promotePendingTotp(company.id);
      /** Lo que veía la app vieja deja de valer: se cierran las otras sesiones. */
      accounts.destroyOtherSessions(company.id, tokenOf(cookie[COMPANY_COOKIE]?.value));
      return {
        status: "ok",
        company: companyView(companies.byId(company.id) ?? company),
        recovery_codes: accounts.generateRecoveryCodes(company.id),
      };
    },
    { body: changeTotpBody },
  )
  /**
   * Lockdown: para cuando sospechás que alguien más entró. Cierra la sesión en
   * todos los dispositivos —esta incluida— y renueva los códigos de respaldo.
   * Los códigos viajan en la respuesta para mostrarlos una sola vez antes de
   * que la cookie desaparezca.
   */
  .post(
    "/me/lockdown",
    async ({ body, cookie, status }) => {
      const token = tokenOf(cookie[COMPANY_COOKIE]?.value);
      const company = accounts.sessionCompany(token);
      if (!company) return status(401, { error: "sesión vencida" });
      if (!(await accounts.verifyPassword(company.id, body.password))) {
        return status(401, { error: "la contraseña no coincide" });
      }

      const secret = await accounts.totpSecret(company.id);
      if (!secret || !accounts.totpEnabled(company.id)) {
        return status(422, { error: "el segundo paso no está activo" });
      }
      if (!(await verifyTotp(secret, body.totp_code)).ok) {
        return status(401, { error: "el código del segundo paso no es correcto" });
      }

      accounts.destroyAllSessions(company.id);
      const codes = accounts.generateRecoveryCodes(company.id);
      cookie[COMPANY_COOKIE]?.remove();
      cookie[CHALLENGE_COOKIE]?.remove();
      return { status: "ok", recovery_codes: codes };
    },
    { body: confirmSecurityBody },
  )
  /**
   * Desactivar la cuenta: deja de entrar hasta que se recupere por el correo
   * alterno. Por eso pide que ese correo esté verificado antes de apagarla, y
   * manda el enlace de recuperación en el momento para no dejar a nadie afuera.
   */
  .post(
    "/me/deactivate",
    async ({ body, cookie, status }) => {
      const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
      if (!company) return status(401, { error: "sesión vencida" });
      if (!(await accounts.verifyPassword(company.id, body.password))) {
        return status(401, { error: "la contraseña no coincide" });
      }

      const secret = await accounts.totpSecret(company.id);
      if (!secret || !accounts.totpEnabled(company.id)) {
        return status(422, { error: "el segundo paso no está activo" });
      }
      if (!(await verifyTotp(secret, body.totp_code)).ok) {
        return status(401, { error: "el código del segundo paso no es correcto" });
      }

      const recovery = emails.get(company.id, "recovery");
      if (!recovery?.verified || !recovery.email) {
        return status(422, {
          error: "para desactivar hace falta un correo de recuperación verificado",
        });
      }

      accounts.deactivate(company.id);
      accounts.destroyAllSessions(company.id);

      const reset = accounts.startReset(company.id);
      const link = `${publicOrigin()}/empresas?recuperar=${encodeURIComponent(company.id)}.${encodeURIComponent(reset)}`;
      await sendMail({
        to: recovery.email,
        subject: "Tu cuenta de empresa en JobIt quedó desactivada",
        text: [
          `${company.name}: desactivaste la cuenta.`,
          "",
          "Para volver a entrar, elegí una contraseña nueva acá:",
          link,
          "",
          "El enlace vence en 30 minutos y sirve una sola vez. Si no fuiste vos,",
          "escribinos: no hagas nada con este enlace.",
        ].join("\n"),
      });

      cookie[COMPANY_COOKIE]?.remove();
      cookie[CHALLENGE_COOKIE]?.remove();
      return { status: "ok", email: maskEmail(recovery.email) };
    },
    { body: confirmSecurityBody },
  )
  /** Consulta el TXT del dominio. Sin registro, la URL deja de estar vigente. */
  .post("/me/website/verify", async ({ cookie, status }) => {
    const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
    if (!company) return status(401, { error: "sesión vencida" });
    if (!company.website) return status(422, { error: "primero cargá el sitio" });

    const host = hostnameOf(company.website);
    const verified = host ? await hasRecord(host, company.website_token) : false;
    const updated = companies.setWebsiteVerification(company.id, verified);
    if (!updated.ok) return status(422, { error: updated.error });

    return {
      verified,
      error: verified
        ? undefined
        : `No encontramos el registro. Cargá un TXT en ${host ?? "el dominio"} y probá de nuevo.`,
      company: companyView(updated.value),
    };
  })
  .get("/emails", ({ cookie, status }) => {
    const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
    if (!company) return status(401, { error: "sesión vencida" });
    return { emails: companyView(company).emails };
  })
  .put(
    "/emails/:kind",
    async ({ params, body, cookie, status }) => {
      const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
      if (!company) return status(401, { error: "sesión vencida" });
      if (!emails.isKind(params.kind)) return status(404, { error: "ese correo no existe" });

      const saved = emails.set(company.id, params.kind, body.email);
      if (!saved.ok) return status(422, { error: saved.error });
      if (saved.value.token) {
        await sendVerification(company, params.kind, saved.value.token, body.email.trim().toLowerCase());
      }
      return { emails: companyView(company).emails };
    },
    { body: t.Object({ email: t.String({ maxLength: 300 }) }) },
  )
  .post(
    "/emails/:kind/resend",
    async ({ params, cookie, status }) => {
      const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
      if (!company) return status(401, { error: "sesión vencida" });
      if (!emails.isKind(params.kind)) return status(404, { error: "ese correo no existe" });

      const refreshed = emails.refreshToken(company.id, params.kind);
      if (!refreshed.ok) return status(422, { error: refreshed.error });

      const current = emails.get(company.id, params.kind);
      if (current?.email) {
        await sendVerification(company, params.kind, refreshed.value, current.email);
      }
      return { status: "ok" };
    },
    { params: t.Object({ kind: t.String() }) },
  )
  .delete(
    "/emails/:kind",
    ({ params, cookie, status }) => {
      const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
      if (!company) return status(401, { error: "sesión vencida" });
      if (!emails.isKind(params.kind)) return status(404, { error: "ese correo no existe" });

      emails.set(company.id, params.kind, "");
      return { emails: companyView(company).emails };
    },
    { params: t.Object({ kind: t.String() }) },
  )
  .post(
    "/media/:kind",
    async ({ params, body, cookie, status }) => {
      const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
      if (!company) return status(401, { error: "sesión vencida" });
      if (!media.isKind(params.kind)) return status(404, { error: "ese archivo no existe" });

      const bytes = new Uint8Array(await body.file.arrayBuffer());
      const saved = media.save(company.id, params.kind, bytes);
      if (!saved.ok) return status(422, { error: saved.error });

      const updated = companies.setMedia(company.id, params.kind, saved.value);
      if (!updated.ok) return status(422, { error: updated.error });
      return { company: companyView(updated.value) };
    },
    { body: t.Object({ file: t.File() }) },
  )
  .delete(
    "/media/:kind",
    ({ params, cookie, status }) => {
      const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
      if (!company) return status(401, { error: "sesión vencida" });
      if (!media.isKind(params.kind)) return status(404, { error: "ese archivo no existe" });

      media.remove(company.id, params.kind);
      const updated = companies.setMedia(company.id, params.kind, "");
      return { company: companyView(updated.ok ? updated.value : company) };
    },
    { params: t.Object({ kind: t.String() }) },
  )
  .get("/members", ({ cookie, status }) => {
    const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
    if (!company) return status(401, { error: "sesión vencida" });
    return { members: members.list(company.id) };
  })
  .post(
    "/members",
    ({ body, cookie, status }) => {
      const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
      if (!company) return status(401, { error: "sesión vencida" });

      const added = members.add(company.id, body.handle);
      if (!added.ok) return status(422, { error: added.error });
      return status(201, { members: members.list(company.id) });
    },
    { body: t.Object({ handle: t.String({ maxLength: 60 }) }) },
  )
  .delete(
    "/members/:userId",
    ({ params, cookie, status }) => {
      const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
      if (!company) return status(401, { error: "sesión vencida" });

      members.remove(company.id, params.userId);
      return { members: members.list(company.id) };
    },
    { params: t.Object({ userId: t.String() }) },
  )
  /** Lo que la empresa ve de sí misma: contadores por oferta, nunca por persona.
   * Suma los puestos más buscados, que es un corte agregado de los eventos
   * anónimos: dice qué se busca, nunca quién. */
  .get(
    "/metrics",
    async ({ query, cookie, status }) => {
      const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
      if (!company) return status(401, { error: "sesión vencida" });
      const days = query.days ?? 30;
      const [report, searchRoles] = await Promise.all([
        metrics.companyMetrics(company.id, days),
        topSearchRoles(days),
      ]);
      return { ...report, search_roles: searchRoles };
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
