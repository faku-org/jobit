import { beforeEach, describe, expect, test } from "bun:test";

process.env.DB_FILE = ":memory:";
process.env.ADMIN_INSECURE_COOKIES = "true";

const { closeDb } = await import("./db.ts");
const { resetLimits } = await import("./limit.ts");
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
  headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const cookieOf = (response: Response): string =>
  (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

async function sesion(handle = "juana"): Promise<string> {
  const response = await call(
    "/api/auth/register",
    send("POST", { handle, display_name: "Juana Pérez", password: "una clave larga" }),
  );
  return cookieOf(response);
}

const SERVICIO = {
  title: "Instalaciones eléctricas",
  summary: "Tableros, tomas y luces",
  category: "oficios",
  department: "Canelones",
  prices: [{ kind: "base", label: "Hora", amount: 1200, currency: "UYU", unit: "hora" }],
  skills: ["Tableros"],
};

const crear = async (cookie: string, extra: Record<string, unknown> = {}) =>
  call("/api/services", send("POST", { ...SERVICIO, ...extra }, cookie));

describe("sin sesión", () => {
  test("no se publica ni se lista nada", async () => {
    expect((await call("/api/services/mine")).status).toBe(401);
    expect((await call("/api/services", send("POST", SERVICIO))).status).toBe(401);
    expect((await call("/api/services/loquesea", send("DELETE"))).status).toBe(401);
  });
});

describe("con sesión", () => {
  test("publica y lo devuelve en borrador", async () => {
    const cookie = await sesion();

    const response = await crear(cookie);
    expect(response.status).toBe(201);

    const body = (await response.json()) as { status: string; slug: string; prices: unknown[] };
    expect(body.status).toBe("draft");
    expect(body.slug).toBe("instalaciones-electricas");
    expect(body.prices).toHaveLength(1);
  });

  test("lo mío es lo mío, con el tope a la vista", async () => {
    const cookie = await sesion();
    await crear(cookie);

    const response = await call("/api/services/mine", send("GET", undefined, cookie));
    const body = (await response.json()) as { services: unknown[]; max: number };
    expect(body.services).toHaveLength(1);
    expect(body.max).toBeGreaterThan(0);
  });

  test("lo que no pasa el saneo vuelve con el motivo", async () => {
    const cookie = await sesion();

    const response = await crear(cookie, { department: "Tierra del Fuego" });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { error: string }).error).toContain("departamento");
  });

  test("editar lo propio anda", async () => {
    const cookie = await sesion();
    const created = (await (await crear(cookie)).json()) as { id: string };

    const response = await call(
      `/api/services/${created.id}`,
      send("PATCH", { summary: "Otro resumen", status: "pending" }, cookie),
    );
    expect(response.status).toBe(200);

    const body = (await response.json()) as { summary: string; status: string };
    expect(body.summary).toBe("Otro resumen");
    expect(body.status).toBe("pending");
  });

  test("lo de otra persona contesta lo mismo que lo que no existe", async () => {
    const mio = await sesion();
    const created = (await (await crear(mio)).json()) as { id: string };

    const ajeno = await sesion("pedro");
    const editar = await call(
      `/api/services/${created.id}`,
      send("PATCH", { title: "Mío ahora" }, ajeno),
    );
    const inventado = await call("/api/services/no-existe", send("PATCH", { title: "X" }, ajeno));

    expect(editar.status).toBe(404);
    expect(inventado.status).toBe(404);
    expect(await editar.json()).toEqual(await inventado.json());
  });

  test("borrar lo propio anda, lo ajeno no", async () => {
    const mio = await sesion();
    const created = (await (await crear(mio)).json()) as { id: string };

    const ajeno = await sesion("pedro");
    expect(
      (await call(`/api/services/${created.id}`, send("DELETE", undefined, ajeno))).status,
    ).toBe(404);
    expect((await call(`/api/services/${created.id}`, send("DELETE", undefined, mio))).status).toBe(
      200,
    );
  });
});
