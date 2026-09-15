import { Elysia, t } from "elysia";
import { secureCookies } from "./auth.ts";
import { accountsEnabled } from "./secrets.ts";
import * as services from "./services.ts";
import * as users from "./users.ts";
import { verifyTotp } from "./totp.ts";

/**
 * El lado de quien publica: alta, entrada, segundo factor y perfil.
 *
 * Nada de esto se sirve si falta ACCOUNT_KEY, igual que el panel sin su hash:
 * sin clave no hay con qué cifrar el correo ni el secreto del segundo factor,
 * y un despliegue así tiene que quedarse sin cuentas antes que guardar esos
 * datos en claro.
 */
export const USER_COOKIE = "jobit_session";

/** Elysia entrega el valor de la cookie como unknown mientras no se le declare
 * un esquema; acá alcanza con quedarse solo con lo que sea texto. */
const tokenOf = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

/**
 * `lax` y no `strict` como el panel: un enlace a un servicio compartido por
 * fuera del sitio tiene que llegar con la sesión puesta o la persona ve la
 * página como si nunca hubiera entrado. Lax igual no manda la cookie en un
 * POST de otro origen, que es el vector de CSRF que importa acá.
 *
 * El camino es /api y no /api/admin: son dos sesiones distintas, con nombres
 * distintos, y ninguna llega a las rutas de la otra por accidente.
 */
const cookieOptions = (expiresAt: string) =>
  ({
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/api",
    expires: new Date(expiresAt),
  }) as const;

const passwordSchema = t.String({ minLength: 1, maxLength: 200 });

const registerBody = t.Object({
  handle: t.String({ maxLength: 40 }),
  display_name: t.String({ maxLength: 80 }),
  password: passwordSchema,
  email: t.Optional(t.String({ maxLength: 200 })),
});

const loginBody = t.Object({
  handle: t.String({ maxLength: 40 }),
  password: passwordSchema,
});

const codeSchema = t.String({ maxLength: 10 });

