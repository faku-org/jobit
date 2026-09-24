import { beforeEach, describe, expect, test } from "bun:test";

process.env.DB_FILE = ":memory:";
process.env.ADMIN_INSECURE_COOKIES = "true";

const KEY = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
process.env.JOBIT_SECRET_KEY = KEY;

const { closeDb, db } = await import("./db.ts");
const { resetSecretKey } = await import("./crypto.ts");
const { resetLimits } = await import("./limit.ts");
const { app } = await import("./index.ts");

beforeEach(() => {
  closeDb();
  resetLimits();
  resetSecretKey();
  process.env.JOBIT_SECRET_KEY = KEY;
  delete process.env.JOBIT_SECRET_KEY_FILE;
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

async function register(handle = "faku"): Promise<string> {
  const response = await call(
    "/api/auth/register",
    json({ handle, display_name: "Facu", password: "una-clave-larga" }),
  );
  return cookieNamed(response, "jobit_session");
}

describe("sync", () => {
  test("pide sesión", async () => {
    const response = await call("/api/me/sync");
    expect(response.status).toBe(401);
  });

  test("sin nada guardado la cuenta no tiene sync", async () => {
    const cookie = await register();
    const response = await call("/api/me/sync", { headers: { cookie } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ enabled: false, payload: null, updated_at: "" });
  });

  test("guarda, devuelve y borra lo que la persona eligió", async () => {
    const cookie = await register();
    const payload = { saved: ["a", "b"], preferences: { mix: "focused" } };

    const put = await call("/api/me/sync", withCookie(json({ payload }, "PUT"), cookie));
    expect(put.status).toBe(200);

    const got = await call("/api/me/sync", { headers: { cookie } });
    const body = (await got.json()) as { enabled: boolean; payload: unknown };
    expect(body.enabled).toBe(true);
    expect(body.payload).toEqual(payload);

    const removed = await call("/api/me/sync", { method: "DELETE", headers: { cookie } });
    expect(removed.status).toBe(200);

    const after = (await (await call("/api/me/sync", { headers: { cookie } })).json()) as {
      enabled: boolean;
      payload: unknown;
    };
    expect(after.enabled).toBe(false);
    expect(after.payload).toBeNull();
  });

  test("lo guardado queda cifrado en la base", async () => {
    const cookie = await register();
    await call("/api/me/sync", withCookie(json({ payload: { secreto: "MANGO" } }, "PUT"), cookie));

    const row = db().query<{ payload_enc: string }, []>("SELECT payload_enc FROM user_sync").get();
    expect(row).not.toBeNull();
    expect(row?.payload_enc).not.toContain("MANGO");
    expect((row?.payload_enc ?? "").length).toBeGreaterThan(0);
  });

  test("sin clave de cifrado el sync queda apagado", async () => {
    const cookie = await register();
    delete process.env.JOBIT_SECRET_KEY;
    resetSecretKey();

    const put = await call("/api/me/sync", withCookie(json({ payload: {} }, "PUT"), cookie));
    expect(put.status).toBe(503);
  });
});
