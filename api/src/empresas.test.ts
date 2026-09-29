import { beforeEach, describe, expect, test } from "bun:test";

process.env.DB_FILE = ":memory:";
process.env.ADMIN_INSECURE_COOKIES = "true";
process.env.UPLOADS_DIR = `${process.env.TMPDIR ?? process.env.TEMP ?? "."}/jobit-test-uploads`;

const KEY = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");

const { closeDb } = await import("./db.ts");
const { resetSecretKey } = await import("./crypto.ts");
const { resetLimits } = await import("./limit.ts");
const companies = await import("./companies.ts");
const accounts = await import("./company-accounts.ts");
const emails = await import("./company-emails.ts");
const members = await import("./company-members.ts");
const users = await import("./users.ts");
const { totp } = await import("./totp.ts");
const { appendEvents } = await import("./events.ts");
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

function cookieNamed(response: Response, name: string): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const many = headers.getSetCookie?.() ?? [];
  const raw = many.length > 0 ? many : [response.headers.get("set-cookie") ?? ""];
  return (
    raw.map((entry) => entry.split(";")[0] ?? "").find((pair) => pair.startsWith(`${name}=`)) ?? ""
  );
}

/** Completa la activación del segundo paso obligatorio y devuelve la cookie. */
async function completeTotp(challenge: string): Promise<string> {
  const start = await call("/api/empresas/auth/totp/setup", withCookie(json({}), challenge));
  const setup = (await start.json()) as { secret: string };
  const code = await totp(setup.secret);
  const done = await call(
    "/api/empresas/auth/totp/setup",
    withCookie(json({ code }), challenge),
  );
  return cookieNamed(done, "jobit_company");
}

async function registerCompany(
  name: string,
  email: string,
  password = "una-clave-larga",
): Promise<{ response: Response; cookie: string; id: string; slug: string; codes: string[] }> {
  const response = await call("/api/empresas/auth/register", json({ name, email, password }));
  const body = (await response.json()) as { company?: { id: string; slug: string } };
  const challenge = cookieNamed(response, "jobit_company_2fa");
  const cookie = challenge ? await completeTotp(challenge) : "";
  return {
    response,
    cookie,
    id: body.company?.id ?? "",
    slug: body.company?.slug ?? "",
    codes: [],
  };
}

/** Entra con correo o slug, resolviendo el segundo paso. */
async function loginCompany(
  identifier: string,
  password = "una-clave-larga",
): Promise<{ response: Response; cookie: string }> {
  const response = await call("/api/empresas/auth/login", json({ identifier, password }));
  const body = (await response.json()) as { status?: string };
  if (body.status === "totp_required") {
    const challenge = cookieNamed(response, "jobit_company_2fa");
    const company = companies.byEmailOrSlug(identifier)!;
    const secret = await accounts.totpSecret(company.id);
    const code = secret ? await totp(secret) : "";
    const done = await call("/api/empresas/auth/totp", withCookie(json({ code }), challenge));
    return { response: done, cookie: cookieNamed(done, "jobit_company") };
  }
  return { response, cookie: cookieNamed(response, "jobit_company") };
}

