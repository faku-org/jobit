import { Elysia, t } from "elysia";
import { secureCookies } from "./auth.ts";
import { encryptionEnabled, sign, verifySignature } from "./crypto.ts";
import * as sync from "./sync.ts";
import { verifyTotp } from "./totp.ts";
import * as users from "./users.ts";
import * as passkeys from "./passkeys.ts";
import { isVerified } from "./email-tokens.ts";
import { verifyInBackground } from "./verification.ts";

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
/** El desafío de la llave entre que se piden opciones y vuelve la firma. */
const WEBAUTHN_COOKIE = "jobit_webauthn";
const CHALLENGE_MS = 5 * 60_000;

const SECURE_COOKIES = secureCookies();

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

/** `passkeys` es cuántas llaves tiene, no cuáles: la lista se pide aparte y
 * con sesión. `totp_enabled` sigue saliendo mientras haya cuentas que lo
 * tengan de antes, para que la web les ofrezca pasarse a una llave. */
const publicUser = (user: users.User) => ({
  ...users.publicUser(user),
  passkeys: passkeys.countFor(user.id),
});

/** Lo mismo más si el correo está verificado. Es aparte porque saberlo pide
 * descifrar el correo, y publicUser es sincrónico y se usa en todos lados. */
async function withVerification(user: users.User) {
  const address = await users.emailOf(user);
  return { ...publicUser(user), email_verified: isVerified("user", user.id, address) };
}

/** Si la cuenta tiene un correo sin verificar, manda la verificación. */
async function verifyIfNeeded(user: users.User): Promise<void> {
  const address = await users.emailOf(user);
  if (address && !isVerified("user", user.id, address))
    verifyInBackground("user", user.id, address);
}

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
/** HttpOnly y strict: el desafío solo viaja en las llamadas de la propia web. */
function setWebauthnCookie(
  cookie: Record<string, { set: (options: Record<string, unknown>) => void } | undefined>,
  token: string,
): void {
  cookie[WEBAUTHN_COOKIE]?.set({
    value: token,
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: "strict",
    path: "/api",
    maxAge: passkeys.CHALLENGE_SECONDS,
  });
}

/** La respuesta del navegador la valida entera la biblioteca de WebAuthn; acá
 * solo se exige que sea un objeto. */
const credentialBody = t.Object({
  response: t.Any(),
  name: t.Optional(t.String({ maxLength: 60 })),
});

const totpCodeBody = t.Object({ code: t.String({ maxLength: 10 }) });
const recoverBody = t.Object({
  handle: t.String({ maxLength: 60 }),
  code: t.String({ maxLength: 20 }),
});
const patchMeBody = t.Object({
  display_name: t.Optional(t.String({ maxLength: 120 })),
  email: t.Optional(t.String({ maxLength: 300 })),
  current_password: t.Optional(t.String({ maxLength: 200 })),
  new_password: t.Optional(t.String({ minLength: 8, maxLength: 200 })),
});
const syncBody = t.Object({ payload: t.Any() });