export const account = new Elysia({ prefix: "/api" })
  .guard({
    beforeHandle({ status }) {
      if (!accountsEnabled()) return status(404, { error: "no encontrado" });
    },
  })
  .post(
    "/auth/register",
    async ({ body, cookie, status }) => {
      const created = await users.register(body);
      if (!created.ok) return status(422, { error: created.error });

      const session = users.startSession(created.value.user.id);
      cookie[USER_COOKIE]?.set({ value: session.token, ...cookieOptions(session.expiresAt) });

      /** Los códigos salen una sola vez y en ningún lado más: si la persona no
       * dejó correo, esto es literalmente lo único que la separa de perder la
       * cuenta, y la pantalla del alta tiene que decirlo así. */
      return status(201, {
        status: "ok",
        user: created.value.user,
        recovery_codes: created.value.recovery_codes,
        warning: created.value.user.has_email
          ? "Guardá los códigos de respaldo: son la salida si perdés el acceso."
          : "Sin correo no hay forma de recuperar la cuenta. Guardá los códigos de respaldo ahora: no se vuelven a mostrar.",
      });
    },
    { body: registerBody },
  )
  .post(
    "/auth/login",
    async ({ body, cookie, status }) => {
      const user = await users.verifyLogin(body.handle, body.password);
      /** El mismo mensaje para handle inexistente, clave mala y cuenta
       * suspendida: la respuesta no es un directorio de quién está registrado. */
      if (!user) return status(401, { error: "usuario o contraseña incorrectos" });

      const stage = user.totp_enabled === 1 ? "totp" : "open";
      const session = users.startSession(user.id, stage);
      cookie[USER_COOKIE]?.set({ value: session.token, ...cookieOptions(session.expiresAt) });

      return stage === "totp" ? { status: "totp" } : { status: "ok", user: users.publicUser(user) };
    },
    { body: loginBody },
  )
  /** El segundo paso. La sesión a medio abrir ya está en la cookie, así que no
   * hay un token de desafío dando vueltas por fuera. */
  .post(
    "/auth/totp",
    async ({ body, cookie, status }) => {
      const token = tokenOf(cookie[USER_COOKIE]?.value);
      const user = users.pendingTotpUser(token);
      if (!token || !user) return status(401, { error: "volvé a entrar" });

      const secret = await users.totpSecretOf(user);
      if (!secret || !(await verifyTotp(secret, body.code))) {
        return status(401, { error: "ese código no coincide" });
      }

      const expiresAt = users.openSession(token);
      cookie[USER_COOKIE]?.set({ value: token, ...cookieOptions(expiresAt) });
      return { status: "ok", user: users.publicUser(user) };
    },
    { body: t.Object({ code: t.String({ maxLength: 10 }) }) },
  )
  /**
   * Un código de respaldo cambia la contraseña y cierra todo lo abierto.
   *
   * La recuperación por correo no está: mandar un mail pide salida de correo
   * configurada, que es justo la dependencia que el diseño evitó desde el día
   * uno. Mientras no exista, el correo guardado no sirve para entrar, y eso es
   * lo que hay que decir en el alta.
   */
  .post(
    "/auth/recover",
    async ({ body, status }) => {
      const done = await users.recoverWithCode(body.handle, body.code, body.password);
      return done.ok ? { status: "ok" } : status(422, { error: done.error });
    },
    {
      body: t.Object({
        handle: t.String({ maxLength: 40 }),
        code: t.String({ maxLength: 20 }),
        password: passwordSchema,
      }),
    },
  )
  .post("/auth/logout", ({ cookie }) => {
    users.destroySession(tokenOf(cookie[USER_COOKIE]?.value));
    cookie[USER_COOKIE]?.remove();
    return { status: "ok" };
  })
  /** De acá para abajo hace falta una sesión abierta. `resolve` corta con 401
   * cuando no la hay, así que el handler ya recibe a la persona resuelta y no
   * vuelve a buscarla. */
  .resolve(({ cookie, status }) => {
    const user = users.sessionUser(tokenOf(cookie[USER_COOKIE]?.value));
    if (!user) return status(401, { error: "sesión vencida" });
    return { user };
  })
  .get("/me", ({ user }) => ({
    user: users.publicUser(user),
    recovery_codes_left: users.recoveryCodesLeft(user.id),
    services: services.countByUser(user.id),
  }))
  .patch(
    "/me",
    async ({ user, body, status }) => {
      const updated = await users.updateProfile(user.id, body);
      return updated.ok ? { user: updated.value } : status(422, { error: updated.error });
    },
    {
      body: t.Object({
        display_name: t.Optional(t.String({ maxLength: 80 })),
        email: t.Optional(t.String({ maxLength: 200 })),
      }),
    },
  )
  /** Borra de verdad: la cuenta, sus sesiones, sus códigos y sus servicios. */
  .delete(
    "/me",
    async ({ user, body, cookie, status }) => {
      const done = await users.removeAccount(user.id, body.password);
      if (!done.ok) return status(422, { error: done.error });

      cookie[USER_COOKIE]?.remove();
      return { status: "ok" };
    },
    { body: t.Object({ password: passwordSchema }) },
  )
  .post(
    "/me/password",
    async ({ user, body, cookie, status }) => {
      const done = await users.changePassword(user.id, body.current, body.next);
      if (!done.ok) return status(422, { error: done.error });

      /** Cambiar la clave cerró todas las sesiones, la de acá incluida. */
      cookie[USER_COOKIE]?.remove();
      return { status: "ok" };
    },
    {
      body: t.Object({ current: passwordSchema, next: passwordSchema }),
    },
  )
  /** Cierra todo lo abierto de la cuenta. Sirve para la sesión que quedó en
   * una máquina prestada, que es el único "último acceso" que se puede ofrecer
   * sin guardar de dónde entró cada uno. */
  .post("/me/sessions/close", ({ user, cookie }) => {
    users.destroyUserSessions(user.id);
    cookie[USER_COOKIE]?.remove();
    return { status: "ok" };
  })
  .post("/me/recovery-codes", ({ user }) => ({
    recovery_codes: users.regenerateRecoveryCodes(user.id),
  }))
  /** Devuelve el secreto y el otpauth:// una sola vez. El QR lo dibuja el
   * navegador: no hace falta que el secreto pase por una imagen del servidor. */
  .post("/me/totp", async ({ user, status }) => {
    const setup = await users.startTotp(user.id);
    return setup.ok ? setup.value : status(422, { error: setup.error });
  })
  .post(
    "/me/totp/confirm",
    async ({ user, body, status }) => {
      const done = await users.confirmTotp(user.id, body.code);
      return done.ok ? { status: "ok" } : status(422, { error: done.error });
    },
    { body: t.Object({ code: codeSchema }) },
  )
  .delete(
    "/me/totp",
    async ({ user, body, status }) => {
      const done = await users.disableTotp(user.id, body.password);
      return done.ok ? { status: "ok" } : status(422, { error: done.error });
    },
    { body: t.Object({ password: passwordSchema }) },
  );
