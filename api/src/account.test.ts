import { beforeEach, describe, expect, test } from "bun:test";

process.env.DB_FILE = ":memory:";
process.env.ADMIN_INSECURE_COOKIES = "true";

const KEY = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
process.env.JOBIT_SECRET_KEY = KEY;

const { closeDb } = await import("./db.ts");
const { resetSecretKey } = await import("./crypto.ts");
const { resetLimits } = await import("./limit.ts");
const { totp } = await import("./totp.ts");
const { app } = await import("./index.ts");

const ADMIN_HASH = await Bun.password.hash("abrite sesamo");

beforeEach(() => {
  closeDb();
  resetLimits();
  resetSecretKey();
  process.env.JOBIT_SECRET_KEY = KEY;
  delete process.env.JOBIT_SECRET_KEY_FILE;
  process.env.ADMIN_PASSWORD_HASH = ADMIN_HASH;
  delete process.env.ADMIN_PASSWORD_HASH_FILE;
});

const call = (path: string, init: RequestInit = {}): Promise<Response> =>
  app.handle(new Request(`http://localhost${path}`, init));

const json = (body: unknown, method = "POST"): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const withCookie = (init: RequestInit, cookie: string): RequestInit => ({
  ...init,
  headers: { ...(init.headers as Record<string, string>), cookie },
});

function cookiesOf(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const many = headers.getSetCookie?.();
  if (many && many.length > 0) return many;
  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

const cookieNamed = (response: Response, name: string): string =>
  cookiesOf(response)
    .map((raw) => raw.split(";")[0] ?? "")
    .find((pair) => pair.startsWith(`${name}=`)) ?? "";

async function register(handle = "faku"): Promise<{
  response: Response;
  cookie: string;
  recoveryCodes: string[];
  body: Record<string, unknown>;
}> {
  const response = await call(
    "/api/auth/register",
    json({ handle, display_name: "Facu", password: "una-clave-larga" }),
  );
  const body = (await response.json()) as Record<string, unknown>;
  return {
    response,
    cookie: cookieNamed(response, "jobit_session"),
    recoveryCodes: (body.recovery_codes as string[] | undefined) ?? [],
    body,
  };
}

const login = (handle = "faku", password = "una-clave-larga") =>
  call("/api/auth/login", json({ handle, password }));

describe("alta", () => {
  test("deja la sesión puesta y devuelve los códigos de respaldo", async () => {
    const { response, cookie, recoveryCodes } = await register();
    expect(response.status).toBe(201);
    expect(recoveryCodes).toHaveLength(8);

    const setCookie = cookiesOf(response).join("\n").toLowerCase();
    expect(setCookie).toContain("jobit_session=");
    expect(setCookie).toContain("httponly");
    expect(setCookie).toContain("samesite=lax");
    expect(setCookie).toContain("path=/api");

    const me = await call("/api/me", { headers: { cookie } });
    expect(me.status).toBe(200);
    const body = (await me.json()) as { user: { handle: string; recovery_codes_left: number } };
    expect(body.user.handle).toBe("faku");
    expect(body.user.recovery_codes_left).toBe(8);
  });

  test("un handle ya tomado no entra", async () => {
    await register();
    const second = await register("FAKU");
    expect(second.response.status).toBe(422);
  });

  test("la respuesta nunca trae el hash ni el email", async () => {
    const { body } = await register();
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("password");
    expect(raw).not.toContain("hash");
    expect(raw).not.toContain("email_enc");
  });
});

describe("ingreso", () => {
  test("con la clave correcta abre sesión", async () => {
    await register();
    const response = await login();
    expect(response.status).toBe(200);
    expect(cookieNamed(response, "jobit_session")).not.toBe("");
  });

  test("con la clave mala no", async () => {
    await register();
    expect((await login("faku", "probando")).status).toBe(401);
  });

  test("un handle que no existe contesta lo mismo que la clave mala", async () => {
    const missing = await login("nadie", "lo-que-sea");
    expect(missing.status).toBe(401);
  });

  test("cerrar sesión la invalida", async () => {
    const { cookie } = await register();
    await call("/api/auth/logout", { method: "POST", headers: { cookie } });
    expect((await call("/api/me", { headers: { cookie } })).status).toBe(401);
  });

  test("probar claves se corta a los diez intentos", async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      await login("faku", "probando");
    }
    expect((await login("faku", "probando")).status).toBe(429);
  });
});

