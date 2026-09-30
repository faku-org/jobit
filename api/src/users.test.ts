import { beforeEach, describe, expect, test } from "bun:test";

process.env.DB_FILE = ":memory:";

const KEY = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");

const { closeDb, db } = await import("./db.ts");
const { resetSecretKey } = await import("./crypto.ts");
const users = await import("./users.ts");

beforeEach(() => {
  closeDb();
  resetSecretKey();
  process.env.JOBIT_SECRET_KEY = KEY;
  delete process.env.JOBIT_SECRET_KEY_FILE;
});

const register = (overrides: Partial<Parameters<typeof users.create>[0]> = {}) =>
  users.create({
    handle: "faku",
    display_name: "Facu",
    password: "una-clave-larga",
    ...overrides,
  });

describe("normaliseHandle", () => {
  test("baja a minúsculas y recorta", () => {
    const result = users.normaliseHandle("  Faku  ");
    expect(result.ok && result.value).toBe("faku");
  });

  test("rechaza lo corto, lo raro y lo reservado", () => {
    expect(users.normaliseHandle("ab").ok).toBe(false);
    expect(users.normaliseHandle("con espacios").ok).toBe(false);
    expect(users.normaliseHandle("admin").ok).toBe(false);
  });
});

describe("create", () => {
  test("nace activo y con ocho códigos de respaldo", async () => {
    const result = await register();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.user.status).toBe("active");
    expect(result.value.recoveryCodes).toHaveLength(8);
    expect(users.recoveryCodesLeft(result.value.user.id)).toBe(8);
  });

  test("la contraseña se guarda hasheada, no en claro", async () => {
    const result = await register();
    if (!result.ok) return;
    expect(result.value.user.password_hash).not.toBe("una-clave-larga");
    expect(await users.verifyPassword(result.value.user, "una-clave-larga")).toBe(true);
    expect(await users.verifyPassword(result.value.user, "otra")).toBe(false);
  });

  test("dos veces el mismo handle no entra", async () => {
    await register();
    const second = await register({ handle: "FAKU" });
    expect(second.ok).toBe(false);
  });

  test("exige una contraseña de largo mínimo", async () => {
    expect((await register({ password: "corta" })).ok).toBe(false);
  });

  test("sin clave de cifrado, el email no se acepta", async () => {
    resetSecretKey();
    delete process.env.JOBIT_SECRET_KEY;
    const result = await register({ email: "faku@ejemplo.com" });
    expect(result.ok).toBe(false);
  });

  test("con clave, el email queda cifrado y no como se escribió", async () => {
    const result = await register({ email: "Faku@Ejemplo.com" });
    if (!result.ok) return;
    expect(result.value.user.email_enc).not.toBeNull();
    expect(result.value.user.email_enc).not.toContain("ejemplo.com");
    expect(await users.emailOf(result.value.user)).toBe("faku@ejemplo.com");
  });
});

describe("códigos de respaldo", () => {
  test("uno sirve una sola vez", async () => {
    const result = await register();
    if (!result.ok) return;
    const { user, recoveryCodes } = result.value;
    const code = recoveryCodes[0] ?? "";

    expect(users.consumeRecoveryCode(user.id, code)).toBe(true);
    expect(users.consumeRecoveryCode(user.id, code)).toBe(false);
    expect(users.recoveryCodesLeft(user.id)).toBe(7);
  });

  test("se toleran minúsculas y guiones de más", async () => {
    const result = await register();
    if (!result.ok) return;
    const code = result.value.recoveryCodes[0] ?? "";
    expect(users.consumeRecoveryCode(result.value.user.id, code.toLowerCase())).toBe(true);
  });

  test("uno inventado no entra", async () => {
    const result = await register();
    if (!result.ok) return;
    expect(users.consumeRecoveryCode(result.value.user.id, "ZZZZZZZZZZ")).toBe(false);
  });

  test("volver a generarlos invalida los viejos", async () => {
    const result = await register();
    if (!result.ok) return;
    const old = result.value.recoveryCodes[0] ?? "";

    users.generateRecoveryCodes(result.value.user.id);
    expect(users.consumeRecoveryCode(result.value.user.id, old)).toBe(false);
    expect(users.recoveryCodesLeft(result.value.user.id)).toBe(8);
  });
});

