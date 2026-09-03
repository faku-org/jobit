import { beforeEach, describe, expect, test } from "bun:test";

process.env.DB_FILE = ":memory:";

const { closeDb } = await import("./db.ts");
const {
  adminEnabled,
  createSession,
  destroyAllSessions,
  destroySession,
  sessionValid,
  verifyPassword,
} = await import("./auth.ts");

const HASH = await Bun.password.hash("la clave buena");

beforeEach(() => {
  closeDb();
  process.env.ADMIN_PASSWORD_HASH = HASH;
});

describe("adminEnabled", () => {
  test("apagado sin la variable, que es como tiene que fallar", () => {
    delete process.env.ADMIN_PASSWORD_HASH;
    expect(adminEnabled()).toBe(false);
  });

  test("apagado también si la variable está vacía", () => {
    process.env.ADMIN_PASSWORD_HASH = "";
    expect(adminEnabled()).toBe(false);
  });

  test("encendido con un hash puesto", () => {
    expect(adminEnabled()).toBe(true);
  });
});

describe("verifyPassword", () => {
  test("acepta la clave correcta", async () => {
    expect(await verifyPassword("la clave buena")).toBe(true);
  });

  test("rechaza cualquier otra", async () => {
    expect(await verifyPassword("la clave mala")).toBe(false);
    expect(await verifyPassword("")).toBe(false);
  });

  test("sin hash configurado no entra nadie", async () => {
    delete process.env.ADMIN_PASSWORD_HASH;
    expect(await verifyPassword("la clave buena")).toBe(false);
  });

  test("un hash roto en el entorno no es una credencial", async () => {
    process.env.ADMIN_PASSWORD_HASH = "esto no es un hash";
    expect(await verifyPassword("la clave buena")).toBe(false);
    expect(await verifyPassword("esto no es un hash")).toBe(false);
  });
});

describe("sesiones", () => {
  test("la que se acaba de crear vale", () => {
    const session = createSession();
    expect(sessionValid(session.token)).toBe(true);
  });

  test("un token inventado no vale", () => {
    createSession();
    expect(sessionValid("token-inventado")).toBe(false);
  });

  test("sin token tampoco", () => {
    expect(sessionValid(undefined)).toBe(false);
    expect(sessionValid("")).toBe(false);
  });

  test("dos sesiones nunca comparten token", () => {
    expect(createSession().token).not.toBe(createSession().token);
  });

  test("vence sola pasadas las horas", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const session = createSession(start);

    const casiVencida = new Date(start.getTime() + 11 * 3_600_000);
    expect(sessionValid(session.token, casiVencida)).toBe(true);

    const vencida = new Date(start.getTime() + 13 * 3_600_000);
    expect(sessionValid(session.token, vencida)).toBe(false);
  });

  test("cerrar sesión la invalida en el acto", () => {
    const session = createSession();
    destroySession(session.token);
    expect(sessionValid(session.token)).toBe(false);
  });

  test("cerrar una no toca las otras", () => {
    const primera = createSession();
    const segunda = createSession();

    destroySession(primera.token);
    expect(sessionValid(segunda.token)).toBe(true);
  });

  test("se pueden cerrar todas de una", () => {
    const primera = createSession();
    const segunda = createSession();

    destroyAllSessions();
    expect(sessionValid(primera.token)).toBe(false);
    expect(sessionValid(segunda.token)).toBe(false);
  });

  test("el token en claro no queda guardado en la base", async () => {
    const { db } = await import("./db.ts");
    const session = createSession();

    const filas = db()
      .query<{ token_hash: string }, []>("SELECT token_hash FROM admin_sessions")
      .all();

    expect(filas).toHaveLength(1);
    expect(filas[0]?.token_hash).not.toBe(session.token);
    expect(filas[0]?.token_hash).toHaveLength(64);
  });
});
