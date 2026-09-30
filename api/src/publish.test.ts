import { beforeEach, describe, expect, test } from "bun:test";

process.env.DB_FILE = ":memory:";
process.env.ADMIN_INSECURE_COOKIES = "true";

const { closeDb } = await import("./db.ts");
const { resetLimits } = await import("./limit.ts");
const { app } = await import("./index.ts");

beforeEach(() => {
  closeDb();
  resetLimits();
});

const call = (path: string, init: RequestInit = {}): Promise<Response> =>
  app.handle(new Request(`http://localhost${path}`, init));

const send = (method: string, body: unknown, cookie = ""): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
});

const cookieOf = (response: Response): string =>
  (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

async function registrado(handle = "faku"): Promise<string> {
  const response = await call(
    "/api/auth/register",
    send("POST", { handle, display_name: handle, password: "una clave larga" }),
  );
  return cookieOf(response);
}

const COMPLETO = {
  title: "Programador FullStack",
  summary: "Aplicaciones web a medida, de la base a la pantalla.",
  category: "tecnologia",
  contact_kind: "whatsapp",
  contact_value: "099123456",
  prices: [{ amount: 1500, currency: "UYU", unit: "hora" }],
  status: "pending",
};

describe("servicios por HTTP", () => {
  test("se crean, se listan y se borran, y nada se publica solo", async () => {
    const cookie = await registrado();

    const created = await call("/api/services", send("POST", COMPLETO, cookie));
    expect(created.status).toBe(201);
    const service = (await created.json()) as { id: string; status: string };
    expect(service.status).toBe("pending");

    const mine = (await (await call("/api/services/mine", { headers: { cookie } })).json()) as {
      services: unknown[];
    };
    expect(mine.services).toHaveLength(1);

    expect((await call(`/api/services/${service.id}`, send("DELETE", {}, cookie))).status).toBe(
      200,
    );
  });

  test("pedir published por la ruta ni siquiera pasa el esquema", async () => {
    const cookie = await registrado();
    const response = await call(
      "/api/services",
      send("POST", { ...COMPLETO, status: "published" }, cookie),
    );
    expect(response.status).toBe(422);
  });

  test("el servicio de otro contesta igual que uno que no existe", async () => {
    const mio = await registrado("faku");
    const created = await call("/api/services", send("POST", { title: "Electricista" }, mio));
    const service = (await created.json()) as { id: string };

    const ajeno = await registrado("ajeno");
    expect((await call(`/api/services/${service.id}`, { headers: { cookie: ajeno } })).status).toBe(
      404,
    );
    expect((await call(`/api/services/${service.id}`, send("DELETE", {}, ajeno))).status).toBe(404);
  });

  test("sin sesión no se publica nada", async () => {
    expect((await call("/api/services", send("POST", { title: "Lo que sea" }))).status).toBe(401);
    expect((await call("/api/services/mine")).status).toBe(401);
  });
});

describe("límite de intentos", () => {
  const intento = () =>
    call("/api/auth/login", send("POST", { handle: "nadie", password: "xxxxxxxxxx" }));

  test("/api/auth aguanta diez y corta", async () => {
    for (let n = 0; n < 10; n++) expect((await intento()).status).toBe(401);

    const cortado = await intento();
    expect(cortado.status).toBe(429);
    expect(cortado.headers.get("retry-after")).not.toBeNull();
  });

  /* nginx arma x-forwarded-for con $proxy_add_x_forwarded_for: lo que haya
     mandado el cliente queda adelante. Si contara, cualquiera se inventa una
     dirección por intento y no tiene límite. */
  test("una x-forwarded-for inventada no regala un balde nuevo", async () => {
    for (let n = 0; n < 10; n++) await intento();

    const disfrazado = await call("/api/auth/login", {
      ...send("POST", { handle: "nadie", password: "xxxxxxxxxx" }),
      headers: { "Content-Type": "application/json", "x-forwarded-for": "1.2.3.4" },
    });
    expect(disfrazado.status).toBe(429);
  });

  test("el login de empresas comparte el presupuesto chico", async () => {
    for (let n = 0; n < 10; n++) {
      await call(
        "/api/empresas/auth/login",
        send("POST", { identifier: "nadie", password: "xxxxxxxxxx" }),
      );
    }
    const cortado = await call(
      "/api/empresas/auth/login",
      send("POST", { identifier: "nadie", password: "xxxxxxxxxx" }),
    );
    expect(cortado.status).toBe(429);
  });

  test("cerrar sesión no gasta el presupuesto de quien está entrando", async () => {
    for (let n = 0; n < 12; n++) await call("/api/auth/logout", send("POST", {}));
    expect((await intento()).status).toBe(401);
  });

  /* Antes solo POST contaba como escritura: un PATCH o un DELETE caían en el
     balde de lectura, seis veces más grande y por minuto. */
  test("un DELETE con sesión cuenta como escritura, no como lectura", async () => {
    const cookie = await registrado();
    let last = 0;
    for (let n = 0; n < 61; n++) {
      last = (await call("/api/services/no-existe", send("DELETE", {}, cookie))).status;
    }
    expect(last).toBe(429);
  });
});
