import { beforeEach, describe, expect, test } from "bun:test";

process.env.DB_FILE = ":memory:";

const { closeDb, db } = await import("./db.ts");
const users = await import("./users.ts");
const services = await import("./services.ts");

let userId = "";

beforeEach(async () => {
  closeDb();
  process.env.USER_SECRET_KEY = "una clave de prueba, larga y sin gracia";

  const created = await users.createUser({
    handle: "juana",
    display_name: "Juana Pérez",
    password: "una clave larga",
  });
  if (!created.ok) throw new Error(created.error);
  userId = created.value.user.id;
});

const BASE = {
  title: "Instalaciones eléctricas",
  summary: "Tableros, tomas y luces",
  description: "Trabajo en casas y locales.",
  category: "oficios",
  department: "Canelones",
  remote: "onsite",
  work_style: "individual",
  response_time: "48-horas",
};

const crear = (extra: Record<string, unknown> = {}) =>
  services.create(userId, { ...BASE, ...extra } as Parameters<typeof services.create>[1]);

describe("crear", () => {
  test("guarda lo que se publicó y arranca en borrador", () => {
    const created = crear();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.value.title).toBe("Instalaciones eléctricas");
    expect(created.value.slug).toBe("instalaciones-electricas");
    expect(created.value.status).toBe("draft");
    expect(created.value.published_at).toBe("");
    expect(created.value.owner_handle).toBe("juana");
  });

  test("se puede mandar a la cola directo", () => {
    const created = crear({ status: "pending" });
    expect(created.ok && created.value.status).toBe("pending");
  });

  test("publicar no lo decide quien publica", () => {
    const created = crear({ status: "published" });
    /** Lo que no es draft ni pending se cae a draft en vez de rechazar. */
    expect(created.ok && created.value.status).toBe("draft");
  });

  test("sin título no hay servicio", () => {
    expect(crear({ title: "   " }).ok).toBe(false);
  });

  test("dos títulos iguales no comparten slug", () => {
    crear();
    const segundo = crear();
    expect(segundo.ok && segundo.value.slug).toBe("instalaciones-electricas-2");
  });

  test("un rubro que no existe cae en otros", () => {
    const created = crear({ category: "brujeria" });
    expect(created.ok && created.value.category).toBe("otros");
  });

  test("un departamento que no existe se rechaza en vez de inventarse", () => {
    const created = crear({ department: "Tierra del Fuego" });
    expect(created.ok).toBe(false);
  });

  test("el departamento se guarda con su nombre canónico", () => {
    const created = crear({ department: "  san jose " });
    expect(created.ok && created.value.department).toBe("San José");
  });

  test("el HTML de la descripción no sobrevive", () => {
    const created = crear({
      description: "<p>Hola</p><script>alert(1)</script><br>Chau",
    });
    if (!created.ok) throw new Error(created.error);

    expect(created.value.description).not.toContain("<");
    expect(created.value.description).toContain("Hola");
  });

  test("hay un tope por cuenta", () => {
    for (let n = 0; n < services.MAX_SERVICES_PER_USER; n++) {
      expect(crear({ title: `Servicio ${n}` }).ok).toBe(true);
    }
    expect(crear({ title: "Uno más" }).ok).toBe(false);
  });
});

describe("habilidades", () => {
  test("guardan el orden, que es la prioridad de quien publica", () => {
    const created = crear({ skills: ["Tableros", "Domótica", "Luminarias"] });
    expect(created.ok && created.value.skills).toEqual(["Tableros", "Domótica", "Luminarias"]);
  });

  test("no se repiten aunque cambien las mayúsculas", () => {
    const created = crear({ skills: ["Tableros", "tableros", "  "] });
    expect(created.ok && created.value.skills).toEqual(["Tableros"]);
  });
});

describe("precios", () => {
  test("se guardan en la moneda que se publicó, sin convertir", () => {
    const created = crear({
      prices: [
        { kind: "base", label: "Hora", amount: 1200, currency: "UYU", unit: "hora" },
        { kind: "extra", label: "Salida fuera de Montevideo", amount: 30, currency: "USD" },
      ],
    });
    if (!created.ok) throw new Error(created.error);

    expect(created.value.prices).toHaveLength(2);
    expect(created.value.prices[0]).toMatchObject({ amount: 1200, currency: "UYU", unit: "hora" });
    expect(created.value.prices[1]).toMatchObject({ kind: "extra", amount: 30, currency: "USD" });
  });

  test("una moneda que no es UYU ni USD no entra", () => {
    expect(crear({ prices: [{ amount: 100, currency: "EUR" }] }).ok).toBe(false);
  });

  test("un monto que no es un número mayor que cero tampoco", () => {
    expect(crear({ prices: [{ amount: 0, currency: "UYU" }] }).ok).toBe(false);
    expect(crear({ prices: [{ amount: -5, currency: "UYU" }] }).ok).toBe(false);
  });

  test("los extras son filas del mismo lugar", () => {
    const created = crear({ prices: [{ kind: "extra", amount: 500, currency: "UYU" }] });
    if (!created.ok) throw new Error(created.error);

    const row = db().query<{ kind: string }, []>("SELECT kind FROM service_prices").get();
    expect(row?.kind).toBe("extra");
  });
});

