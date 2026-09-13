import { beforeEach, describe, expect, test } from "bun:test";

process.env.DB_FILE = ":memory:";
process.env.ADMIN_INSECURE_COOKIES = "true";

const { closeDb } = await import("./db.ts");
const { resetLimits } = await import("./limit.ts");
const users = await import("./users.ts");
const services = await import("./services.ts");
const queue = await import("./queue.ts");
const { app } = await import("./index.ts");

let userId = "";

beforeEach(async () => {
  closeDb();
  resetLimits();
  process.env.USER_SECRET_KEY = "una clave de prueba, larga y sin gracia";
  process.env.USD_UYU = "40";

  const created = await users.createUser({
    handle: "juana",
    display_name: "Juana Pérez",
    password: "una clave larga",
  });
  if (!created.ok) throw new Error(created.error);
  userId = created.value.user.id;
});

const call = (path: string, init: RequestInit = {}): Promise<Response> =>
  app.handle(new Request(`http://localhost${path}`, init));

/** Crea y publica, que es lo único que la sección pública muestra. */
function publicar(extra: Record<string, unknown> = {}): string {
  const created = services.create(userId, {
    title: "Electricista a domicilio",
    summary: "Tableros, tomas y luces",
    description: "Instalaciones en casas y locales.",
    category: "oficios",
    department: "Canelones",
    remote: "onsite",
    skills: ["Tableros"],
    ...extra,
  } as Parameters<typeof services.create>[1]);
  if (!created.ok) throw new Error(created.error);

  queue.decide(created.value.id, "approved");
  return created.value.slug;
}

interface Page {
  total: number;
  services: { slug: string; title: string }[];
  price_sort: boolean;
  rate: { usd_uyu: number; approximate: boolean } | null;
}

const list = async (query = ""): Promise<Page> =>
  (await (await call(`/api/services${query}`)).json()) as Page;

describe("la lista", () => {
  test("solo muestra lo publicado", async () => {
    publicar();
    services.create(userId, {
      title: "Clases de guitarra",
    } as Parameters<typeof services.create>[1]);

    const page = await list();
    expect(page.total).toBe(1);
    expect(page.services[0]?.title).toBe("Electricista a domicilio");
  });

  test("lo suspendido se cae de la lista", async () => {
    const slug = publicar();
    const service = services.bySlug(slug);
    if (service) queue.decide(service.id, "suspended");

    expect((await list()).total).toBe(0);
  });

  test("busca en el título, el resumen y las habilidades", async () => {
    publicar();

    expect((await list("?q=electricista")).total).toBe(1);
    expect((await list("?q=tableros")).total).toBe(1);
    expect((await list("?q=veterinaria")).total).toBe(0);
  });

  test("filtra por rubro, departamento y modalidad", async () => {
    publicar();
    publicar({
      title: "Clases de inglés",
      category: "educacion",
      department: "Montevideo",
      remote: "remote",
    });

    expect((await list("?category=educacion")).total).toBe(1);
    expect((await list("?department=Canelones")).total).toBe(1);
    expect((await list("?remote=remote")).total).toBe(1);
  });

  test("pagina", async () => {
    publicar({ title: "Uno" });
    publicar({ title: "Dos" });
    publicar({ title: "Tres" });

    const page = await list("?limit=2");
    expect(page.total).toBe(3);
    expect(page.services).toHaveLength(2);
    expect((await list("?limit=2&offset=2")).services).toHaveLength(1);
  });
});

