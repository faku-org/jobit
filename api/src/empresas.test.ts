import { beforeEach, describe, expect, test } from "bun:test";

process.env.DB_FILE = ":memory:";
process.env.ADMIN_INSECURE_COOKIES = "true";

const { closeDb } = await import("./db.ts");
const { resetLimits } = await import("./limit.ts");
const companies = await import("./companies.ts");
const { appendEvents } = await import("./events.ts");
const { app } = await import("./index.ts");

beforeEach(() => {
  closeDb();
  resetLimits();
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

function cookieNamed(response: Response, name: string): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const many = headers.getSetCookie?.() ?? [];
  const raw = many.length > 0 ? many : [response.headers.get("set-cookie") ?? ""];
  return (
    raw.map((entry) => entry.split(";")[0] ?? "").find((pair) => pair.startsWith(`${name}=`)) ?? ""
  );
}

async function registerCompany(
  name: string,
  email: string,
  password = "una-clave-larga",
): Promise<{ response: Response; cookie: string; id: string; slug: string }> {
  const response = await call("/api/empresas/auth/register", json({ name, email, password }));
  const body = (await response.json()) as { company?: { id: string; slug: string } };
  return {
    response,
    cookie: cookieNamed(response, "jobit_company"),
    id: body.company?.id ?? "",
    slug: body.company?.slug ?? "",
  };
}

describe("alta de empresa", () => {
  test("nace pendiente y con la sesión puesta", async () => {
    const { response, cookie, id } = await registerCompany("Acme", "rrhh@acme.com");
    expect(response.status).toBe(201);
    expect(cookie).toContain("jobit_company=");
    expect(companies.byId(id)?.status).toBe("pending");
  });

  test("no deja dos empresas con el mismo correo", async () => {
    await registerCompany("Acme", "rrhh@acme.com");
    const second = await registerCompany("Beta", "rrhh@acme.com");
    expect(second.response.status).toBe(422);
  });

  test("sin correo no hay cuenta, porque es con lo que se entra", async () => {
    const response = await call(
      "/api/empresas/auth/register",
      json({ name: "Acme", email: "", password: "una-clave-larga" }),
    );
    expect(response.status).toBe(422);
  });
});

describe("entrar y salir", () => {
  test("entra con el correo y con el slug", async () => {
    const { slug } = await registerCompany("Acme", "rrhh@acme.com");

    const byEmail = await call(
      "/api/empresas/auth/login",
      json({ identifier: "rrhh@acme.com", password: "una-clave-larga" }),
    );
    const bySlug = await call(
      "/api/empresas/auth/login",
      json({ identifier: slug, password: "una-clave-larga" }),
    );
    expect(byEmail.status).toBe(200);
    expect(bySlug.status).toBe(200);
  });

  test("la clave que no es no entra", async () => {
    await registerCompany("Acme", "rrhh@acme.com");
    const response = await call(
      "/api/empresas/auth/login",
      json({ identifier: "rrhh@acme.com", password: "otra-clave" }),
    );
    expect(response.status).toBe(401);
  });

  test("una empresa suspendida no entra aunque la clave esté bien", async () => {
    const { id } = await registerCompany("Acme", "rrhh@acme.com");
    companies.update(id, { status: "suspended" });

    const response = await call(
      "/api/empresas/auth/login",
      json({ identifier: "rrhh@acme.com", password: "una-clave-larga" }),
    );
    expect(response.status).toBe(403);
  });

  test("suspender corta la sesión que ya estaba abierta", async () => {
    const { cookie, id } = await registerCompany("Acme", "rrhh@acme.com");
    expect((await call("/api/empresas/session", withCookie({}, cookie))).status).toBe(200);

    companies.update(id, { status: "suspended" });
    expect((await call("/api/empresas/session", withCookie({}, cookie))).status).toBe(401);
  });

  test("sin sesión no se ve nada del panel", async () => {
    expect((await call("/api/empresas/offers")).status).toBe(401);
    expect((await call("/api/empresas/metrics")).status).toBe(401);
  });
});

describe("ofertas propias", () => {
  const draft = (title: string, status?: string) => ({
    title,
    category: "tecnologia",
    status,
  });

  test("una empresa pendiente guarda borradores pero no publica", async () => {
    const { cookie } = await registerCompany("Acme", "rrhh@acme.com");

    const saved = await call(
      "/api/empresas/offers",
      withCookie(json(draft("Backend", "draft")), cookie),
    );
    expect(saved.status).toBe(201);

    const published = await call(
      "/api/empresas/offers",
      withCookie(json(draft("Backend", "published")), cookie),
    );
    expect(published.status).toBe(422);
  });

  test("aprobada, publica", async () => {
    const { cookie, id } = await registerCompany("Acme", "rrhh@acme.com");
    companies.update(id, { status: "approved" });

    const published = await call(
      "/api/empresas/offers",
      withCookie(json(draft("Backend", "published")), cookie),
    );
    expect(published.status).toBe(201);
  });

  test("no se puede tocar la oferta de otra empresa", async () => {
    const first = await registerCompany("Acme", "rrhh@acme.com");
    const second = await registerCompany("Beta", "rrhh@beta.com");
    companies.update(first.id, { status: "approved" });

    const created = await call(
      "/api/empresas/offers",
      withCookie(json(draft("Backend")), first.cookie),
    );
    const offer = (await created.json()) as { id: string };

    const patched = await call(
      `/api/empresas/offers/${offer.id}`,
      withCookie(json({ title: "Otra cosa" }, "PATCH"), second.cookie),
    );
    const removed = await call(
      `/api/empresas/offers/${offer.id}`,
      withCookie({ method: "DELETE" }, second.cookie),
    );
    expect(patched.status).toBe(404);
    expect(removed.status).toBe(404);
  });

  test("el listado trae solo las de la empresa", async () => {
    const first = await registerCompany("Acme", "rrhh@acme.com");
    await registerCompany("Beta", "rrhh@beta.com");

    await call("/api/empresas/offers", withCookie(json(draft("Backend")), first.cookie));

    const listed = await call("/api/empresas/offers", withCookie({}, first.cookie));
    const body = (await listed.json()) as { offers: { title: string }[] };
    expect(body.offers.map((offer) => offer.title)).toEqual(["Backend"]);
  });
});

describe("métricas", () => {
  test("cuenta vistas y postulaciones sin guardar una fila por visita", async () => {
    const { cookie, id } = await registerCompany("Acme", "rrhh@acme.com");
    companies.update(id, { status: "approved" });

    const created = await call(
      "/api/empresas/offers",
      withCookie(json({ title: "Backend", status: "draft" }), cookie),
    );
    const offer = (await created.json()) as { id: string };

    await appendEvents([
      { kind: "offer_view", id: offer.id },
      { kind: "offer_view", id: offer.id },
      { kind: "offer_view", id: offer.id },
      { kind: "offer_apply", id: offer.id },
    ]);

    const response = await call("/api/empresas/metrics?days=7", withCookie({}, cookie));
    const report = (await response.json()) as {
      views: number;
      applies: number;
      most_viewed: { id: string; views: number }[];
    };
    expect(report.views).toBe(3);
    expect(report.applies).toBe(1);
    expect(report.most_viewed[0]?.id).toBe(offer.id);
  });

  test("un id que no es una oferta propia no rompe el lote", async () => {
    expect(await appendEvents([{ kind: "offer_view", id: "no-existe" }])).toBe(0);
  });
});
