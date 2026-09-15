import { beforeEach, describe, expect, test } from "bun:test";
/** Solo el tipo: un import de tipos se borra al compilar y no adelanta la
 * carga del módulo, que tiene que pasar después de fijar DB_FILE. */
import type { RegisterInput } from "./users.ts";

process.env.DB_FILE = ":memory:";
process.env.ACCOUNT_KEY = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
  "base64",
);

const { closeDb, db } = await import("./db.ts");
const { resetSecretsCache } = await import("./secrets.ts");
const { totpCode } = await import("./totp.ts");
const users = await import("./users.ts");

beforeEach(() => {
  closeDb();
  resetSecretsCache();
});

const alta = (overrides: Partial<RegisterInput> = {}) =>
  users.register({
    handle: "faku",
    display_name: "Facundo",
    password: "una clave larga",
    ...overrides,
  });

describe("alta", () => {
  test("crea la cuenta y devuelve los códigos de respaldo", async () => {
    const created = await alta();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.value.user.handle).toBe("faku");
    expect(created.value.user.has_email).toBe(false);
    expect(created.value.recovery_codes).toHaveLength(8);
    expect(new Set(created.value.recovery_codes).size).toBe(8);
  });

  test("el handle se guarda en minúsculas", async () => {
    const created = await alta({ handle: "FaKu" });
    expect(created.ok && created.value.user.handle).toBe("faku");
  });

  test("no se puede repetir un handle", async () => {
    await alta();
    const repetido = await alta({ display_name: "Otro" });
    expect(repetido.ok).toBe(false);
  });

  test("rechaza handles que no entran en una URL", async () => {
    for (const handle of ["ab", "con espacio", "a".repeat(25), "acento#"]) {
      expect((await alta({ handle })).ok).toBe(false);
    }
  });

  test("rechaza contraseñas cortas", async () => {
    expect((await alta({ password: "corta" })).ok).toBe(false);
  });

  test("el email es opcional y queda cifrado en la base", async () => {
    const created = await alta({ email: "Faku@Example.com" });
    expect(created.ok && created.value.user.has_email).toBe(true);

    const row = db()
      .query<{ email_enc: string }, []>("SELECT email_enc FROM users")
      .get();
    expect(row?.email_enc).not.toContain("faku");
    expect(row?.email_enc).not.toContain("example.com");

    const user = users.byHandle("faku");
    expect(user && (await users.emailOf(user))).toBe("faku@example.com");
  });

  test("un email inventado no entra", async () => {
    expect((await alta({ email: "esto no es un correo" })).ok).toBe(false);
  });

  test("la contraseña nunca queda en claro", async () => {
    await alta();
    const row = db().query<{ password_hash: string }, []>("SELECT password_hash FROM users").get();
    expect(row?.password_hash).not.toContain("una clave larga");
    expect(row?.password_hash.startsWith("$argon2")).toBe(true);
  });
});

describe("entrada", () => {
  beforeEach(async () => {
    await alta();
  });

  test("la clave correcta entra", async () => {
    expect(await users.verifyLogin("faku", "una clave larga")).not.toBeNull();
  });

  test("cualquier otra no", async () => {
    expect(await users.verifyLogin("faku", "otra clave")).toBeNull();
    expect(await users.verifyLogin("nadie", "una clave larga")).toBeNull();
  });

  test("una cuenta suspendida no entra", async () => {
    db().run("UPDATE users SET status = 'suspended' WHERE handle = 'faku'");
    expect(await users.verifyLogin("faku", "una clave larga")).toBeNull();
  });
});