describe("alta de empresa", () => {
  test("nace pendiente y pide el segundo paso antes de abrir sesión", async () => {
    const response = await call(
      "/api/empresas/auth/register",
      json({ name: "Acme", email: "rrhh@acme.com", password: "una-clave-larga" }),
    );
    const body = (await response.json()) as { status: string };
    expect(response.status).toBe(201);
    expect(body.status).toBe("totp_setup_required");
    expect(cookieNamed(response, "jobit_company")).toBe("");
    expect(cookieNamed(response, "jobit_company_2fa")).toContain("jobit_company_2fa=");

    const { cookie, id } = await registerCompany("Beta", "rrhh@beta.com");
    expect(companies.byId(id)?.status).toBe("pending");
    expect(cookie).toContain("jobit_company=");
  });

  test("sin clave de cifrado no se puede crear cuenta: el 2FA es obligatorio", async () => {
    resetSecretKey();
    delete process.env.JOBIT_SECRET_KEY;
    const response = await call(
      "/api/empresas/auth/register",
      json({ name: "Acme", email: "rrhh@acme.com", password: "una-clave-larga" }),
    );
    expect(response.status).toBe(503);
  });

  test("no deja dos empresas con el mismo correo", async () => {
    await registerCompany("Acme", "rrhh@acme.com");
    const second = await registerCompany("Beta", "rrhh@acme.com");
    expect(second.response.status).toBe(422);
  });

  test("exige una contraseña con mínimos de seguridad", async () => {
    const weak = await call(
      "/api/empresas/auth/register",
      json({ name: "Acme", email: "rrhh@acme.com", password: "solominusculas" }),
    );
    expect(weak.status).toBe(422);

    const short = await call(
      "/api/empresas/auth/register",
      json({ name: "Acme", email: "rrhh@acme.com", password: "corta" }),
    );
    expect(short.status).toBe(422);
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
  test("entra con el correo y con el slug, con el segundo paso", async () => {
    const { slug } = await registerCompany("Acme", "rrhh@acme.com");

    const byEmail = await loginCompany("rrhh@acme.com");
    const bySlug = await loginCompany(slug);
    expect(byEmail.response.status).toBe(200);
    expect(bySlug.response.status).toBe(200);
    expect(byEmail.cookie).toContain("jobit_company=");
  });

  test("el login no abre sesión hasta el código", async () => {
    await registerCompany("Acme", "rrhh@acme.com");
    const response = await call(
      "/api/empresas/auth/login",
      json({ identifier: "rrhh@acme.com", password: "una-clave-larga" }),
    );
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe("totp_required");
    expect(cookieNamed(response, "jobit_company")).toBe("");
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

describe("perfil de la empresa", () => {
  test("guarda teléfono, redes y sitio", async () => {
    const { cookie, id } = await registerCompany("Acme", "rrhh@acme.com");

    const updated = await call(
      "/api/empresas/me",
      withCookie(
        json(
          {
            phone: "+598 99 123 456",
            socials: { linkedin: "https://linkedin.com/company/acme" },
          },
          "PATCH",
        ),
        cookie,
      ),
    );
    const body = (await updated.json()) as { company: { phone: string; socials: Record<string, string> } };
    expect(updated.status).toBe(200);
    expect(body.company.phone).toBe("+598 99 123 456");
    expect(body.company.socials.linkedin).toBe("https://linkedin.com/company/acme");
    expect(companies.byId(id)?.socials.linkedin).toContain("linkedin.com");
  });

  test("rechaza una red que no sea http(s)", async () => {
    const { cookie } = await registerCompany("Acme", "rrhh@acme.com");
    const updated = await call(
      "/api/empresas/me",
      withCookie(json({ socials: { x: "javascript:alert(1)" } }, "PATCH"), cookie),
    );
    expect(updated.status).toBe(422);
  });
});

describe("privacidad, redes y dominio", () => {
  test("un usuario suelto en una red se guarda como URL", async () => {
    const { cookie } = await registerCompany("Acme", "rrhh@acme.com");
    const updated = await call(
      "/api/empresas/me",
      withCookie(
        json({ socials: { instagram: "@acme", whatsapp: "+598 99 123 456" } }, "PATCH"),
        cookie,
      ),
    );
    const body = (await updated.json()) as { company: { socials: Record<string, string> } };
    expect(body.company.socials.instagram).toBe("https://www.instagram.com/acme");
    expect(body.company.socials.whatsapp).toBe("https://wa.me/59899123456");
  });

  test("guarda la privacidad del perfil", async () => {
    const { cookie } = await registerCompany("Acme", "rrhh@acme.com");
    const updated = await call(
      "/api/empresas/me",
      withCookie(json({ privacy: { phone: false, email: false } }, "PATCH"), cookie),
    );
    const body = (await updated.json()) as { company: { privacy: Record<string, boolean> } };
    expect(body.company.privacy).toEqual({
      phone: false,
      email: false,
      website: true,
      members: true,
    });
  });

  test("cargar el sitio devuelve el TXT a registrar", async () => {
    const { cookie } = await registerCompany("Acme", "rrhh@acme.com");
    const updated = await call(
      "/api/empresas/me",
      withCookie(json({ website: "https://acme.com" }, "PATCH"), cookie),
    );
    const body = (await updated.json()) as {
      company: { website_verification: { record_name: string; record_value: string; verified: boolean } };
    };
    expect(body.company.website_verification.record_name).toBe("_jobit.acme.com");
    expect(body.company.website_verification.record_value).toContain("jobit-verify=");
    expect(body.company.website_verification.verified).toBe(false);
  });
});

describe("cambio de contraseña", () => {
  test("pide el segundo paso y un código por correo", async () => {
    const { cookie, id } = await registerCompany("Acme", "rrhh@acme.com");
    const secret = await accounts.totpSecret(id);
    const totpCode = secret ? await totp(secret) : "";

    const bare = await call(
      "/api/empresas/me",
      withCookie(
        json({ current_password: "una-clave-larga", new_password: "otra-clave-larga" }, "PATCH"),
        cookie,
      ),
    );
    expect(bare.status).toBe(401);

    const noEmail = await call(
      "/api/empresas/me",
      withCookie(
        json(
          {
            current_password: "una-clave-larga",
            new_password: "otra-clave-larga",
            totp_code: totpCode,
          },
          "PATCH",
        ),
        cookie,
      ),
    );
    expect(noEmail.status).toBe(401);

    const emailCode = accounts.startPasswordCode(id);
    const changed = await call(
      "/api/empresas/me",
      withCookie(
        json(
          {
            current_password: "una-clave-larga",
            new_password: "otra-clave-larga",
            totp_code: totpCode,
            email_code: emailCode,
          },
          "PATCH",
        ),
        cookie,
      ),
    );
    expect(changed.status).toBe(200);

    const again = await loginCompany("rrhh@acme.com", "otra-clave-larga");
    expect(again.response.status).toBe(200);
  });

  test("sin correo verificado no se puede pedir el código", async () => {
    const { cookie } = await registerCompany("Acme", "rrhh@acme.com");
    const response = await call("/api/empresas/me/password/email", withCookie(json({}), cookie));
    expect(response.status).toBe(422);
  });
});

describe("correos verificados", () => {
  test("cargar un correo lo deja sin verificar y mandar el token lo confirma", async () => {
    const { cookie, id } = await registerCompany("Acme", "rrhh@acme.com");

    const saved = await call(
      "/api/empresas/emails/contact",
      withCookie(json({ email: "hola@acme.com" }, "PUT"), cookie),
    );
    const body = (await saved.json()) as { emails: { kind: string; verified: boolean }[] };
    expect(body.emails.find((entry) => entry.kind === "contact")?.verified).toBe(false);

    const again = emails.set(id, "contact", "hola@acme.com");
    const token = again.ok ? again.value.token : null;
    expect(token).toBeTruthy();

    const verified = await call(`/api/empresas/verify?c=${id}&k=contact&t=${token}`);
    expect(verified.status).toBe(302);
    expect(emails.get(id, "contact")?.verified).toBe(true);
  });

  test("un token que no es no verifica nada", async () => {
    const { id } = await registerCompany("Acme", "rrhh@acme.com");
    emails.set(id, "support", "soporte@acme.com");
    expect(emails.verify(id, "support", "token-inventado")).toBe(false);
    expect(emails.get(id, "support")?.verified).toBe(false);
  });
});

describe("imágenes", () => {
  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);

  test("sube un logo y lo sirve público", async () => {
    const { cookie, id } = await registerCompany("Acme", "rrhh@acme.com");

    const form = new FormData();
    form.append("file", new Blob([png], { type: "image/png" }), "logo.png");
    const uploaded = await call("/api/empresas/media/logo", withCookie({ method: "POST", body: form }, cookie));
    const body = (await uploaded.json()) as { company: { logo: string } };
    expect(uploaded.status).toBe(200);
    expect(body.company.logo).toBe(`/api/empresas/media/${id}/logo`);

    const served = await call(body.company.logo);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
  });

  test("rechaza algo que no es una imagen", async () => {
    const { cookie } = await registerCompany("Acme", "rrhh@acme.com");
    const form = new FormData();
    form.append("file", new Blob([new TextEncoder().encode("no soy una imagen")], { type: "image/png" }), "x.png");
    const uploaded = await call("/api/empresas/media/logo", withCookie({ method: "POST", body: form }, cookie));
    expect(uploaded.status).toBe(422);
  });
});

describe("miembros", () => {
  test("designa a un usuario de JobIt y lo saca", async () => {
    const { cookie, id } = await registerCompany("Acme", "rrhh@acme.com");
    const person = await users.create({
      handle: "faku",
      display_name: "Facu",
      password: "una-clave-larga",
    });
    if (!person.ok) throw new Error("no se creó el usuario");

    const added = await call("/api/empresas/members", withCookie(json({ handle: "faku" }), cookie));
    const body = (await added.json()) as { members: { handle: string }[] };
    expect(added.status).toBe(201);
    expect(body.members.map((entry) => entry.handle)).toEqual(["faku"]);

    const removed = await call(
      `/api/empresas/members/${person.value.user.id}`,
      withCookie({ method: "DELETE" }, cookie),
    );
    const after = (await removed.json()) as { members: unknown[] };
    expect(after.members).toHaveLength(0);
    expect(members.list(id)).toHaveLength(0);
  });

  test("un handle que no existe no entra", async () => {
    const { cookie } = await registerCompany("Acme", "rrhh@acme.com");
    const added = await call("/api/empresas/members", withCookie(json({ handle: "nadie" }), cookie));
    expect(added.status).toBe(422);
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
