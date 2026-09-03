import { beforeEach, describe, expect, test } from "bun:test";

process.env.DB_FILE = ":memory:";
process.env.ADMIN_INSECURE_COOKIES = "true";

const { closeDb } = await import("./db.ts");
const { resetLimits } = await import("./limit.ts");
const { app } = await import("./index.ts");

const HASH = await Bun.password.hash("abrite sesamo");

beforeEach(() => {
  closeDb();
  resetLimits();
  process.env.ADMIN_PASSWORD_HASH = HASH;
});

const call = (path: string, init: RequestInit = {}): Promise<Response> =>
  app.handle(new Request(`http://localhost${path}`, init));

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** La cookie que devolvió el login, lista para mandarla de vuelta. */
async function login(password = "abrite sesamo"): Promise<string> {
  const response = await call("/api/admin/login", json({ password }));
  const raw = response.headers.get("set-cookie") ?? "";
  return raw.split(";")[0] ?? "";
}

describe("con el panel apagado", () => {
  beforeEach(() => {
    delete process.env.ADMIN_PASSWORD_HASH;
  });

  test("el login ni existe", async () => {
    expect((await call("/api/admin/login", json({ password: "lo que sea" }))).status).toBe(404);
  });

  test("tampoco el listado", async () => {
    expect((await call("/api/admin/companies")).status).toBe(404);
  });

  test("el resto de la API sigue andando", async () => {
    expect((await call("/health")).status).toBe(200);
  });
});

describe("login", () => {
  test("la clave correcta abre sesión y deja la cookie", async () => {
    const response = await call("/api/admin/login", json({ password: "abrite sesamo" }));
    expect(response.status).toBe(200);

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("jobit_admin=");
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=strict");
  });

  test("la clave incorrecta no abre nada", async () => {
    const response = await call("/api/admin/login", json({ password: "probando" }));
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  test("probar claves se corta a los diez intentos", async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      await call("/api/admin/login", json({ password: "probando" }));
    }

    const response = await call("/api/admin/login", json({ password: "probando" }));
    expect(response.status).toBe(429);
  });

  test("el techo de intentos también frena a quien sí sabe la clave", async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      await call("/api/admin/login", json({ password: "probando" }));
    }

    expect((await call("/api/admin/login", json({ password: "abrite sesamo" }))).status).toBe(429);
  });
});

describe("sin sesión", () => {
  test("no se listan empresas", async () => {
    expect((await call("/api/admin/companies")).status).toBe(401);
  });

  test("no se crean empresas", async () => {
    expect((await call("/api/admin/companies", json({ name: "Acme" }))).status).toBe(401);
  });

  test("una cookie inventada no sirve", async () => {
    const response = await call("/api/admin/companies", {
      headers: { cookie: "jobit_admin=me-lo-invente" },
    });
    expect(response.status).toBe(401);
  });
});

describe("con sesión", () => {
  test("lista vacía al principio", async () => {
    const cookie = await login();
    const response = await call("/api/admin/companies", { headers: { cookie } });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { companies: unknown[]; counts: unknown };
    expect(body.companies).toHaveLength(0);
    expect(body.counts).toEqual({ pending: 0, approved: 0, suspended: 0 });
  });

  test("crea, aparece en el listado y se aprueba", async () => {
    const cookie = await login();

    const created = await call("/api/admin/companies", {
      ...json({ name: "Acme", email: "rrhh@acme.com" }),
      headers: { "Content-Type": "application/json", cookie },
    });
    expect(created.status).toBe(201);
    const company = (await created.json()) as { id: string; status: string };
    expect(company.status).toBe("pending");

    const patched = await call(`/api/admin/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ status: "approved" }),
    });
    expect(patched.status).toBe(200);

    const listed = await call("/api/admin/companies?status=approved", { headers: { cookie } });
    const body = (await listed.json()) as { companies: { name: string }[] };
    expect(body.companies.map((entry) => entry.name)).toEqual(["Acme"]);
  });

  test("un cuerpo inválido no entra", async () => {
    const cookie = await login();

    const response = await call("/api/admin/companies", {
      ...json({ name: "Acme", website: "javascript:alert(1)" }),
      headers: { "Content-Type": "application/json", cookie },
    });
    expect(response.status).toBe(422);
  });

  test("borrar algo que no está da 404", async () => {
    const cookie = await login();
    const response = await call("/api/admin/companies/no-existe", {
      method: "DELETE",
      headers: { cookie },
    });
    expect(response.status).toBe(404);
  });

  test("cerrar sesión deja la cookie sin valor", async () => {
    const cookie = await login();
    expect((await call("/api/admin/companies", { headers: { cookie } })).status).toBe(200);

    await call("/api/admin/logout", { method: "POST", headers: { cookie } });
    expect((await call("/api/admin/companies", { headers: { cookie } })).status).toBe(401);
  });
});