describe("segundo paso", () => {
  async function enableTotp(cookie: string): Promise<string> {
    const setup = await call("/api/me/totp", withCookie(json({}), cookie));
    const body = (await setup.json()) as { secret: string; otpauth: string };
    expect(body.otpauth.startsWith("otpauth://totp/")).toBe(true);

    const code = await totp(body.secret);
    if (!code) throw new Error("sin código");
    const confirm = await call("/api/me/totp", withCookie(json({ code }), cookie));
    expect(confirm.status).toBe(200);
    return body.secret;
  }

  test("sin confirmar no queda activado", async () => {
    const { cookie } = await register();
    const setup = await call("/api/me/totp", withCookie(json({}), cookie));
    expect(setup.status).toBe(200);

    const body = (await call("/api/me", { headers: { cookie } })).json() as Promise<{
      user: { totp_enabled: boolean };
    }>;
    expect((await body).user.totp_enabled).toBe(false);
  });

  test("activado, el login pide el código antes de dar sesión", async () => {
    const { cookie } = await register();
    const secret = await enableTotp(cookie);

    const step = await login();
    expect(step.status).toBe(200);
    const { status: stepStatus } = (await step.json()) as { status: string };
    expect(stepStatus).toBe("totp_required");
    expect(cookieNamed(step, "jobit_session")).toBe("");
    const challenge = cookieNamed(step, "jobit_2fa");
    expect(challenge).not.toBe("");

    /** Sin el segundo paso no hay sesión. */
    expect((await call("/api/me")).status).toBe(401);

    const code = await totp(secret);
    if (!code) throw new Error("sin código");
    const done = await call("/api/auth/totp", withCookie(json({ code }), challenge));
    expect(done.status).toBe(200);

    const session = cookieNamed(done, "jobit_session");
    expect(session).not.toBe("");
    expect((await call("/api/me", { headers: { cookie: session } })).status).toBe(200);
  });

  test("un código que no es el actual no abre", async () => {
    const { cookie } = await register();
    await enableTotp(cookie);
    const step = await login();
    const challenge = cookieNamed(step, "jobit_2fa");

    const wrong = await call("/api/auth/totp", withCookie(json({ code: "000000" }), challenge));
    expect(wrong.status).toBe(401);
  });

  test("desactivarlo pide la contraseña", async () => {
    const { cookie } = await register();
    await enableTotp(cookie);

    const refused = await call("/api/me/totp", withCookie(json({ password: "otra" }, "DELETE"), cookie));
    expect(refused.status).toBe(401);

    const done = await call(
      "/api/me/totp",
      withCookie(json({ password: "una-clave-larga" }, "DELETE"), cookie),
    );
    expect(done.status).toBe(200);
    expect((await login()).status).toBe(200);
  });
});

describe("recuperación", () => {
  test("un código de respaldo abre sesión y se consume", async () => {
    const { recoveryCodes } = await register();
    const code = recoveryCodes[0] ?? "";

    const response = await call("/api/auth/recover", json({ handle: "faku", code }));
    expect(response.status).toBe(200);
    expect(cookieNamed(response, "jobit_session")).not.toBe("");

    const twice = await call("/api/auth/recover", json({ handle: "faku", code }));
    expect(twice.status).toBe(401);
  });

  test("un código inventado no entra", async () => {
    await register();
    const response = await call("/api/auth/recover", json({ handle: "faku", code: "ZZZZZZZZZZ" }));
    expect(response.status).toBe(401);
  });
});

describe("la cuenta propia", () => {
  test("se cambia el nombre visible", async () => {
    const { cookie } = await register();
    const response = await call("/api/me", withCookie(json({ display_name: "Facu Faber" }, "PATCH"), cookie));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { user: { display_name: string } };
    expect(body.user.display_name).toBe("Facu Faber");
  });

  test("cambiar la contraseña pide la actual", async () => {
    const { cookie } = await register();

    const refused = await call(
      "/api/me",
      withCookie(json({ current_password: "otra", new_password: "una-clave-nueva" }, "PATCH"), cookie),
    );
    expect(refused.status).toBe(401);

    const changed = await call(
      "/api/me",
      withCookie(
        json({ current_password: "una-clave-larga", new_password: "una-clave-nueva" }, "PATCH"),
        cookie,
      ),
    );
    expect(changed.status).toBe(200);
    expect((await login("faku", "la-vieja")).status).toBe(401);
    expect((await login("faku", "una-clave-nueva")).status).toBe(200);
  });

  test("borrarse borra de verdad y cierra la sesión", async () => {
    const { cookie } = await register();

    const refused = await call("/api/me", withCookie(json({ password: "otra" }, "DELETE"), cookie));
    expect(refused.status).toBe(401);

    const done = await call(
      "/api/me",
      withCookie(json({ password: "una-clave-larga" }, "DELETE"), cookie),
    );
    expect(done.status).toBe(200);

    expect((await call("/api/me", { headers: { cookie } })).status).toBe(401);
    expect((await login()).status).toBe(401);
  });
});

describe("aislamiento del panel", () => {
  const adminLogin = async (): Promise<string> => {
    const response = await call("/api/admin/login", json({ password: "abrite sesamo" }));
    return cookieNamed(response, "jobit_admin");
  };

  test("una sesión de usuario no abre el panel", async () => {
    const { cookie } = await register();
    expect((await call("/api/admin/companies", { headers: { cookie } })).status).toBe(401);
  });

  test("una sesión del panel no abre la cuenta", async () => {
    const admin = await adminLogin();
    expect(admin).not.toBe("");
    expect((await call("/api/me", { headers: { cookie: admin } })).status).toBe(401);
  });

  test("sin cookie, la cuenta propia no contesta", async () => {
    expect((await call("/api/me")).status).toBe(401);
  });
});