describe("el precio", () => {
  const conPrecio = (title: string, amount: number, currency: string) =>
    publicar({ title, prices: [{ kind: "base", amount, currency }] });

  test("ordena mezclando monedas con la tasa del día", async () => {
    conPrecio("Caro", 3000, "UYU");
    conPrecio("Barato", 20, "USD");

    const page = await list("?sort=price");
    expect(page.price_sort).toBe(true);
    expect(page.services.map((service) => service.title)).toEqual(["Barato", "Caro"]);
    expect(page.rate?.approximate).toBe(true);
  });

  test("sin tasa el orden por precio se apaga en vez de mentir", async () => {
    delete process.env.USD_UYU;
    conPrecio("Caro", 3000, "UYU");
    conPrecio("Barato", 20, "USD");

    const page = await list("?sort=price");
    expect(page.price_sort).toBe(false);
    expect(page.rate).toBeNull();
    /** Vuelve el orden por fecha: el último publicado primero. */
    expect(page.services[0]?.title).toBe("Barato");
  });

  test("los topes recortan la lista", async () => {
    conPrecio("Caro", 3000, "UYU");
    conPrecio("Barato", 500, "UYU");

    expect((await list("?price_max=1000")).total).toBe(1);
    expect((await list("?price_min=1000")).total).toBe(1);
  });

  test("un tope en dólares se compara con la tasa", async () => {
    conPrecio("En pesos", 2000, "UYU");

    /** 2000 pesos son 50 dólares a 40: entra bajo 60 y no bajo 40. */
    expect((await list("?currency=USD&price_max=60")).total).toBe(1);
    expect((await list("?currency=USD&price_max=40")).total).toBe(0);
  });

  test("sin tasa, un tope en dólares no recorta en vez de recortar mal", async () => {
    delete process.env.USD_UYU;
    conPrecio("En pesos", 2000, "UYU");

    const page = await list("?currency=USD&price_max=1");
    expect(page.total).toBe(1);
    expect(page.price_sort).toBe(false);
  });
});

describe("la ficha", () => {
  test("sale por slug, con todo lo que la ficha muestra", async () => {
    const slug = publicar({
      prices: [{ kind: "base", amount: 1200, currency: "UYU", unit: "hora" }],
      hours: [{ weekday: 1, from: "09:00", to: "18:00" }],
    });

    const response = await call(`/api/services/${slug}`);
    expect(response.status).toBe(200);

    const service = (await response.json()) as {
      skills: string[];
      prices: unknown[];
      hours: unknown[];
      owner_handle: string;
    };
    expect(service.skills).toEqual(["Tableros"]);
    expect(service.prices).toHaveLength(1);
    expect(service.hours).toHaveLength(1);
    expect(service.owner_handle).toBe("juana");
  });

  test("lo que no está publicado no existe", async () => {
    const created = services.create(userId, {
      title: "Borrador",
    } as Parameters<typeof services.create>[1]);
    if (!created.ok) throw new Error(created.error);

    expect((await call(`/api/services/${created.value.slug}`)).status).toBe(404);
  });

  test("la ficha no dice nada de quién publica que no haga falta", async () => {
    const slug = publicar();
    const service = (await (await call(`/api/services/${slug}`)).json()) as Record<string, unknown>;

    expect(JSON.stringify(service)).not.toContain("password");
    expect(service).not.toHaveProperty("email_enc");
    /** Ni el id de la cuenta: quién publica viaja como handle y nombre. */
    expect(service).not.toHaveProperty("user_id");
    expect(service.owner_name).toBe("Juana Pérez");
  });
});

describe("las facetas", () => {
  test("cuentan lo publicado y nada más", async () => {
    publicar();
    publicar({ title: "Clases de inglés", category: "educacion", department: "Montevideo" });
    services.create(userId, {
      title: "Borrador",
      category: "salud",
    } as Parameters<typeof services.create>[1]);

    const meta = (await (await call("/api/services/meta")).json()) as {
      count: number;
      categories: { value: string; count: number }[];
      departments: { value: string; count: number }[];
    };

    expect(meta.count).toBe(2);
    expect(meta.categories.map((facet) => facet.value).sort()).toEqual(["educacion", "oficios"]);
    expect(meta.departments).toHaveLength(2);
  });
});

describe("las rutas no se pisan", () => {
  test("/api/services/mine sigue siendo la de quien publica", async () => {
    publicar({ title: "mine" });

    /** Sin sesión contesta 401 y no la ficha de un servicio que se llame así. */
    expect((await call("/api/services/mine")).status).toBe(401);
  });
});
