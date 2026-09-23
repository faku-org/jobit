import { Elysia, t } from "elysia";
import { encryptionEnabled, sign, verifySignature } from "./crypto.ts";
import { generateSecret, otpauthUrl, verifyTotp } from "./totp.ts";
import * as users from "./users.ts";

/**
 * Las cuentas de quien publica, separadas de las del panel.
 *
 * Es otra cookie (`jobit_session`, alcance /api) y otra tabla
 * (`user_sessions`): una sesión de usuario no sirve para /api/admin y una del
 * panel no sirve para acá. Comparten el mecanismo, no el alcance.
 *
 * La cookie dura 30 días porque quien publica un servicio no entra todos los
 * días, y se renueva sola con el uso. `Secure` sale de la misma variable de
 * escape que el panel, que existe solo para desarrollo sobre http://.
 */
export const SESSION_COOKIE = "jobit_session";
const CHALLENGE_COOKIE = "jobit_2fa";
const CHALLENGE_MS = 5 * 60_000;
const ISSUER = "JobIt";

const SECURE_COOKIES = process.env.ADMIN_INSECURE_COOKIES !== "true";

/** Elysia entrega la cookie como unknown mientras no se le declare un esquema. */
const tokenOf = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const setSession = (
  cookie: Record<string, { set: (options: Record<string, unknown>) => void } | undefined>,
  session: users.UserSession,
): void => {
  cookie[SESSION_COOKIE]?.set({
    value: session.token,
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: "lax",
    path: "/api",
    expires: new Date(session.expiresAt),
  });
};

/**
 * El segundo paso no crea sesión: el desafío viaja en una cookie propia,
 * firmada con la clave del servidor y de cinco minutos, así que entre el login
 * y el código no hay ninguna sesión abierta.
 */
async function signChallenge(userId: string, now: number = Date.now()): Promise<string | null> {
  const payload = `${userId}.${now + CHALLENGE_MS}`;
  const signature = await sign(payload);
  return signature.ok ? `${payload}.${signature.value}` : null;
}

async function readChallenge(token: string): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresAt, signature] = parts;
  if (!userId || !expiresAt || !signature) return null;

  const expires = Number(expiresAt);
  if (!Number.isFinite(expires) || expires < Date.now()) return null;
  return (await verifySignature(`${userId}.${expiresAt}`, signature)) ? userId : null;
}

const publicUser = (user: users.User) => users.publicUser(user);

const registerBody = t.Object({
  handle: t.String({ maxLength: 60 }),
  display_name: t.String({ maxLength: 120 }),
  password: t.String({ minLength: 8, maxLength: 200 }),
  email: t.Optional(t.String({ maxLength: 300 })),
});

const loginBody = t.Object({
  handle: t.String({ maxLength: 60 }),
  password: t.String({ maxLength: 200 }),
});

const passwordBody = t.Object({ password: t.String({ maxLength: 200 }) });
const totpCodeBody = t.Object({ code: t.String({ maxLength: 10 }) });
const recoverBody = t.Object({
  handle: t.String({ maxLength: 60 }),
  code: t.String({ maxLength: 20 }),
});
const totpSetupBody = t.Object({ code: t.Optional(t.String({ maxLength: 10 })) });
const patchMeBody = t.Object({
  display_name: t.Optional(t.String({ maxLength: 120 })),
  email: t.Optional(t.String({ maxLength: 300 })),
  current_password: t.Optional(t.String({ maxLength: 200 })),
  new_password: t.Optional(t.String({ minLength: 8, maxLength: 200 })),
});

