import { Elysia, t } from "elysia";
import { SESSION_COOKIE } from "./account.ts";
import * as accounts from "./company-accounts.ts";
import * as companies from "./companies.ts";
import { COMPANY_COOKIE } from "./empresas.ts";
import { type SubjectKind, isVerified, issue, markVerified, redeem } from "./email-tokens.ts";
import { publicUrl, resetMail, send } from "./mail.ts";
import * as users from "./users.ts";
import { home, sendVerification } from "./verification.ts";

/**
 * Lo que viaja por correo: confirmar la dirección y cambiar la contraseña sin
 * saber la anterior. Personas y empresas comparten los enlaces; cada token
 * sabe de qué tipo de cuenta es.
 */
const tokenOf = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

async function sendReset(kind: SubjectKind, id: string, email: string): Promise<void> {
  const token = issue("reset", kind, id, email);
  if (!token) return;

  const link = `${home(kind)}?restablecer=${token}`;
  const sent = await send(resetMail(email, link));
  if (!sent.ok) console.error(`[jobit] reset sin mandar: ${sent.error}`);
}

/**
 * El pedido de reset contesta siempre lo mismo y enseguida, exista la cuenta o
 * no. Si esperara a Resend, tardaría más cuando la cuenta existe y tiene
 * correo, y el tiempo de respuesta diría quién está registrado.
 */
const inBackground = (work: Promise<unknown>): void => {
  work.catch((cause) => console.error(`[jobit] correo en segundo plano: ${String(cause)}`));
};

const SAME_ANSWER = {
  status: "ok",
  message: "Si hay una cuenta con correo cargado, te mandamos un enlace. Vence en 30 minutos.",
} as const;

export const email = new Elysia()
  /**
   * GET porque es un enlace que se toca desde un cliente de correo. Los
   * escáneres de seguridad de algunos correos corporativos abren los enlaces
   * antes que la persona y lo van a consumir: acá eso no hace daño, porque lo
   * que prueba es justamente que el buzón recibió el mensaje.
   */
  .get(
    "/api/auth/email/verify",
    async ({ query, redirect }) => {
      const redeemed = redeem("verify", query.token);
      if (!redeemed.ok) return redirect(`${publicUrl()}/?correo=vencido`, 303);

      const { kind, id, emailHash } = redeemed.value;
      markVerified(kind, id, emailHash);
      return redirect(`${home(kind)}?correo=verificado`, 303);
    },
    { query: t.Object({ token: t.String({ maxLength: 100 }) }) },
  )
  .post(
    "/api/auth/recover/email",
    async ({ body }) => {
      const user = users.byHandle(body.handle);
      if (user) {
        inBackground(
          users
            .emailOf(user)
            .then((address) => (address ? sendReset("user", user.id, address) : undefined)),
        );
      }
      return SAME_ANSWER;
    },
    { body: t.Object({ handle: t.String({ maxLength: 40 }) }) },
  )
  .post(
    "/api/empresas/auth/recover",
    async ({ body }) => {
      const company = companies.byEmailOrSlug(body.identifier);
      if (company?.email && accounts.hasAccount(company.id)) {
        inBackground(sendReset("company", company.id, company.email));
      }
      return SAME_ANSWER;
    },
    { body: t.Object({ identifier: t.String({ maxLength: 300 }) }) },
  )
  /** El reset en sí. El token dice de qué cuenta es; no hace falta sesión. */
  .post(
    "/api/auth/reset",
    async ({ body, status }) => {
      const redeemed = redeem("reset", body.token);
      if (!redeemed.ok) return status(422, { error: redeemed.error });

      const { kind, id } = redeemed.value;
      if (kind === "user") {
        const done = await users.resetPassword(id, body.password);
        return done.ok ? { status: "ok", kind } : status(422, { error: done.error });
      }

      const done = await accounts.setPassword(id, body.password);
      if (!done.ok) return status(422, { error: done.error });
      accounts.destroyAllSessions(id);
      return { status: "ok", kind };
    },
    {
      body: t.Object({
        token: t.String({ maxLength: 100 }),
        password: t.String({ minLength: 1, maxLength: 200 }),
      }),
    },
  )
  /** Reenviar la verificación, con sesión. */
  .post("/api/me/email/verify", async ({ cookie, status }) => {
    const user = users.sessionUser(tokenOf(cookie[SESSION_COOKIE]?.value));
    if (!user) return status(401, { error: "sesión vencida" });

    const address = await users.emailOf(user);
    if (!address) return status(422, { error: "no hay un correo cargado" });
    if (isVerified("user", user.id, address)) return { status: "ok", verified: true };

    await sendVerification("user", user.id, address);
    return { status: "ok", verified: false };
  })
  .post("/api/empresas/me/email/verify", async ({ cookie, status }) => {
    const company = accounts.sessionCompany(tokenOf(cookie[COMPANY_COOKIE]?.value));
    if (!company) return status(401, { error: "sesión vencida" });
    if (!company.email) return status(422, { error: "no hay un correo cargado" });
    if (isVerified("company", company.id, company.email)) return { status: "ok", verified: true };

    await sendVerification("company", company.id, company.email);
    return { status: "ok", verified: false };
  });