describe("sesiones", () => {
  test("la recién creada vale y devuelve al usuario", async () => {
    const result = await register();
    if (!result.ok) return;

    const session = users.createSession(result.value.user.id);
    expect(users.sessionUser(session.token)?.id).toBe(result.value.user.id);
  });

  test("el token no queda en claro en la base", async () => {
    const result = await register();
    if (!result.ok) return;

    const session = users.createSession(result.value.user.id);
    const rows = db().query<{ token_hash: string }, []>("SELECT token_hash FROM user_sessions").all();
    expect(rows[0]?.token_hash).not.toBe(session.token);
    expect(rows[0]?.token_hash).toHaveLength(64);
  });

  test("vence a los treinta días", async () => {
    const result = await register();
    if (!result.ok) return;

    const start = new Date("2026-01-01T00:00:00.000Z");
    const session = users.createSession(result.value.user.id, start);

    const vencida = new Date(start.getTime() + 31 * 86_400_000);
    expect(users.sessionUser(session.token, vencida)).toBeNull();
  });

  test("a los veintinueve días todavía vale", async () => {
    const result = await register();
    if (!result.ok) return;

    const start = new Date("2026-01-01T00:00:00.000Z");
    const session = users.createSession(result.value.user.id, start);

    const casi = new Date(start.getTime() + 29 * 86_400_000);
    expect(users.sessionUser(session.token, casi)).not.toBeNull();
  });

  test("se renueva sola con el uso", async () => {
    const result = await register();
    if (!result.ok) return;

    const start = new Date("2026-01-01T00:00:00.000Z");
    const session = users.createSession(result.value.user.id, start);

    const unDiaDespues = new Date(start.getTime() + 86_400_000 + 1000);
    users.sessionUser(session.token, unDiaDespues);

    const row = db()
      .query<{ expires_at: string }, [string]>("SELECT expires_at FROM user_sessions WHERE token_hash = ?")
      .get(new Bun.CryptoHasher("sha256").update(session.token).digest("hex"));
    expect(row?.expires_at).toBe(new Date(unDiaDespues.getTime() + 30 * 86_400_000).toISOString());
  });

  test("cerrarla la invalida en el acto", async () => {
    const result = await register();
    if (!result.ok) return;

    const session = users.createSession(result.value.user.id);
    users.destroySession(session.token);
    expect(users.sessionUser(session.token)).toBeNull();
  });

  test("una cuenta suspendida no entra aunque la sesión exista", async () => {
    const result = await register();
    if (!result.ok) return;

    const session = users.createSession(result.value.user.id);
    db().run("UPDATE users SET status = 'suspended' WHERE id = ?", [result.value.user.id]);
    expect(users.sessionUser(session.token)).toBeNull();
  });
});

describe("segundo paso", () => {
  test("el secreto se guarda cifrado y vuelve entero", async () => {
    const result = await register();
    if (!result.ok) return;

    await users.setTotpSecret(result.value.user.id, "GEZDGNBVGY3TQOJQ");
    const stored = users.byId(result.value.user.id);
    if (!stored) return;

    expect(stored.totp_secret_enc).not.toContain("GEZDGNBVGY3TQOJQ");
    expect(stored.totp_enabled).toBe(false);
    expect(await users.totpSecret(stored)).toBe("GEZDGNBVGY3TQOJQ");
  });

  test("activar y desactivar", async () => {
    const result = await register();
    if (!result.ok) return;

    await users.setTotpSecret(result.value.user.id, "GEZDGNBVGY3TQOJQ");
    users.enableTotp(result.value.user.id);
    expect(users.byId(result.value.user.id)?.totp_enabled).toBe(true);

    users.disableTotp(result.value.user.id);
    const off = users.byId(result.value.user.id);
    expect(off?.totp_enabled).toBe(false);
    expect(off?.totp_secret_enc).toBeNull();
  });
});

describe("borrado", () => {
  test("se lleva sesiones y códigos consigo", async () => {
    const result = await register();
    if (!result.ok) return;

    users.createSession(result.value.user.id);
    expect(users.remove(result.value.user.id)).toBe(true);
    expect(users.byId(result.value.user.id)).toBeNull();

    expect(db().query("SELECT * FROM user_sessions").all()).toHaveLength(0);
    expect(db().query("SELECT * FROM user_recovery_codes").all()).toHaveLength(0);
  });
});