describe("sesiones", () => {
  let id = "";

  beforeEach(async () => {
    const created = await alta();
    id = created.ok ? created.value.user.id : "";
  });

  test("la recién creada vale y trae a la persona", () => {
    const session = users.startSession(id);
    expect(users.sessionUser(session.token)?.handle).toBe("faku");
  });

  test("el token en claro no queda guardado", () => {
    const session = users.startSession(id);
    const row = db().query<{ token_hash: string }, []>("SELECT token_hash FROM user_sessions").get();
    expect(row?.token_hash).not.toBe(session.token);
    expect(row?.token_hash).toHaveLength(64);
  });

  test("un token inventado no vale", () => {
    users.startSession(id);
    expect(users.sessionUser("inventado")).toBeNull();
    expect(users.sessionUser(undefined)).toBeNull();
  });

  test("dura treinta días y se renueva sola al usarla", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const session = users.startSession(id, "open", start);

    const dia29 = new Date(start.getTime() + 29 * 86_400_000);
    expect(users.sessionUser(session.token, dia29)?.handle).toBe("faku");

    /** La visita del día 29 la corrió treinta días más. */
    const dia45 = new Date(start.getTime() + 45 * 86_400_000);
    expect(users.sessionUser(session.token, dia45)?.handle).toBe("faku");
  });

  test("sin usarla, a los treinta y uno ya no vale", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const session = users.startSession(id, "open", start);
    const dia31 = new Date(start.getTime() + 31 * 86_400_000);
    expect(users.sessionUser(session.token, dia31)).toBeNull();
  });

  test("la del segundo paso no es una sesión todavía", () => {
    const session = users.startSession(id, "totp");
    expect(users.sessionUser(session.token)).toBeNull();
    expect(users.pendingTotpUser(session.token)?.handle).toBe("faku");
  });

  test("el primer paso caduca a los cinco minutos", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const session = users.startSession(id, "totp", start);
    const seisMinutos = new Date(start.getTime() + 6 * 60_000);
    expect(users.pendingTotpUser(session.token, seisMinutos)).toBeNull();
  });

  test("pasado el segundo paso vale treinta días", () => {
    const session = users.startSession(id, "totp");
    users.openSession(session.token);
    expect(users.sessionUser(session.token)?.handle).toBe("faku");
  });

  test("cerrar una no toca las otras, y cerrarlas todas sí", () => {
    const primera = users.startSession(id);
    const segunda = users.startSession(id);

    users.destroySession(primera.token);
    expect(users.sessionUser(primera.token)).toBeNull();
    expect(users.sessionUser(segunda.token)).not.toBeNull();

    users.destroyUserSessions(id);
    expect(users.sessionUser(segunda.token)).toBeNull();
  });

  test("suspender la cuenta corta las sesiones abiertas", () => {
    const session = users.startSession(id);
    db().run("UPDATE users SET status = 'suspended' WHERE id = ?", [id]);
    expect(users.sessionUser(session.token)).toBeNull();
  });
});

describe("perfil", () => {
  let id = "";

  beforeEach(async () => {
    const created = await alta();
    id = created.ok ? created.value.user.id : "";
  });

  test("se puede cambiar el nombre visible", async () => {
    const updated = await users.updateProfile(id, { display_name: "Faku" });
    expect(updated.ok && updated.value.display_name).toBe("Faku");
  });

  test("se puede agregar y sacar el correo", async () => {
    const puesto = await users.updateProfile(id, { email: "faku@example.com" });
    expect(puesto.ok && puesto.value.has_email).toBe(true);

    const sacado = await users.updateProfile(id, { email: "" });
    expect(sacado.ok && sacado.value.has_email).toBe(false);
  });

  test("cambiar la contraseña cierra todo lo abierto", async () => {
    const session = users.startSession(id);
    const done = await users.changePassword(id, "una clave larga", "otra clave larga");

    expect(done.ok).toBe(true);
    expect(users.sessionUser(session.token)).toBeNull();
    expect(await users.verifyLogin("faku", "otra clave larga")).not.toBeNull();
  });

  test("sin la contraseña actual no se cambia", async () => {
    const done = await users.changePassword(id, "la que no es", "otra clave larga");
    expect(done.ok).toBe(false);
    expect(await users.verifyLogin("faku", "una clave larga")).not.toBeNull();
  });
});