export const account = new Elysia({ prefix: "/api" })
  .post(
    "/auth/register",
    async ({ body, cookie, status }) => {
      const created = await users.create(body);
      if (!created.ok) return status(422, { error: created.error });

      setSession(cookie, users.createSession(created.value.user.id));
      await verifyIfNeeded(created.value.user);
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

      if (passkeys.countFor(user.id) > 0) {
        const pending = await passkeys.startLogin(user);
        setWebauthnCookie(cookie, pending.token);
        return { status: "passkey_required", options: pending.options };
      }

      /** TOTP ya no se activa, pero quien lo tenía de antes sigue entrando con
       * él hasta que agregue una llave, que es cuando se borra el secreto.
       * Sacarlo de golpe le bajaría la seguridad a solo contraseña. */
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
    "/auth/passkey",
    async ({ body, cookie, status }) => {
      const token = tokenOf(cookie[WEBAUTHN_COOKIE]?.value);
      cookie[WEBAUTHN_COOKIE]?.remove();
      if (!token) return status(401, { error: "el segundo paso venció, volvé a entrar" });

      const signed = await passkeys.finishLogin(token, body.response);
      if (!signed.ok) return status(401, { error: signed.error });

      const user = users.byId(signed.value);
      if (!user || user.status !== "active") return status(401, { error: "esa cuenta no está" });

      setSession(cookie, users.createSession(user.id));
      return { status: "ok", user: publicUser(user) };
    },
    { body: credentialBody },
  )
  .post(
    "/auth/recover",
    ({ body, cookie, status }) => {
      const user = users.byHandle(body.handle);
      if (!user || user.status !== "active")
        return status(401, { error: "handle o código incorrectos" });
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
  .get("/me", async ({ cookie, status }) => {
    const user = users.sessionUser(tokenOf(cookie[SESSION_COOKIE]?.value));
    if (!user) return status(401, { error: "sesión vencida" });
    return { user: await withVerification(user) };
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
        /** Un correo nuevo arranca sin verificar: la verificación vieja era de
         * otra dirección y deja de valer sola, por el hash. */
        await verifyIfNeeded(changed.value);
      }

      const updated = users.byId(user.id);
      return { user: await withVerification(updated ?? user) };
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
   * El TOTP ya no se activa. Para verificarlo el servidor tenía que guardar el
   * secreto, o sea poder generar el código de cualquiera: justo lo que la regla
   * de cero acceso dice que JobIt no tiene. El segundo paso ahora es una llave
   * de acceso (/me/passkeys). Quien ya lo tenía sigue entrando con él hasta
   * que agregue una llave, y puede apagarlo con DELETE.
   */
  .post("/me/totp", ({ status }) =>
    status(410, {
      error: "el segundo paso ahora es con una llave de acceso: agregala desde tu perfil",
    }),
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
  )
  /** Las llaves de la cuenta: un nombre y el día del alta, nada más. */
  .get("/me/passkeys", ({ cookie, status }) => {
    const user = users.sessionUser(tokenOf(cookie[SESSION_COOKIE]?.value));
    if (!user) return status(401, { error: "sesión vencida" });
    return { passkeys: passkeys.listFor(user.id) };
  })
  .post("/me/passkeys/options", async ({ cookie, status }) => {
    const user = users.sessionUser(tokenOf(cookie[SESSION_COOKIE]?.value));
    if (!user) return status(401, { error: "sesión vencida" });

    const pending = await passkeys.startRegistration(user);
    if (!pending.ok) return status(422, { error: pending.error });
    setWebauthnCookie(cookie, pending.value.token);
    return pending.value.options;
  })
  .post(
    "/me/passkeys",
    async ({ body, cookie, status }) => {
      const user = users.sessionUser(tokenOf(cookie[SESSION_COOKIE]?.value));
      if (!user) return status(401, { error: "sesión vencida" });

      const token = tokenOf(cookie[WEBAUTHN_COOKIE]?.value);
      cookie[WEBAUTHN_COOKIE]?.remove();
      if (!token) return status(422, { error: "el pedido venció, probá de nuevo" });

      const added = await passkeys.finishRegistration(user, token, body.response, body.name ?? "");
      return added.ok ? status(201, added.value) : status(422, { error: added.error });
    },
    { body: credentialBody },
  )
  /** Sacar una llave pide la contraseña, igual que apagar el TOTP: alguien
   * frente a una sesión abierta no puede desarmar el segundo paso. */
  .delete(
    "/me/passkeys/:id",
    async ({ params, body, cookie, status }) => {
      const user = users.sessionUser(tokenOf(cookie[SESSION_COOKIE]?.value));
      if (!user) return status(401, { error: "sesión vencida" });
      if (!(await users.verifyPassword(user, body.password))) {
        return status(401, { error: "la contraseña no coincide" });
      }
      return passkeys.remove(user.id, params.id)
        ? { status: "ok", passkeys: passkeys.countFor(user.id) }
        : status(404, { error: "esa llave no existe" });
    },
    { body: passwordBody },
  )
  /**
   * Lo que la persona eligió llevar entre navegadores. El servidor guarda un
   * JSON opaco y cifrado: no lo lee, no lo cuenta y no lo cruza con nada.
   */
  .get("/me/sync", async ({ cookie, status }) => {
    const user = users.sessionUser(tokenOf(cookie[SESSION_COOKIE]?.value));
    if (!user) return status(401, { error: "sesión vencida" });

    const found = await sync.pull(user.id);
    if (!found.ok) return status(503, { error: found.error });
    if (!found.value) return { enabled: false, payload: null, updated_at: "" };

    try {
      return {
        enabled: true,
        payload: JSON.parse(found.value.payload) as unknown,
        updated_at: found.value.updatedAt,
      };
    } catch {
      /** Un guardado que ya no se puede leer no bloquea la cuenta: se pisa con
       * el próximo envío. */
      return { enabled: true, payload: null, updated_at: found.value.updatedAt };
    }
  })
  .put(
    "/me/sync",
    async ({ body, cookie, status }) => {
      const user = users.sessionUser(tokenOf(cookie[SESSION_COOKIE]?.value));
      if (!user) return status(401, { error: "sesión vencida" });
      if (!(await encryptionEnabled())) {
        return status(503, { error: "la sincronización no está disponible en este servidor" });
      }

      const saved = await sync.push(user.id, JSON.stringify(body.payload ?? null));
      if (!saved.ok) return status(422, { error: saved.error });
      return { status: "ok", updated_at: saved.value };
    },
    { body: syncBody },
  )
  .delete("/me/sync", ({ cookie, status }) => {
    const user = users.sessionUser(tokenOf(cookie[SESSION_COOKIE]?.value));
    if (!user) return status(401, { error: "sesión vencida" });
    sync.clear(user.id);
    return { status: "ok" };
  });
