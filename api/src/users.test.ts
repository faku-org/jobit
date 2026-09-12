import { beforeEach, describe, expect, test } from "bun:test";

process.env.DB_FILE = ":memory:";

const { closeDb, db } = await import("./db.ts");
const users = await import("./users.ts");
const { totpCode } = await import("./totp.ts");

beforeEach(() => {
  closeDb();
  process.env.USER_SECRET_KEY = "una clave de prueba, larga y sin gracia";
  delete process.env.USER_SECRET_KEY_FILE;
});

const alta = (extra: Partial<Parameters<typeof users.createUser>[0]> = {}) =>
  users.createUser({
    handle: "juana",
    display_name: "Juana Pérez",
    password: "una clave larga",
    ...extra,
  });

describe("alta", () => {
  test("crea la cuenta y devuelve los códigos una sola vez", async () => {
    const created = await alta();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.value.user.handle).toBe("juana");
    expect(created.value.user.totp_enabled).toBe(false);
    expect(created.value.user.has_email).toBe(false);
    expect(created.value.recovery_codes).toHaveLength(8);
    expect(new Set(created.value.recovery_codes).size).toBe(8);
  });

  test("la fecha es el día y no el momento", async () => {
    const created = await alta();
    if (!created.ok) throw new Error(created.error);
    expect(created.value.user.created_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("el handle se normaliza a minúsculas", async () => {
    const created = await alta({ handle: "  JuAnA  " });
    if (!created.ok) throw new Error(created.error);
    expect(created.value.user.handle).toBe("juana");
  });

  test("rechaza handles que no entran en una URL", async () => {
    for (const handle of ["ab", "-juana", "juana-", "juana pérez", "a".repeat(30)]) {
      expect((await alta({ handle })).ok).toBe(false);
    }
  });

  test("rechaza los handles reservados", async () => {
    expect((await alta({ handle: "admin" })).ok).toBe(false);
  });

  test("no deja dos cuentas con el mismo handle", async () => {
    await alta();
    const repetida = await alta({ display_name: "Otra Juana" });
    expect(repetida.ok).toBe(false);
    if (!repetida.ok) expect(repetida.error).toContain("ya existe");
  });

  test("la contraseña corta no alcanza", async () => {
    expect((await alta({ password: "corta" })).ok).toBe(false);
  });

  test("sin nombre visible se usa el handle", async () => {
    const created = await alta({ display_name: "   " });
    if (!created.ok) throw new Error(created.error);
    expect(created.value.user.display_name).toBe("juana");
  });
});

describe("el correo", () => {
  test("es opcional y queda cifrado en reposo", async () => {
    const created = await alta({ email: "Juana@Ejemplo.com" });
    if (!created.ok) throw new Error(created.error);
    expect(created.value.user.has_email).toBe(true);

    const row = db().query<{ email_enc: string }, []>("SELECT email_enc FROM users").get();
    expect(row?.email_enc).not.toContain("juana@ejemplo.com");
    expect(row?.email_enc).toStartWith("v1.");
  });

  test("uno que no parece un correo no entra", async () => {
    expect((await alta({ email: "juana arroba ejemplo" })).ok).toBe(false);
  });

  /** Sin clave no se guarda en claro: se rechaza el alta con correo. */
  test("sin clave de cifrado no se guarda", async () => {
    delete process.env.USER_SECRET_KEY;
    const created = await alta({ email: "juana@ejemplo.com" });
    expect(created.ok).toBe(false);

    /** La cuenta sin correo sigue siendo posible. */
    expect((await alta()).ok).toBe(true);
  });
});

describe("credenciales", () => {
  test("la clave correcta identifica a la persona", async () => {
    await alta();
    const user = await users.verifyCredentials({ handle: "juana", password: "una clave larga" });
    expect(user?.handle).toBe("juana");
  });

  test("la clave incorrecta no", async () => {
    await alta();
    expect(await users.verifyCredentials({ handle: "juana", password: "otra cosa" })).toBeNull();
  });

  test("una cuenta que no existe tampoco", async () => {
    expect(
      await users.verifyCredentials({ handle: "nadie", password: "una clave larga" }),
    ).toBeNull();
  });

  test("una cuenta suspendida no entra", async () => {
    const created = await alta();
    if (!created.ok) throw new Error(created.error);

    db().run("UPDATE users SET status = 'suspended' WHERE id = ?", [created.value.user.id]);
    expect(
      await users.verifyCredentials({ handle: "juana", password: "una clave larga" }),
    ).toBeNull();
  });
});

describe("sesiones", () => {
  const id = async (): Promise<string> => {
    const created = await alta();
    if (!created.ok) throw new Error(created.error);
    return created.value.user.id;
  };

  test("la recién abierta identifica a quien la abrió", async () => {
    const userId = await id();
    const session = users.createUserSession(userId);
    expect(users.sessionUser(session.token)?.id).toBe(userId);
  });

  test("el token en claro no queda en la base", async () => {
    const session = users.createUserSession(await id());
    const row = db()
      .query<{ token_hash: string }, []>("SELECT token_hash FROM user_sessions")
      .get();
    expect(row?.token_hash).not.toBe(session.token);
    expect(row?.token_hash).toHaveLength(64);
  });

  test("dura treinta días sin volver a usarla", async () => {
    const start = new Date("2026-01-01T10:00:00.000Z");
    const session = users.createUserSession(await id(), {}, start);

    const fuera = new Date("2026-02-15T10:00:00.000Z");
    expect(users.sessionUser(session.token, fuera)).toBeNull();
  });

  test("usarla la renueva, y la fila solo se acuerda del día", async () => {
    const start = new Date("2026-01-01T10:00:00.000Z");
    const session = users.createUserSession(await id(), {}, start);

    const despues = new Date("2026-01-20T10:00:00.000Z");
    expect(users.sessionUser(session.token, despues)).not.toBeNull();

    const row = db()
      .query<{ last_seen: string; expires_at: string }, []>(
        "SELECT last_seen, expires_at FROM user_sessions",
      )
      .get();
    expect(row?.last_seen).toBe("2026-01-20");
    expect(row?.expires_at).toBe("2026-02-19T00:00:00.000Z");
  });

  test("la que espera el segundo paso no vale como sesión", async () => {
    const userId = await id();
    const session = users.createUserSession(userId, { pendingTotp: true });

    expect(users.sessionUser(session.token)).toBeNull();
    expect(users.pendingSessionUser(session.token)).toBe(userId);
  });

  test("y se cae sola a los cinco minutos", async () => {
    const start = new Date("2026-01-01T10:00:00.000Z");
    const session = users.createUserSession(await id(), { pendingTotp: true }, start);

    const tarde = new Date("2026-01-01T10:06:00.000Z");
    expect(users.pendingSessionUser(session.token, tarde)).toBeNull();
  });

  test("confirmarla la convierte en una sesión de verdad", async () => {
    const userId = await id();
    const session = users.createUserSession(userId, { pendingTotp: true });

    users.confirmSession(session.token);
    expect(users.sessionUser(session.token)?.id).toBe(userId);
  });

  test("cerrar una no toca las otras, cerrar todas sí", async () => {
    const userId = await id();
    const primera = users.createUserSession(userId);
    const segunda = users.createUserSession(userId);

    users.destroyUserSession(primera.token);
    expect(users.sessionUser(primera.token)).toBeNull();
    expect(users.sessionUser(segunda.token)).not.toBeNull();

    users.destroyUserSessions(userId);
    expect(users.sessionUser(segunda.token)).toBeNull();
  });

  test("un token inventado no vale", async () => {
    users.createUserSession(await id());
    expect(users.sessionUser("token-inventado")).toBeNull();
    expect(users.sessionUser(undefined)).toBeNull();
  });
});

describe("códigos de respaldo", () => {
  test("sirven una sola vez", async () => {
    const created = await alta();
    if (!created.ok) throw new Error(created.error);

    const [code] = created.value.recovery_codes;
    expect(users.consumeRecoveryCode(created.value.user.id, code ?? "")).toBe(true);
    expect(users.consumeRecoveryCode(created.value.user.id, code ?? "")).toBe(false);
    expect(users.recoveryState(created.value.user.id).remaining).toBe(7);
  });

  test("se comparan sin importar el guión ni las mayúsculas", async () => {
    const created = await alta();
    if (!created.ok) throw new Error(created.error);

    const code = (created.value.recovery_codes[0] ?? "").replace("-", "").toUpperCase();
    expect(users.consumeRecoveryCode(created.value.user.id, code)).toBe(true);
  });

  test("recuperar cambia la clave, apaga el 2FA y cierra las sesiones", async () => {
    const created = await alta();
    if (!created.ok) throw new Error(created.error);

    const session = users.createUserSession(created.value.user.id);
    const started = await users.startTotp(created.value.user.id);
    if (!started.ok) throw new Error(started.error);
    await users.confirmTotp(created.value.user.id, (await totpCode(started.value.secret)) ?? "");

    const recovered = await users.recoverWithCode(
      "juana",
      created.value.recovery_codes[1] ?? "",
      "la clave nueva y larga",
    );
    expect(recovered.ok).toBe(true);
    if (!recovered.ok) return;

    expect(recovered.value.user.totp_enabled).toBe(false);
    /** Los códigos viejos dejan de servir: vienen ocho nuevos. */
    expect(recovered.value.recovery_codes).toHaveLength(8);
    expect(recovered.value.recovery_codes).not.toContain(created.value.recovery_codes[2]);

    expect(users.sessionUser(session.token)).toBeNull();
    expect(
      await users.verifyCredentials({ handle: "juana", password: "la clave nueva y larga" }),
    ).not.toBeNull();
  });

  test("un código inventado no recupera nada", async () => {
    await alta();
    const recovered = await users.recoverWithCode("juana", "abcde-fghij", "otra clave larga");
    expect(recovered.ok).toBe(false);
    expect(
      await users.verifyCredentials({ handle: "juana", password: "una clave larga" }),
    ).not.toBeNull();
  });
});

describe("segundo factor", () => {
  const prender = async (): Promise<{ id: string; secret: string }> => {
    const created = await alta();
    if (!created.ok) throw new Error(created.error);

    const started = await users.startTotp(created.value.user.id);
    if (!started.ok) throw new Error(started.error);

    return { id: created.value.user.id, secret: started.value.secret };
  };

  test("el secreto queda cifrado y apagado hasta que se confirma", async () => {
    const { id } = await prender();
    expect(users.byId(id)?.totp_enabled).toBe(false);

    const row = db()
      .query<{ totp_secret_enc: string }, []>("SELECT totp_secret_enc FROM users")
      .get();
    expect(row?.totp_secret_enc).toStartWith("v1.");
  });

  test("el código correcto lo prende", async () => {
    const { id, secret } = await prender();
    const confirmed = await users.confirmTotp(id, (await totpCode(secret)) ?? "");
    expect(confirmed.ok).toBe(true);
    expect(users.byId(id)?.totp_enabled).toBe(true);
    expect(await users.verifyTotp(id, (await totpCode(secret)) ?? "")).toBe(true);
  });

  test("uno inventado no", async () => {
    const { id } = await prender();
    const confirmed = await users.confirmTotp(id, "000000");
    expect(confirmed.ok).toBe(false);
    expect(users.byId(id)?.totp_enabled).toBe(false);
  });

  test("apagarlo borra el secreto", async () => {
    const { id, secret } = await prender();
    await users.confirmTotp(id, (await totpCode(secret)) ?? "");

    users.disableTotp(id);
    expect(users.byId(id)?.totp_enabled).toBe(false);
    expect(await users.verifyTotp(id, (await totpCode(secret)) ?? "")).toBe(false);
  });

  test("sin clave de cifrado no se puede prender", async () => {
    const created = await alta();
    if (!created.ok) throw new Error(created.error);

    delete process.env.USER_SECRET_KEY;
    expect((await users.startTotp(created.value.user.id)).ok).toBe(false);
  });
});

describe("editar y borrar", () => {
  test("cambiar la clave deja entrar con la nueva y no con la vieja", async () => {
    const created = await alta();
    if (!created.ok) throw new Error(created.error);

    await users.updateUser(created.value.user.id, { password: "otra clave bien larga" });
    expect(
      await users.verifyCredentials({ handle: "juana", password: "una clave larga" }),
    ).toBeNull();
    expect(
      await users.verifyCredentials({ handle: "juana", password: "otra clave bien larga" }),
    ).not.toBeNull();
  });

  test("se puede sacar el correo", async () => {
    const created = await alta({ email: "juana@ejemplo.com" });
    if (!created.ok) throw new Error(created.error);

    const updated = await users.updateUser(created.value.user.id, { email: null });
    expect(updated.ok && updated.value.has_email).toBe(false);
  });

  test("el borrado se lleva sesiones y códigos", async () => {
    const created = await alta();
    if (!created.ok) throw new Error(created.error);

    const session = users.createUserSession(created.value.user.id);
    expect(users.removeUser(created.value.user.id)).toBe(true);

    expect(users.byId(created.value.user.id)).toBeNull();
    expect(users.sessionUser(session.token)).toBeNull();
    expect(users.recoveryState(created.value.user.id).remaining).toBe(0);
    expect(
      db().query<{ n: number }, []>("SELECT COUNT(*) AS n FROM user_recovery_codes").get()?.n,
    ).toBe(0);
  });
});
