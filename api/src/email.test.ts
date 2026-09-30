import { afterAll, beforeEach, describe, expect, test } from "bun:test";

process.env.DB_FILE = ":memory:";
process.env.ADMIN_INSECURE_COOKIES = "true";
process.env.PUBLIC_URL = "https://jobs.test";
process.env.JOBIT_SECRET_KEY = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
  "base64",
);

const { closeDb, db } = await import("./db.ts");
const { resetLimits } = await import("./limit.ts");
const { setTransport } = await import("./mail.ts");
const { app } = await import("./index.ts");

interface Sent {
  to: string;
  subject: string;
  text: string;
}
let sent: Sent[] = [];

beforeEach(() => {
  closeDb();
  resetLimits();
  sent = [];
  setTransport(async (mail) => {
    sent.push(mail);
    return { ok: true, value: "prueba" };
  });
});

afterAll(() => setTransport(null));

const call = (path: string, init: RequestInit = {}): Promise<Response> =>
  app.handle(new Request(`http://localhost${path}`, init));

const send = (method: string, body: unknown, cookie = ""): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
});

const cookieOf = (response: Response): string =>
  (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

/** El alta y el cambio de correo mandan en segundo plano, sin esperar a Resend. */
async function settle(): Promise<void> {
  for (let n = 0; n < 50 && sent.length === 0; n++) await new Promise((r) => setTimeout(r, 5));
}

/** Lo que haya después de `?token=` o `?restablecer=` en el último correo. */
function linkIn(mail: Sent | undefined): string {
  const match = mail?.text.match(/https:\/\/jobs\.test\S+/);
  if (!match) throw new Error("el correo no trae enlace");
  return match[0];
}

const tokenIn = (link: string): string => new URL(link).searchParams.get("token") ?? "";
const resetTokenIn = (link: string): string => new URL(link).searchParams.get("restablecer") ?? "";

async function alta(email?: string): Promise<string> {
  const response = await call(
    "/api/auth/register",
    send("POST", {
      handle: "faku",
      display_name: "Facundo",
      password: "una clave larga",
      ...(email ? { email } : {}),
    }),
  );
  return cookieOf(response);
}

const me = async (cookie: string) =>
  (
    (await (await call("/api/me", { headers: { cookie } })).json()) as {
      user: { email_verified: boolean; has_email: boolean };
    }
  ).user;

describe("verificación de personas", () => {
  test("el alta con correo manda la verificación, y el enlace la confirma", async () => {
    const cookie = await alta("faku@example.com");
    await settle();

    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("faku@example.com");
    expect((await me(cookie)).email_verified).toBe(false);

    const link = linkIn(sent[0]);
    const response = await call(new URL(link).pathname + new URL(link).search);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://jobs.test/?correo=verificado");

    expect((await me(cookie)).email_verified).toBe(true);
  });

  test("sin correo no se manda nada", async () => {
    await alta();
    await settle();
    expect(sent).toHaveLength(0);
  });

  test("un enlace sirve una sola vez", async () => {
    await alta("faku@example.com");
    await settle();
    const path = `/api/auth/email/verify?token=${tokenIn(linkIn(sent[0]))}`;

    await call(path);
    const second = await call(path);
    expect(second.headers.get("location")).toBe("https://jobs.test/?correo=vencido");
  });

  test("cambiar el correo deja de estar verificado solo, y manda uno nuevo", async () => {
    const cookie = await alta("faku@example.com");
    await settle();
    await call(`/api/auth/email/verify?token=${tokenIn(linkIn(sent[0]))}`);
    expect((await me(cookie)).email_verified).toBe(true);

    sent = [];
    await call("/api/me", send("PATCH", { email: "otro@example.com" }, cookie));
    await settle();

    expect((await me(cookie)).email_verified).toBe(false);
    expect(sent[0]?.to).toBe("otro@example.com");
  });

  test("reenviar enseguida no manda otro: diez minutos entre uno y otro", async () => {
    const cookie = await alta("faku@example.com");
    await settle();

    const again = await call("/api/me/email/verify", send("POST", {}, cookie));
    expect(again.status).toBe(200);
    expect(sent).toHaveLength(1);
  });
});

describe("reset de contraseña de personas", () => {
  const pedir = (handle: string) => call("/api/auth/recover/email", send("POST", { handle }));

  test("contesta lo mismo exista o no la cuenta", async () => {
    await alta("faku@example.com");
    const real = await (await pedir("faku")).json();
    const nadie = await (await pedir("nadie")).json();
    expect(real).toEqual(nadie);
  });

  test("el enlace cambia la contraseña, cierra las sesiones y sirve una vez", async () => {
    const cookie = await alta("faku@example.com");
    await settle();
    sent = [];

    await pedir("faku");
    await settle();
    const token = resetTokenIn(linkIn(sent[0]));
    expect(linkIn(sent[0]).startsWith("https://jobs.test/?restablecer=")).toBe(true);

    const done = await call("/api/auth/reset", send("POST", { token, password: "la clave nueva" }));
    expect(done.status).toBe(200);
    expect((await call("/api/me", { headers: { cookie } })).status).toBe(401);

    const login = await call(
      "/api/auth/login",
      send("POST", { handle: "faku", password: "la clave nueva" }),
    );
    expect(login.status).toBe(200);

    const again = await call(
      "/api/auth/reset",
      send("POST", { token, password: "otra más larga" }),
    );
    expect(again.status).toBe(422);
  });

  test("sin correo cargado no sale nada, y la respuesta es la misma", async () => {
    await alta();
    await settle();
    await pedir("faku");
    await settle();
    expect(sent).toHaveLength(0);
  });

  test("un token de verificación no sirve para resetear", async () => {
    await alta("faku@example.com");
    await settle();
    const token = tokenIn(linkIn(sent[0]));
    expect(
      (await call("/api/auth/reset", send("POST", { token, password: "la clave nueva" }))).status,
    ).toBe(422);
  });
});

describe("empresas", () => {
  async function empresa(): Promise<string> {
    const response = await call(
      "/api/empresas/auth/register",
      send("POST", { name: "Acme", email: "rrhh@acme.test", password: "clave de acme" }),
    );
    return cookieOf(response);
  }

  test("el alta manda la verificación y el enlace vuelve a /empresas", async () => {
    const cookie = await empresa();
    await settle();
    expect(sent[0]?.to).toBe("rrhh@acme.test");

    const response = await call(`/api/auth/email/verify?token=${tokenIn(linkIn(sent[0]))}`);
    expect(response.headers.get("location")).toBe("https://jobs.test/empresas?correo=verificado");

    const company = (
      (await (await call("/api/empresas/session", { headers: { cookie } })).json()) as {
        company: { email_verified: boolean };
      }
    ).company;
    expect(company.email_verified).toBe(true);
  });

  test("el reset de empresa cambia la clave y cierra sus sesiones", async () => {
    const cookie = await empresa();
    await settle();
    sent = [];

    await call("/api/empresas/auth/recover", send("POST", { identifier: "rrhh@acme.test" }));
    await settle();
    const link = linkIn(sent[0]);
    expect(link.startsWith("https://jobs.test/empresas?restablecer=")).toBe(true);

    const done = await call(
      "/api/auth/reset",
      send("POST", { token: resetTokenIn(link), password: "clave nueva de acme" }),
    );
    expect(done.status).toBe(200);
    expect((await call("/api/empresas/session", { headers: { cookie } })).status).toBe(401);
  });
});

describe("lo que dice un correo", () => {
  test("texto plano, sin HTML, y sin nada de la persona más que la dirección", async () => {
    await alta("faku@example.com");
    await settle();
    const mail = sent[0];
    expect(mail?.text).not.toMatch(/<[a-z]/i);
    expect(mail?.text).not.toContain("Facundo");
    expect(mail?.text).not.toContain("faku@");
    expect(mail?.subject).not.toContain("Facundo");
  });
});

describe("borrado", () => {
  test("borrar la cuenta se lleva su rastro de correo", async () => {
    const cookie = await alta("faku@example.com");
    await settle();
    await call(`/api/auth/email/verify?token=${tokenIn(linkIn(sent[0]))}`);

    await call("/api/me", send("DELETE", { password: "una clave larga" }, cookie));

    const verified = db()
      .query<{ n: number }, []>("SELECT COUNT(*) AS n FROM email_verified")
      .get();
    const tokens = db().query<{ n: number }, []>("SELECT COUNT(*) AS n FROM email_tokens").get();
    expect(verified?.n).toBe(0);
    expect(tokens?.n).toBe(0);
  });
});