export const account = new Elysia({ prefix: "/api" })
  .post(
    "/auth/register",
    async ({ body, cookie, status }) => {
      const created = await users.create(body);
      if (!created.ok) return status(422, { error: created.error });

      setSession(cookie, users.createSession(created.value.user.id));
      return status(201, {
        status: "ok",
        /** Se muestran una sola vez: en la base queda el sha256. */
        recovery_codes: created.value.recoveryCodes,
        user: publicUser(created.value.user),
      });
    },
    { body: registerBody },
  )
  .post(
    "/auth/login",
    async ({ body, cookie, status }) => {
      const user = users.byHandle(body.handle);
      /** Una sola respuesta para el handle que no existe y la clave que no es. */
      if (!user || !(await users.verifyPassword(user, body.password))) {
        return status(401, { error: "handle o contraseña incorrectos" });
      }
      if (user.status !== "active") return status(403, { error: "esa cuenta está suspendida" });

      if (user.totp_enabled) {
        const challenge = await signChallenge(user.id);
        if (!challenge) return status(503, { error: "el segundo paso no está disponible" });
        cookie[CHALLENGE_COOKIE]?.set({
          value: challenge,
          httpOnly: true,
          secure: SECURE_COOKIES,
          sameSite: "lax",
          path: "/api",
          maxAge: CHALLENGE_MS / 1000,
        });
        return { status: "totp_required" };
      }

      setSession(cookie, users.createSession(user.id));
      return { status: "ok", user: publicUser(user) };
    },
    { body: loginBody },
  )
  .post(
    "/auth/totp",
    async ({ body, cookie, status }) => {
      const userId = await readChallenge(tokenOf(cookie[CHALLENGE_COOKIE]?.value) ?? "");
      if (!userId) return status(401, { error: "el segundo paso venció, volvé a entrar" });

      const user = users.byId(userId);
      if (!user || user.status !== "active") return status(401, { error: "esa cuenta no está" });

      const secret = await users.totpSecret(user);
      if (!secret) return status(401, { error: "esa cuenta no tiene segundo paso" });

      const check = await verifyTotp(secret, body.code);
      if (!check.ok) return status(401, { error: "código incorrecto" });

      setSession(cookie, users.createSession(user.id));
      cookie[CHALLENGE_COOKIE]?.remove();
      return { status: "ok", user: publicUser(user) };
    },
    { body: totpCodeBody },
  )
  .post(
    "/auth/recover",
    ({ body, cookie, status }) => {
      const user = users.byHandle(body.handle);
      if (!user || user.status !== "active") return status(401, { error: "handle o código incorrectos" });
      if (!users.consumeRecoveryCode(user.id, body.code)) {
        return status(401, { error: "handle o código incorrectos" });
      }

      setSession(cookie, users.createSession(user.id));
      return { status: "ok", user: publicUser(user) };
    },
    { body: recoverBody },
  )
  .post("/auth/logout", ({ cookie }) => {
    users.destroySession(tokenOf(cookie[SESSION_COOKIE]?.value));
    cookie[SESSION_COOKIE]?.remove();
    return { status: "ok" };
  })
  /** De acá para abajo hay que estar adentro. */
  .guard({
    beforeHandle({ cookie, status }) {
      if (!users.sessionUser(tokenOf(cookie[SESSION_COOKIE]?.value))) {
        return status(401, { error: "sesión vencida" });
      }
    },
  })
  .get("/me", ({ cookie, status }) => {
    const user = users.sessionUser(tokenOf(cookie[SESSION_COOKIE]?.value));
    if (!user) return status(401, { error: "sesión vencida" });
    return { user: publicUser(user) };
  })
  .patch(
    "/me",
    async ({ body, cookie, status }) => {
      const user = users.sessionUser(tokenOf(cookie[SESSION_COOKIE]?.value));
      if (!user) return status(401, { error: "sesión vencida" });

      if (body.new_password !== undefined) {
        const current = body.current_password;
        if (!current || !(await users.verifyPassword(user, current))) {
          return status(401, { error: "la contraseña actual no coincide" });
        }
        users.setPasswordHash(user.id, await users.hashPassword(body.new_password));
      }

      if (body.display_name !== undefined) {
        const renamed = users.setDisplayName(user.id, body.display_name);
        if (!renamed.ok) return status(422, { error: renamed.error });
      }

      if (body.email !== undefined) {
        const changed = await users.setEmail(user.id, body.email);
        if (!changed.ok) return status(422, { error: changed.error });
      }

      const updated = users.byId(user.id);
      return { user: publicUser(updated ?? user) };
    },
    { body: patchMeBody },
  )
  .delete(
    "/me",
    async ({ body, cookie, status }) => {
      const user = users.sessionUser(tokenOf(cookie[SESSION_COOKIE]?.value));
      if (!user) return status(401, { error: "sesión vencida" });
      if (!(await users.verifyPassword(user, body.password))) {
        return status(401, { error: "la contraseña no coincide" });
      }

      users.remove(user.id);
      cookie[SESSION_COOKIE]?.remove();
      return { status: "ok" };
    },
    { body: passwordBody },
  )
  /**
   * Sin `code` arranca la activación y devuelve el secreto (una vez, para
   * dibujar el QR). Con `code`, lo confirma y recién ahí queda activado.
   */
  .post(
    "/me/totp",
    async ({ body, cookie, status }) => {
      const user = users.sessionUser(tokenOf(cookie[SESSION_COOKIE]?.value));
      if (!user) return status(401, { error: "sesión vencida" });

      if (body.code !== undefined) {
        const secret = await users.totpSecret(user);
        if (!secret) return status(422, { error: "no hay un segundo paso pendiente" });

        const check = await verifyTotp(secret, body.code);
        if (!check.ok) return status(401, { error: "código incorrecto" });

        users.enableTotp(user.id);
        return { status: "ok", totp_enabled: true };
      }

      if (user.totp_enabled) return status(422, { error: "el segundo paso ya está activado" });
      if (!(await encryptionEnabled())) {
        return status(503, { error: "el segundo paso no está disponible en este servidor" });
      }

      const secret = generateSecret();
      const saved = await users.setTotpSecret(user.id, secret);
      if (!saved.ok) return status(503, { error: saved.error });

      return {
        secret,
        otpauth: otpauthUrl({ secret, account: user.handle, issuer: ISSUER }),
      };
    },
    { body: totpSetupBody },
  )
  .delete(
    "/me/totp",
    async ({ body, cookie, status }) => {
      const user = users.sessionUser(tokenOf(cookie[SESSION_COOKIE]?.value));
      if (!user) return status(401, { error: "sesión vencida" });
      if (!(await users.verifyPassword(user, body.password))) {
        return status(401, { error: "la contraseña no coincide" });
      }

      users.disableTotp(user.id);
      return { status: "ok", totp_enabled: false };
    },
    { body: passwordBody },
  );