describe("horarios", () => {
  test("se guardan por día y hora", () => {
    const created = crear({
      hours: [
        { weekday: 1, from: "09:00", to: "13:00" },
        { weekday: 1, from: "15:00", to: "19:00" },
      ],
    });
    expect(created.ok && created.value.hours).toHaveLength(2);
  });

  test("una hora que no es HH:MM no entra", () => {
    expect(crear({ hours: [{ weekday: 1, from: "9", to: "13:00" }] }).ok).toBe(false);
    expect(crear({ hours: [{ weekday: 1, from: "25:00", to: "26:00" }] }).ok).toBe(false);
  });

  test("el fin va después del inicio", () => {
    expect(crear({ hours: [{ weekday: 1, from: "19:00", to: "09:00" }] }).ok).toBe(false);
  });

  test("un día fuera de 0 a 6 tampoco", () => {
    expect(crear({ hours: [{ weekday: 9, from: "09:00", to: "13:00" }] }).ok).toBe(false);
  });
});

describe("editar", () => {
  test("solo el dueño", async () => {
    const created = crear();
    if (!created.ok) throw new Error(created.error);

    const otro = await users.createUser({
      handle: "pedro",
      display_name: "Pedro",
      password: "otra clave larga",
    });
    if (!otro.ok) throw new Error(otro.error);

    const updated = services.update(created.value.id, otro.value.user.id, { title: "Mío ahora" });
    expect(updated.ok).toBe(false);
    expect(services.byId(created.value.id)?.title).toBe("Instalaciones eléctricas");
  });

  test("el slug sigue al título", () => {
    const created = crear();
    if (!created.ok) throw new Error(created.error);

    const updated = services.update(created.value.id, userId, {
      title: "Electricista a domicilio",
    });
    expect(updated.ok && updated.value.slug).toBe("electricista-a-domicilio");
  });

  test("lo que no se manda no se pisa", () => {
    const created = crear({ skills: ["Tableros"] });
    if (!created.ok) throw new Error(created.error);

    const updated = services.update(created.value.id, userId, { summary: "Otro resumen" });
    if (!updated.ok) throw new Error(updated.error);

    expect(updated.value.skills).toEqual(["Tableros"]);
    expect(updated.value.description).toBe("Trabajo en casas y locales.");
  });

  test("editar lo publicado lo manda de vuelta a la cola", () => {
    const created = crear({ status: "pending" });
    if (!created.ok) throw new Error(created.error);

    services.setStatus(created.value.id, "published");
    const updated = services.update(created.value.id, userId, { summary: "Cambió el resumen" });
    expect(updated.ok && updated.value.status).toBe("pending");
  });

  test("lo suspendido no se despublica solo editándolo", () => {
    const created = crear();
    if (!created.ok) throw new Error(created.error);

    services.setStatus(created.value.id, "suspended");
    const updated = services.update(created.value.id, userId, { status: "pending" });
    expect(updated.ok && updated.value.status).toBe("suspended");
  });
});

describe("publicar y borrar", () => {
  test("publicar deja la fecha del alta y no la vuelve a tocar", () => {
    const created = crear();
    if (!created.ok) throw new Error(created.error);

    services.setStatus(created.value.id, "published", new Date("2026-03-01T10:00:00.000Z"));
    expect(services.byId(created.value.id)?.published_at).toBe("2026-03-01");

    services.setStatus(created.value.id, "suspended", new Date("2026-03-05T10:00:00.000Z"));
    services.setStatus(created.value.id, "published", new Date("2026-03-09T10:00:00.000Z"));
    expect(services.byId(created.value.id)?.published_at).toBe("2026-03-01");
  });

  test("borrar lo propio se lleva habilidades, precios y horarios", () => {
    const created = crear({
      skills: ["Tableros"],
      prices: [{ amount: 1200, currency: "UYU" }],
      hours: [{ weekday: 1, from: "09:00", to: "13:00" }],
    });
    if (!created.ok) throw new Error(created.error);

    expect(services.remove(created.value.id, userId)).toBe(true);
    expect(services.byId(created.value.id)).toBeNull();

    for (const table of ["service_skills", "service_prices", "service_hours"]) {
      const row = db().query<{ n: number }, []>(`SELECT COUNT(*) AS n FROM ${table}`).get();
      expect(row?.n).toBe(0);
    }
  });

  test("lo de otra persona no se borra", async () => {
    const created = crear();
    if (!created.ok) throw new Error(created.error);

    const otro = await users.createUser({
      handle: "pedro",
      display_name: "Pedro",
      password: "otra clave larga",
    });
    if (!otro.ok) throw new Error(otro.error);

    expect(services.remove(created.value.id, otro.value.user.id)).toBe(false);
    expect(services.byId(created.value.id)).not.toBeNull();
  });

  test("borrar la cuenta se lleva sus servicios", () => {
    const created = crear();
    if (!created.ok) throw new Error(created.error);

    users.removeUser(userId);
    expect(services.byId(created.value.id)).toBeNull();
  });
});

describe("listar", () => {
  test("lo de cada cuenta, y el conteo por estado", () => {
    crear({ title: "Uno", status: "pending" });
    crear({ title: "Dos" });

    expect(services.list({ user_id: userId })).toHaveLength(2);
    expect(services.list({ user_id: userId, status: "pending" })).toHaveLength(1);
    expect(services.counts()).toMatchObject({ draft: 1, pending: 1, published: 0 });
    expect(services.countByUser(userId)).toBe(2);
  });

  test("bySlug encuentra la ficha", () => {
    crear();
    expect(services.bySlug("instalaciones-electricas")?.title).toBe("Instalaciones eléctricas");
    expect(services.bySlug("no-existe")).toBeNull();
  });
});