describe("segundo factor", () => {
  let id = "";

  beforeEach(async () => {
    const created = await alta();
    id = created.ok ? created.value.user.id : "";
  });

  test("se guarda el secreto pero no se prende hasta que haya un código", async () => {
    const setup = await users.startTotp(id);
    expect(setup.ok).toBe(true);
    expect(users.byId(id)?.totp_enabled).toBe(0);

    if (!setup.ok) return;
    const code = await totpCode(setup.value.secret);
    expect((await users.confirmTotp(id, code ?? "")).ok).toBe(true);
    expect(users.byId(id)?.totp_enabled).toBe(1);
  });

  test("el secreto queda cifrado en la base", async () => {
    const setup = await users.startTotp(id);
    const row = db().query<{ totp_secret_enc: string }, []>("SELECT totp_secret_enc FROM users").get();
    expect(setup.ok && row?.totp_secret_enc).not.toContain(setup.ok ? setup.value.secret : "");
  });

  test("un código que no coincide no lo prende", async () => {
    await users.startTotp(id);
    expect((await users.confirmTotp(id, "000000")).ok).toBe(false);
    expect(users.byId(id)?.totp_enabled).toBe(0);
  });

  test("apagarlo pide la contraseña", async () => {
    const setup = await users.startTotp(id);
    if (!setup.ok) return;
    await users.confirmTotp(id, (await totpCode(setup.value.secret)) ?? "");

    expect((await users.disableTotp(id, "la que no es")).ok).toBe(false);
    expect(users.byId(id)?.totp_enabled).toBe(1);

    expect((await users.disableTotp(id, "una clave larga")).ok).toBe(true);
    expect(users.byId(id)?.totp_enabled).toBe(0);
    expect(users.byId(id)?.totp_secret_enc).toBe("");
  });
});

describe("recuperación", () => {
  test("un código de respaldo cambia la clave y se quema", async () => {
    const created = await alta();
    if (!created.ok) return;

    const code = created.value.recovery_codes[0] ?? "";
    const session = users.startSession(created.value.user.id);

    const done = await users.recoverWithCode("faku", code, "la clave nueva");
    expect(done.ok).toBe(true);
    expect(await users.verifyLogin("faku", "la clave nueva")).not.toBeNull();
    /** Recuperar cierra lo que estuviera abierto: si se recupera es porque se
     * perdió el control de algo. */
    expect(users.sessionUser(session.token)).toBeNull();

    expect((await users.recoverWithCode("faku", code, "otra vez larga")).ok).toBe(false);
    expect(users.recoveryCodesLeft(created.value.user.id)).toBe(7);
  });

  test("un código inventado no sirve, y tampoco un handle que no existe", async () => {
    await alta();
    expect((await users.recoverWithCode("faku", "NOEXISTE-01", "la clave nueva")).ok).toBe(false);
    expect((await users.recoverWithCode("nadie", "NOEXISTE-01", "la clave nueva")).ok).toBe(false);
  });

  test("regenerarlos quema los viejos", async () => {
    const created = await alta();
    if (!created.ok) return;

    const viejo = created.value.recovery_codes[0] ?? "";
    const nuevos = users.regenerateRecoveryCodes(created.value.user.id);

    expect(nuevos).toHaveLength(8);
    expect(nuevos).not.toContain(viejo);
    expect((await users.recoverWithCode("faku", viejo, "la clave nueva")).ok).toBe(false);
  });

  test("los códigos no quedan en claro en la base", async () => {
    const created = await alta();
    if (!created.ok) return;

    const guardados = db()
      .query<{ code_hash: string }, []>("SELECT code_hash FROM user_recovery_codes")
      .all()
      .map((row) => row.code_hash);

    for (const code of created.value.recovery_codes) expect(guardados).not.toContain(code);
    expect(guardados[0]).toHaveLength(64);
  });
});

describe("borrado", () => {
  test("se lleva la cuenta, las sesiones y los códigos", async () => {
    const created = await alta();
    if (!created.ok) return;
    const id = created.value.user.id;
    users.startSession(id);

    expect((await users.removeAccount(id, "la que no es")).ok).toBe(false);
    expect((await users.removeAccount(id, "una clave larga")).ok).toBe(true);

    expect(users.byId(id)).toBeNull();
    expect(db().query<{ n: number }, []>("SELECT COUNT(*) AS n FROM user_sessions").get()?.n).toBe(0);
    expect(
      db().query<{ n: number }, []>("SELECT COUNT(*) AS n FROM user_recovery_codes").get()?.n,
    ).toBe(0);
  });
});
