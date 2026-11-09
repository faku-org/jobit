import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const FILE = join(import.meta.dir, "../../data/test-service-events.jsonl");
process.env.DB_FILE = ":memory:";
process.env.EVENTS_FILE = FILE;
process.env.ADMIN_INSECURE_COOKIES = "true";

const { closeDb, db } = await import("./db.ts");
const { appendEvents } = await import("./events.ts");
const { bumpService, serviceMetrics } = await import("./metrics.ts");
const { resetLimits } = await import("./limit.ts");
const { app } = await import("./index.ts");
const services = await import("./services.ts");
const users = await import("./users.ts");

let ownerId = "";
let otherId = "";
let publishedId = "";
let draftId = "";

beforeEach(async () => {
  closeDb();
  resetLimits();

  const owner = await users.create({
    handle: "juana",
    display_name: "Juana Pérez",
    password: "una clave larga",
  });
  const other = await users.create({
    handle: "pedro",
    display_name: "Pedro Gómez",
    password: "una clave larga",
  });
  if (!owner.ok || !other.ok) throw new Error("no se pudo crear el usuario");
  ownerId = owner.value.user.id;
  otherId = other.value.user.id;

  const base = { title: "Instalaciones eléctricas", category: "oficios" };
  const published = services.create(ownerId, base as Parameters<typeof services.create>[1]);
  const draft = services.create(ownerId, {
    ...base,
    title: "Otro borrador",
  } as Parameters<typeof services.create>[1]);
  if (!published.ok || !draft.ok) throw new Error("no se pudo crear el servicio");
  publishedId = published.value.id;
  draftId = draft.value.id;
  services.setStatus(publishedId, "published");
});

afterEach(() => rmSync(FILE, { force: true }));

const rows = (): Record<string, unknown>[] =>
  readFileSync(FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

const view = (over: Record<string, unknown> = {}) => ({
  kind: "service_view" as const,
  id: publishedId,
  category: "oficios",
  ...over,
});

const contact = (over: Record<string, unknown> = {}) => ({
  kind: "service_contact" as const,
  id: publishedId,
  category: "oficios",
  channel: "whatsapp",
  ...over,
});

const search = (over: Record<string, unknown> = {}) => ({
  kind: "service_search" as const,
  category: "oficios",
  filters: ["q"],
  results: 3,
  ...over,
});

describe("service_search", () => {
  test("se recorta contra los vocabularios y guarda el día sin la hora", async () => {
    await appendEvents([
      search({ category: "juan perez 099123456", filters: ["q", "q", "password", "sort"] }),
    ]);

    const [row] = rows();
    expect(row?.kind).toBe("service_search");
    expect(row?.category).toBe("");
    expect(row?.filters).toEqual(["q", "sort"]);
    expect(row?.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(JSON.stringify(row)).not.toContain("T");
  });

  test("ninguna fila lleva usuario ni sesión", async () => {
    await appendEvents([search(), contact()]);

    for (const row of rows()) {
      expect(Object.keys(row).sort().join()).not.toMatch(/user|session|ip/);
    }
  });
});

describe("service_view y service_contact", () => {
  test("suman al contador del día y no escriben una fila por visita", async () => {
    expect(await appendEvents([view(), view(), contact()])).toBe(3);

    const [day] = db()
      .query<{ views: number; contacts: number }, [string]>(
        "SELECT views, contacts FROM service_daily WHERE service_id = ?",
      )
      .all(publishedId);
    expect(day).toEqual({ views: 2, contacts: 1 });

    /* Las vistas no dejan rastro en el archivo: solo el medio de contacto,
       sin id del servicio. */
    expect(rows().map((row) => row.kind)).toEqual(["service_contact"]);
  });

  test("el rubro sale de la fila del servicio, no de lo que mande el navegador", async () => {
    await appendEvents([contact({ category: "tecnologia" })]);
    expect(rows()[0]?.category).toBe("oficios");
  });

  test("el medio de contacto fuera del vocabulario entra como otro", async () => {
    await appendEvents([contact({ channel: "099123456" })]);
    expect(rows()[0]).not.toHaveProperty("id");
    expect(rows()[0]?.channel).toBe("otro");
  });

  test("un servicio en borrador o inexistente no cuenta", async () => {
    expect(await appendEvents([view({ id: draftId }), view({ id: "no-existe" })])).toBe(0);
    expect(await appendEvents([view({ id: "con espacios y /" })])).toBe(0);

    const total = db().query<{ n: number }, []>("SELECT COUNT(*) AS n FROM service_daily").get();
    expect(total?.n).toBe(0);
  });

  test("el contador no tiene columna de persona", () => {
    const columns = db()
      .query<{ name: string }, []>("PRAGMA table_info(service_daily)")
      .all()
      .map((column) => column.name);
    expect(columns).toEqual(["service_id", "day", "views", "contacts"]);
  });
});

describe("lo que ve quien publica", () => {
  test("cuenta vistas y contactos de la ventana, día por día", () => {
    const now = new Date("2026-09-10T12:00:00Z");
    bumpService(publishedId, "view", new Date("2026-09-05T08:00:00Z"));
    bumpService(publishedId, "view", now);
    bumpService(publishedId, "view", now);
    bumpService(publishedId, "contact", now);
    bumpService(publishedId, "view", new Date("2026-06-01T08:00:00Z"));

    const metrics = serviceMetrics(publishedId, ownerId, 7, now);
    expect(metrics?.views).toBe(3);
    expect(metrics?.contacts).toBe(1);
    expect(metrics?.daily).toEqual([
      { day: "2026-09-05", views: 1, contacts: 0 },
      { day: "2026-09-10", views: 2, contacts: 1 },
    ]);
  });

  test("el servicio de otra persona contesta lo mismo que uno que no existe", () => {
    expect(serviceMetrics(publishedId, otherId)).toBeNull();
    expect(serviceMetrics("no-existe", ownerId)).toBeNull();
  });

  test("el endpoint pide sesión y solo muestra lo propio", async () => {
    expect(
      (await app.handle(new Request(`http://localhost/api/services/mine/${publishedId}/metrics`)))
        .status,
    ).toBe(401);

    const login = await app.handle(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: "pedro", password: "una clave larga" }),
      }),
    );
    const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
    const response = await app.handle(
      new Request(`http://localhost/api/services/mine/${publishedId}/metrics`, {
        headers: { cookie },
      }),
    );
    expect(response.status).toBe(404);
  });
});
