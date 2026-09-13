import { Elysia, t } from "elysia";
import { type CookieJar, clearSessionCookie, sessionToken, setSessionCookie } from "./session.ts";
import * as users from "./users.ts";

/**
 * El lado de quien publica: alta, login, segundo paso, recuperación y borrado.
 * Nada de esto toca /api/admin, que sigue siendo otra sesión con otra cookie.
 *
 * El login es por handle y contraseña, no por correo, justamente para que el
 * correo pueda faltar.
 */
const registerBody = t.Object({
  handle: t.String({ maxLength: 40 }),
  display_name: t.String({ maxLength: 80 }),
  password: t.String({ maxLength: 200 }),
  email: t.Optional(t.String({ maxLength: 300 })),
});

const meBody = t.Object({
  display_name: t.Optional(t.String({ maxLength: 80 })),
  email: t.Optional(t.Union([t.String({ maxLength: 300 }), t.Null()])),
  password: t.Optional(t.String({ maxLength: 200 })),
  /** Hace falta para cambiar la clave o el correo, que es la recuperación. */
  current_password: t.Optional(t.String({ maxLength: 200 })),
});

export const accounts = new Elysia()
  .post(
    "/api/auth/register",
    async ({ body, cookie, status }) => {
      const created = await users.createUser(body);
      if (!created.ok) return status(422, { error: created.error });

      const session = users.createUserSession(created.value.user.id);
      setSessionCookie(cookie as CookieJar, session.token, session.expiresAt);

      return status(201, {
        user: created.value.user,
        recovery_codes: created.value.recovery_codes,
      });
    },
    { body: registerBody },
  )
  .post(
    "/api/auth/login",
    async ({ body, cookie, status }) => {
      const user = await users.verifyCredentials(body);
      /** El mismo error para usuario que no existe y clave que no coincide. */
      if (!user) return status(401, { error: "usuario o contraseña incorrectos" });

      const session = users.createUserSession(user.id, { pendingTotp: user.totp_enabled });
      setSessionCookie(cookie as CookieJar, session.token, session.expiresAt);

      return user.totp_enabled ? { status: "totp" as const } : { status: "ok" as const, user };
    },
    {
      body: t.Object({
        handle: t.String({ maxLength: 40 }),
        password: t.String({ maxLength: 200 }),
      }),
    },
  )
  /** El segundo paso: la sesión a medio abrir viaja en la misma cookie. */
  .post(
    "/api/auth/totp",
    async ({ body, cookie, status }) => {
      const token = sessionToken(cookie as CookieJar);
      const userId = users.pendingSessionUser(token);
      if (!token || !userId) return status(401, { error: "volvé a empezar el ingreso" });

      if (!(await users.verifyTotp(userId, body.code))) {
        return status(401, { error: "ese código no coincide" });
      }

      const expiresAt = users.confirmSession(token);
      setSessionCookie(cookie as CookieJar, token, expiresAt);

      return { status: "ok" as const, user: users.byId(userId) };
    },
    { body: t.Object({ code: t.String({ maxLength: 10 }) }) },
  )
  /**
   * Recuperación con un código de respaldo. Por correo todavía no hay: el
   * sistema no manda mails, y prometerlo sería mentir en el alta.
   */
  .post(
    "/api/auth/recover",
    async ({ body, status }) => {
      const recovered = await users.recoverWithCode(body.handle, body.code, body.password);
      return recovered.ok
        ? { status: "ok" as const, ...recovered.value }
        : status(422, { error: recovered.error });
    },
    {
      body: t.Object({
        handle: t.String({ maxLength: 40 }),
        code: t.String({ maxLength: 40 }),
        password: t.String({ maxLength: 200 }),
      }),
    },
  )
  .post(
    "/api/auth/logout",
    ({ body, cookie }) => {
      const token = sessionToken(cookie as CookieJar);
      if (body?.all === true) {
        const user = users.sessionUser(token);
        if (user) users.destroyUserSessions(user.id);
      } else {
        users.destroyUserSession(token);
      }

      clearSessionCookie(cookie as CookieJar);
      return { status: "ok" };
    },
    { body: t.Optional(t.Object({ all: t.Optional(t.Boolean()) })) },
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
  .get("/api/me", ({ me }) => ({ user: me, recovery: users.recoveryState(me.id) }))
  .patch(
    "/api/me",
    async ({ body, me, status }) => {
      const touchesSecrets = body.password !== undefined || body.email !== undefined;
      if (touchesSecrets && !(await users.passwordMatches(me.id, body.current_password ?? ""))) {
        return status(403, { error: "hace falta la contraseña actual" });
      }

      const updated = await users.updateUser(me.id, {
        display_name: body.display_name,
        email: body.email,
        password: body.password,
      });
      if (!updated.ok) return status(422, { error: updated.error });

      /** Cambiar la clave cierra lo que haya abierto en otro lado. La sesión
       * de acá se cierra también: es la forma honesta de que "cerrar todo"
       * signifique todo. */
      if (body.password !== undefined) users.destroyUserSessions(me.id);

      return { user: updated.value };
    },
    { body: meBody },
  )
  .delete(
    "/api/me",
    async ({ body, cookie, me, status }) => {
      if (!(await users.passwordMatches(me.id, body.password))) {
        return status(403, { error: "hace falta la contraseña actual" });
      }

      users.removeUser(me.id);
      clearSessionCookie(cookie as CookieJar);
      return { status: "ok" };
    },
    { body: t.Object({ password: t.String({ maxLength: 200 }) }) },
  )
  /** Sin código devuelve el secreto para escanear; con código lo confirma. */
  .post(
    "/api/me/totp",
    async ({ body, me, status }) => {
      if (body?.code) {
        const confirmed = await users.confirmTotp(me.id, body.code);
        return confirmed.ok
          ? { status: "ok" as const, user: confirmed.value }
          : status(422, { error: confirmed.error });
      }

      const started = await users.startTotp(me.id);
      return started.ok ? started.value : status(422, { error: started.error });
    },
    { body: t.Optional(t.Object({ code: t.Optional(t.String({ maxLength: 10 })) })) },
  )
  .delete(
    "/api/me/totp",
    async ({ body, me, status }) => {
      if (!(await users.passwordMatches(me.id, body.password))) {
        return status(403, { error: "hace falta la contraseña actual" });
      }

      users.disableTotp(me.id);
      return { status: "ok", user: users.byId(me.id) };
    },
    { body: t.Object({ password: t.String({ maxLength: 200 }) }) },
  );
