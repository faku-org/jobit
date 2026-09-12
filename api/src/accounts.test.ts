import { beforeEach, describe, expect, test } from "bun:test";

process.env.DB_FILE = ":memory:";
process.env.ADMIN_INSECURE_COOKIES = "true";

const { closeDb } = await import("./db.ts");
const { resetLimits } = await import("./limit.ts");
const { totpCode } = await import("./totp.ts");
const users = await import("./users.ts");
const { app } = await import("./index.ts");

beforeEach(() => {
  closeDb();
  resetLimits();
  process.env.USER_SECRET_KEY = "una clave de prueba, larga y sin gracia";
});

const call = (path: string, init: RequestInit = {}): Promise<Response> =>
  app.handle(new Request(`http://localhost${path}`, init));

const send = (method: string, body?: unknown, cookie?: string): RequestInit => ({
  method,
  headers: {
    "Content-Type": "application/json",
    ...(cookie ? { cookie } : {}),
  },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

/** La cookie que devolvió la respuesta, lista para mandarla de vuelta. */
const cookieOf = (response: Response): string =>
  (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

const ALTA = { handle: "juana", display_name: "Juana Pérez", password: "una clave larga" };

async function registrar(
  extra: Record<string, unknown> = {},
): Promise<{ cookie: string; codes: string[] }> {
  const response = await call("/api/auth/register", send("POST", { ...ALTA, ...extra }));
  const body = (await response.json()) as { recovery_codes?: string[] };
  return { cookie: cookieOf(response), codes: body.recovery_codes ?? [] };
}

describe("alta", () => {
  test("crea la cuenta, abre sesión y entrega los códigos", async () => {
    const response = await call("/api/auth/register", send("POST", ALTA));
    expect(response.status).toBe(201);

    const body = (await response.json()) as {
      user: { handle: string };
      recovery_codes: string[];
    };
    expect(body.user.handle).toBe("juana");
    expect(body.recovery_codes).toHaveLength(8);

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("jobit_session=");
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
  });

  test("lo que no pasa el saneo vuelve con el motivo", async () => {
    const response = await call("/api/auth/register", send("POST", { ...ALTA, handle: "ad min" }));
    expect(response.status).toBe(422);
    expect(((await response.json()) as { error: string }).error).toContain("minúsculas");
  });

  test("el handle repetido no abre una segunda cuenta", async () => {
    await registrar();
    expect((await call("/api/auth/register", send("POST", ALTA))).status).toBe(422);
  });
});

describe("login", () => {
  test("la clave correcta abre sesión", async () => {
    await registrar();

    const response = await call(
      "/api/auth/login",
      send("POST", { handle: "juana", password: "una clave larga" }),
    );
    expect(response.status).toBe(200);
    expect(((await response.json()) as { status: string }).status).toBe("ok");
    expect(cookieOf(response)).toContain("jobit_session=");
  });

  test("el mismo error para la cuenta que no existe y la clave que no coincide", async () => {
    await registrar();

    const mala = await call(
      "/api/auth/login",
      send("POST", { handle: "juana", password: "otra cosa" }),
    );
    const inexistente = await call(
      "/api/auth/login",
      send("POST", { handle: "nadie", password: "una clave larga" }),
    );

    expect(mala.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(await mala.json()).toEqual(await inexistente.json());
  });

  test("probar claves se corta a los diez intentos", async () => {
    await registrar();
    resetLimits();

    for (let attempt = 0; attempt < 10; attempt++) {
      await call("/api/auth/login", send("POST", { handle: "juana", password: "probando" }));
    }

    const response = await call(
      "/api/auth/login",
      send("POST", { handle: "juana", password: "una clave larga" }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
  });
});

describe("segundo paso", () => {
  /** Deja la cuenta con 2FA prendido y devuelve el secreto para generar códigos. */
  async function conTotp(): Promise<string> {
    const { cookie } = await registrar();

    const started = await call("/api/me/totp", send("POST", {}, cookie));
    const { secret } = (await started.json()) as { secret: string };

    await call("/api/me/totp", send("POST", { code: (await totpCode(secret)) ?? "" }, cookie));
    return secret;
  }

  test("con 2FA el login no alcanza para entrar", async () => {
    await conTotp();

    const login = await call(
      "/api/auth/login",
      send("POST", { handle: "juana", password: "una clave larga" }),
    );
    expect(((await login.json()) as { status: string }).status).toBe("totp");

    /** La cookie a medio abrir no sirve para nada más. */
    expect((await call("/api/me", send("GET", undefined, cookieOf(login)))).status).toBe(401);
  });

  test("el código correcto completa el ingreso", async () => {
    const secret = await conTotp();

    const login = await call(
      "/api/auth/login",
      send("POST", { handle: "juana", password: "una clave larga" }),
    );
    const pending = cookieOf(login);

    const step = await call(
      "/api/auth/totp",
      send("POST", { code: (await totpCode(secret)) ?? "" }, pending),
    );
    expect(step.status).toBe(200);

    expect((await call("/api/me", send("GET", undefined, cookieOf(step)))).status).toBe(200);
  });

  test("un código inventado no", async () => {
    await conTotp();

    const login = await call(
      "/api/auth/login",
      send("POST", { handle: "juana", password: "una clave larga" }),
    );
    const step = await call("/api/auth/totp", send("POST", { code: "000000" }, cookieOf(login)));
    expect(step.status).toBe(401);
  });

  test("sin sesión a medio abrir no hay segundo paso", async () => {
    expect((await call("/api/auth/totp", send("POST", { code: "000000" }))).status).toBe(401);
  });
});

describe("/api/me", () => {
  test("sin sesión no contesta nada", async () => {
    expect((await call("/api/me")).status).toBe(401);
    expect((await call("/api/me", send("PATCH", { display_name: "Otra" }))).status).toBe(401);
  });

  test("con sesión dice quién es y cuántos códigos quedan", async () => {
    const { cookie } = await registrar();

    const response = await call("/api/me", send("GET", undefined, cookie));
    const body = (await response.json()) as {
      user: { handle: string };
      recovery: { remaining: number };
    };
    expect(body.user.handle).toBe("juana");
    expect(body.recovery.remaining).toBe(8);
  });

  test("el nombre visible se cambia sin pedir la clave", async () => {
    const { cookie } = await registrar();

    const response = await call("/api/me", send("PATCH", { display_name: "Juana P." }, cookie));
    expect(response.status).toBe(200);
    expect(((await response.json()) as { user: { display_name: string } }).user.display_name).toBe(
      "Juana P.",
    );
  });

  test("el correo y la clave sí la piden", async () => {
    const { cookie } = await registrar();

    const sinClave = await call("/api/me", send("PATCH", { email: "juana@ejemplo.com" }, cookie));
    expect(sinClave.status).toBe(403);

    const conClave = await call(
      "/api/me",
      send("PATCH", { email: "juana@ejemplo.com", current_password: "una clave larga" }, cookie),
    );
    expect(conClave.status).toBe(200);
    expect(((await conClave.json()) as { user: { has_email: boolean } }).user.has_email).toBe(true);
  });

  test("cambiar la clave cierra las sesiones abiertas", async () => {
    const { cookie } = await registrar();

    await call(
      "/api/me",
      send(
        "PATCH",
        { password: "otra clave bien larga", current_password: "una clave larga" },
        cookie,
      ),
    );

    expect((await call("/api/me", send("GET", undefined, cookie))).status).toBe(401);
  });

  test("el borrado pide la clave y después no queda nada", async () => {
    const { cookie } = await registrar();

    expect((await call("/api/me", send("DELETE", { password: "probando" }, cookie))).status).toBe(
      403,
    );

    const borrado = await call("/api/me", send("DELETE", { password: "una clave larga" }, cookie));
    expect(borrado.status).toBe(200);

    expect((await call("/api/me", send("GET", undefined, cookie))).status).toBe(401);
    expect(users.byHandle("juana")).toBeNull();
  });
});

describe("recuperación", () => {
  test("un código de respaldo cambia la clave", async () => {
    const { codes } = await registrar();

    const response = await call(
      "/api/auth/recover",
      send("POST", { handle: "juana", code: codes[0], password: "la clave nueva larga" }),
    );
    expect(response.status).toBe(200);
    expect(((await response.json()) as { recovery_codes: string[] }).recovery_codes).toHaveLength(
      8,
    );

    const login = await call(
      "/api/auth/login",
      send("POST", { handle: "juana", password: "la clave nueva larga" }),
    );
    expect(login.status).toBe(200);
  });

  test("el mismo código no sirve dos veces", async () => {
    const { codes } = await registrar();

    await call(
      "/api/auth/recover",
      send("POST", { handle: "juana", code: codes[0], password: "la clave nueva larga" }),
    );
    const repetida = await call(
      "/api/auth/recover",
      send("POST", { handle: "juana", code: codes[0], password: "y otra clave larga" }),
    );
    expect(repetida.status).toBe(422);
  });
});

describe("cerrar sesión", () => {
  test("cierra la de acá y deja las otras", async () => {
    const { cookie } = await registrar();
    const otra = cookieOf(
      await call("/api/auth/login", send("POST", { handle: "juana", password: "una clave larga" })),
    );

    await call("/api/auth/logout", send("POST", undefined, cookie));
    expect((await call("/api/me", send("GET", undefined, cookie))).status).toBe(401);
    expect((await call("/api/me", send("GET", undefined, otra))).status).toBe(200);
  });

  test("con all cierra todo", async () => {
    const { cookie } = await registrar();
    const otra = cookieOf(
      await call("/api/auth/login", send("POST", { handle: "juana", password: "una clave larga" })),
    );

    await call("/api/auth/logout", send("POST", { all: true }, cookie));
    expect((await call("/api/me", send("GET", undefined, otra))).status).toBe(401);
  });
});

describe("las dos sesiones no se cruzan", () => {
  test("la cookie de usuario no abre el panel", async () => {
    process.env.ADMIN_PASSWORD_HASH = await Bun.password.hash("abrite sesamo");
    const { cookie } = await registrar();

    expect((await call("/api/admin/companies", send("GET", undefined, cookie))).status).toBe(401);
  });
});
