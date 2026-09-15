import { beforeEach, describe, expect, test } from "bun:test";

process.env.DB_FILE = ":memory:";
process.env.INSECURE_COOKIES = "true";
const KEY = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");

const { closeDb } = await import("./db.ts");
const { resetLimits } = await import("./limit.ts");
const { resetSecretsCache } = await import("./secrets.ts");
const { totpCode } = await import("./totp.ts");
const { app } = await import("./index.ts");

beforeEach(() => {
  closeDb();
  resetLimits();
  resetSecretsCache();
  process.env.ACCOUNT_KEY = KEY;
});

const call = (path: string, init: RequestInit = {}): Promise<Response> =>
  app.handle(new Request(`http://localhost${path}`, init));

const send = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const json = (body: unknown): RequestInit => send("POST", body);

const withCookie = (init: RequestInit, cookie: string): RequestInit => ({
  ...init,
  headers: { ...(init.headers as Record<string, string>), cookie },
});

const cookieOf = (response: Response): string =>
  (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

const ALTA = {
  handle: "faku",
  display_name: "Facundo",
  password: "una clave larga",
};

/** Alta y cookie de sesión, que es como empieza casi todo lo de abajo. */
async function registrado(): Promise<string> {
  return cookieOf(await call("/api/auth/register", json(ALTA)));
}

describe("con las cuentas apagadas", () => {
  beforeEach(() => {
    delete process.env.ACCOUNT_KEY;
  });

  test("el alta ni existe", async () => {
    expect((await call("/api/auth/register", json(ALTA))).status).toBe(404);
  });

  test("los servicios tampoco", async () => {
    expect((await call("/api/services/mine")).status).toBe(404);
  });

  test("el resto de la API sigue andando", async () => {
    expect((await call("/health")).status).toBe(200);
  });
});

describe("alta", () => {
  test("crea la cuenta, deja la cookie y muestra los códigos una sola vez", async () => {
    const response = await call("/api/auth/register", json(ALTA));
    expect(response.status).toBe(201);

    const body = (await response.json()) as {
      recovery_codes: string[];
      warning: string;
      user: { handle: string };
    };
    expect(body.user.handle).toBe("faku");
    expect(body.recovery_codes).toHaveLength(8);
    /** Sin correo no hay reset, y hay que decirlo con todas las letras. */
    expect(body.warning).toContain("única forma de volver a entrar");

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("jobit_session=");
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie).toContain("Path=/api");
  });

  test("el handle repetido se rechaza sin abrir sesión", async () => {
    await call("/api/auth/register", json(ALTA));
    const response = await call("/api/auth/register", json(ALTA));
    expect(response.status).toBe(422);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("entrada", () => {
  beforeEach(async () => {
    await call("/api/auth/register", json(ALTA));
  });

  test("la clave correcta abre sesión", async () => {
    const response = await call(
      "/api/auth/login",
      json({ handle: "faku", password: "una clave larga" }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()) as { status: string }).toMatchObject({ status: "ok" });
  });

  test("el mismo error para el handle que no existe y para la clave mala", async () => {
    const mala = await call("/api/auth/login", json({ handle: "faku", password: "otra clave" }));
    const nadie = await call(
      "/api/auth/login",
      json({ handle: "nadie", password: "una clave larga" }),
    );

    expect(mala.status).toBe(401);
    expect(nadie.status).toBe(401);
    expect(await mala.json()).toEqual(await nadie.json());
  });

  test("cerrar sesión la invalida en el acto", async () => {
    const cookie = await registrado();
    await call("/api/auth/logout", withCookie(json({}), cookie));
    expect((await call("/api/me", { headers: { cookie } })).status).toBe(401);
  });
});

describe("segundo factor", () => {
  test("el login se queda en el primer paso hasta que llegue el código", async () => {
    const cookie = await registrado();

    const setup = (await (await call("/api/me/totp", withCookie(json({}), cookie))).json()) as {
      secret: string;
      otpauth: string;
    };
    expect(setup.otpauth.startsWith("otpauth://totp/")).toBe(true);

    const code = (await totpCode(setup.secret)) ?? "";
    expect((await call("/api/me/totp/confirm", withCookie(json({ code }), cookie))).status).toBe(
      200,
    );

    const login = await call(
      "/api/auth/login",
      json({ handle: "faku", password: "una clave larga" }),
    );
    expect(await login.json()).toEqual({ status: "totp" });

    /** La sesión a medio abrir no es nadie todavía. */
    const media = cookieOf(login);
    expect((await call("/api/me", { headers: { cookie: media } })).status).toBe(401);

    const segundo = await call(
      "/api/auth/totp",
      withCookie(json({ code: (await totpCode(setup.secret)) ?? "" }), media),
    );
    expect(segundo.status).toBe(200);
    expect((await call("/api/me", { headers: { cookie: media } })).status).toBe(200);
  });

  test("un código que no coincide no abre nada", async () => {
    const cookie = await registrado();
    const setup = (await (await call("/api/me/totp", withCookie(json({}), cookie))).json()) as {
      secret: string;
    };
    await call(
      "/api/me/totp/confirm",
      withCookie(json({ code: (await totpCode(setup.secret)) ?? "" }), cookie),
    );

    const login = await call(
      "/api/auth/login",
      json({ handle: "faku", password: "una clave larga" }),
    );
    const media = cookieOf(login);

    expect((await call("/api/auth/totp", withCookie(json({ code: "000000" }), media))).status).toBe(
      401,
    );
    expect((await call("/api/me", { headers: { cookie: media } })).status).toBe(401);
  });
});

describe("perfil", () => {
  test("dice quién soy y qué publiqué, y nunca el hash ni el correo", async () => {
    const cookie = await registrado();
    const body = (await (await call("/api/me", { headers: { cookie } })).json()) as Record<
      string,
      unknown
    >;

    expect(body.user).toMatchObject({ handle: "faku" });
    expect(JSON.stringify(body)).not.toContain("argon2");
    expect(body.services).toMatchObject({ draft: 0, published: 0 });
    expect(body.recovery_codes_left).toBe(8);
  });

  test("sin sesión no hay perfil", async () => {
    expect((await call("/api/me")).status).toBe(401);
    expect((await call("/api/me", { headers: { cookie: "jobit_session=inventada" } })).status).toBe(
      401,
    );
  });

  test("el borrado pide la contraseña y borra de verdad", async () => {
    const cookie = await registrado();

    expect(
      (await call("/api/me", withCookie(send("DELETE", { password: "la que no es" }), cookie)))
        .status,
    ).toBe(422);

    expect(
      (await call("/api/me", withCookie(send("DELETE", { password: "una clave larga" }), cookie)))
        .status,
    ).toBe(200);

    expect((await call("/api/me", { headers: { cookie } })).status).toBe(401);
    expect(
      (await call("/api/auth/login", json({ handle: "faku", password: "una clave larga" }))).status,
    ).toBe(401);
  });
});

describe("servicios", () => {
  test("se crean, se listan y se borran, y nada se publica solo", async () => {
    const cookie = await registrado();

    const created = await call(
      "/api/services",
      withCookie(
        json({
          title: "Programador FullStack",
          summary: "Aplicaciones web a medida, de la base a la pantalla.",
          category: "tecnologia",
          contact_kind: "whatsapp",
          contact_value: "099123456",
          prices: [{ amount: 1500, currency: "UYU", unit: "hora" }],
          status: "pending",
        }),
        cookie,
      ),
    );
    expect(created.status).toBe(201);
    const service = (await created.json()) as { id: string; status: string };
    expect(service.status).toBe("pending");

    const mine = (await (await call("/api/services/mine", { headers: { cookie } })).json()) as {
      services: unknown[];
      max: number;
    };
    expect(mine.services).toHaveLength(1);

    expect(
      (await call(`/api/services/${service.id}`, withCookie(send("DELETE", {}), cookie))).status,
    ).toBe(200);
  });

  test("el servicio de otro contesta igual que uno que no existe", async () => {
    const mio = await registrado();
    const created = await call("/api/services", withCookie(json({ title: "Electricista" }), mio));
    const service = (await created.json()) as { id: string };

    const ajeno = cookieOf(
      await call(
        "/api/auth/register",
        json({ handle: "ajeno", display_name: "Ajeno", password: "otra clave larga" }),
      ),
    );

    expect((await call(`/api/services/${service.id}`, { headers: { cookie: ajeno } })).status).toBe(
      404,
    );
    expect(
      (await call(`/api/services/${service.id}`, withCookie(send("DELETE", {}), ajeno))).status,
    ).toBe(404);
  });

  test("sin sesión no se publica nada", async () => {
    expect((await call("/api/services", json({ title: "Lo que sea" }))).status).toBe(401);
    expect((await call("/api/services/mine")).status).toBe(401);
  });
});

describe("límite de intentos", () => {
  test("/api/auth aguanta diez y corta", async () => {
    for (let intento = 0; intento < 10; intento++) {
      const response = await call(
        "/api/auth/login",
        json({ handle: "nadie", password: "xxxxxxxxxx" }),
      );
      expect(response.status).toBe(401);
    }

    const cortado = await call(
      "/api/auth/login",
      json({ handle: "nadie", password: "xxxxxxxxxx" }),
    );
    expect(cortado.status).toBe(429);
    expect(cortado.headers.get("retry-after")).not.toBeNull();
  });

  test("una x-forwarded-for inventada no regala un balde nuevo", async () => {
    for (let intento = 0; intento < 10; intento++) {
      await call("/api/auth/login", json({ handle: "nadie", password: "xxxxxxxxxx" }));
    }

    /* La cabecera que nginx agrega al final es la única real, y esta no pasó
       por nginx: si contara, alguien se inventa una dirección por intento. */
    const disfrazado = await app.handle(
      new Request("http://localhost/api/auth/login", {
        ...json({ handle: "nadie", password: "xxxxxxxxxx" }),
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "1.2.3.4",
        },
      }),
    );
    expect(disfrazado.status).toBe(429);
  });

  test("cerrar sesión no gasta el presupuesto de quien está entrando", async () => {
    for (let intento = 0; intento < 12; intento++) {
      await call("/api/auth/logout", json({}));
    }
    expect(
      (await call("/api/auth/login", json({ handle: "nadie", password: "xxxxxxxxxx" }))).status,
    ).toBe(401);
  });
});
