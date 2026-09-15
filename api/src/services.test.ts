import { beforeEach, describe, expect, test } from "bun:test";
/** Solo el tipo: un import de tipos se borra al compilar y no adelanta la
 * carga del módulo, que tiene que pasar después de fijar DB_FILE. */
import type { ServiceInput } from "./services.ts";

process.env.DB_FILE = ":memory:";
process.env.ACCOUNT_KEY = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
  "base64",
);

const { closeDb, db } = await import("./db.ts");
const services = await import("./services.ts");
const users = await import("./users.ts");

let id = "";
let otro = "";

/** Lo mínimo que services.ts acepta para mandar algo a la cola. */
const completo = (overrides: Partial<ServiceInput> = {}): ServiceInput => ({
  title: "Programador FullStack",
  summary: "Aplicaciones web a medida, de la base de datos a la pantalla.",
  description: "Trabajo con Bun, TypeScript y React.",
  category: "tecnologia",
  department: "Montevideo",
  remote: true,
  contact_kind: "whatsapp",
  contact_value: "099 123 456",
  prices: [{ amount: 1500, currency: "UYU", unit: "hora" }],
  status: "pending",
  ...overrides,
});

beforeEach(async () => {
  closeDb();

  const uno = await users.register({
    handle: "faku",
    display_name: "Facundo",
    password: "una clave larga",
  });
  const dos = await users.register({
    handle: "ajeno",
    display_name: "Ajeno",
    password: "otra clave larga",
  });
  id = uno.ok ? uno.value.user.id : "";
  otro = dos.ok ? dos.value.user.id : "";
});

describe("crear", () => {
  test("un borrador puede estar a medio llenar", () => {
    const created = services.create(id, { title: "Electricista" });
    expect(created.ok).toBe(true);
    expect(created.ok && created.value.status).toBe("draft");
    expect(created.ok && created.value.owner_handle).toBe("faku");
  });

  test("sin título no hay servicio", () => {
    expect(services.create(id, { title: "   " }).ok).toBe(false);
  });

  test("lo que va a la cola sí tiene que estar completo", () => {
    expect(services.create(id, completo({ prices: [] })).ok).toBe(false);
    expect(services.create(id, completo({ contact_kind: "", contact_value: "" })).ok).toBe(false);
    expect(services.create(id, completo({ summary: "corto" })).ok).toBe(false);
  });

  test("nadie se publica solo: lo más que puede pedir es la cola", () => {
    const created = services.create(id, completo({ status: "published" }));
    /** El esquema de la ruta ya no deja mandarlo, y el modelo tampoco. */
    expect(created.ok && created.value.status).toBe("draft");
    expect(created.ok && created.value.published_at).toBe("");
  });

  test("el estado pedido es pending y ahí se queda", () => {
    const created = services.create(id, completo());
    expect(created.ok && created.value.status).toBe("pending");
    expect(created.ok && created.value.published_at).toBe("");
  });

  test("hay un tope por cuenta", () => {
    for (let n = 0; n < services.MAX_PER_USER; n++) {
      expect(services.create(id, { title: `Servicio ${n}` }).ok).toBe(true);
    }
    expect(services.create(id, { title: "Uno más" }).ok).toBe(false);
  });

  test("dos títulos iguales no comparten slug", () => {
    const uno = services.create(id, { title: "Electricista" });
    const dos = services.create(otro, { title: "Electricista" });
    expect(uno.ok && dos.ok && uno.value.slug).not.toBe(dos.ok ? dos.value.slug : "");
  });
});

describe("saneo", () => {
  test("un rubro que no existe cae en otros en vez de rechazar todo", () => {
    const created = services.create(id, { title: "Algo", category: "inventado" });
    expect(created.ok && created.value.category).toBe("otros");
  });

  test("las habilidades guardan el orden y no se repiten", () => {
    const created = services.create(id, {
      title: "Algo",
      skills: ["React", "Bun", "react", "  ", "TypeScript"],
    });
    expect(created.ok && created.value.skills).toEqual(["React", "Bun", "TypeScript"]);
  });

  test("el teléfono se guarda en dígitos", () => {
    const created = services.create(id, {
      title: "Algo",
      contact_kind: "whatsapp",
      contact_value: "099 123 456",
    });
    expect(created.ok && created.value.contact_value).toBe("099123456");
  });

  test("un javascript: no es un sitio de contacto", () => {
    const created = services.create(id, {
      title: "Algo",
      contact_kind: "web",
      // oxlint-disable-next-line no-script-url
      contact_value: "javascript:alert(1)",
    });
    expect(created.ok).toBe(false);
  });

  test("un precio de cero o negativo no es un precio", () => {
    expect(services.create(id, { title: "Algo", prices: [{ amount: 0 }] }).ok).toBe(false);
    expect(services.create(id, { title: "Algo", prices: [{ amount: -5 }] }).ok).toBe(false);
  });

  test("la moneda se guarda como se puso y no se convierte", () => {
    const created = services.create(id, {
      title: "Algo",
      prices: [
        { amount: 100, currency: "USD", unit: "hora" },
        { amount: 4000, currency: "UYU", kind: "extra", label: "Urgencia" },
      ],
    });
    expect(created.ok && created.value.prices[0]?.currency).toBe("USD");
    expect(created.ok && created.value.prices[0]?.amount).toBe(100);
    expect(created.ok && created.value.prices[1]?.kind).toBe("extra");
  });

  test("los horarios van en HH:MM y terminan después de empezar", () => {
    expect(
      services.create(id, {
        title: "Algo",
        hours: [{ weekday: 1, starts_at: "9:00", ends_at: "18:00" }],
      }).ok,
    ).toBe(false);
    expect(
      services.create(id, {
        title: "Algo",
        hours: [{ weekday: 1, starts_at: "18:00", ends_at: "09:00" }],
      }).ok,
    ).toBe(false);
    expect(
      services.create(id, {
        title: "Algo",
        hours: [{ weekday: 8, starts_at: "09:00", ends_at: "18:00" }],
      }).ok,
    ).toBe(false);

    const bueno = services.create(id, {
      title: "Algo",
      hours: [{ weekday: 1, starts_at: "09:00", ends_at: "18:00" }],
    });
    expect(bueno.ok && bueno.value.hours).toHaveLength(1);
  });

  test("los años de experiencia se acotan", () => {
    const created = services.create(id, { title: "Algo", experience_years: 400 });
    expect(created.ok && created.value.experience_years).toBe(60);
  });
});

describe("editar", () => {
  test("solo el dueño", () => {
    const created = services.create(id, { title: "Algo" });
    if (!created.ok) return;

    expect(services.update(created.value.id, otro, { title: "Robado" }).ok).toBe(false);
    expect(services.byId(created.value.id)?.title).toBe("Algo");
  });

  test("no hace falta mandar todo para cambiar una cosa", () => {
    const created = services.create(id, completo());
    if (!created.ok) return;

    const updated = services.update(created.value.id, id, { city: "Canelones" });
    expect(updated.ok && updated.value.city).toBe("Canelones");
    expect(updated.ok && updated.value.skills).toEqual(created.value.skills);
    expect(updated.ok && updated.value.prices).toEqual(created.value.prices);
  });

  test("editar el texto de algo publicado lo devuelve a la cola", () => {
    const created = services.create(id, completo());
    if (!created.ok) return;
    services.moderate(created.value.id, "published");

    const updated = services.update(created.value.id, id, { description: "Otra cosa" });
    expect(updated.ok && updated.value.status).toBe("pending");
  });

  test("cambiar el horario no lo baja de la lista", () => {
    const created = services.create(id, completo());
    if (!created.ok) return;
    services.moderate(created.value.id, "published");

    const updated = services.update(created.value.id, id, {
      hours: [{ weekday: 2, starts_at: "09:00", ends_at: "13:00" }],
    });
    expect(updated.ok && updated.value.status).toBe("published");
  });

  test("el dueño no se puede volver a publicar solo", () => {
    const created = services.create(id, completo());
    if (!created.ok) return;
    services.moderate(created.value.id, "suspended");

    const updated = services.update(created.value.id, id, { status: "pending" });
    /** Suspendido lo levanta la moderación, no quien lo escribió. */
    expect(updated.ok && updated.value.status).toBe("suspended");
  });
});

describe("borrar", () => {
  test("solo el dueño, y se lleva lo que cuelga", () => {
    const created = services.create(id, completo({ skills: ["Bun"] }));
    if (!created.ok) return;

    expect(services.remove(created.value.id, otro)).toBe(false);
    expect(services.remove(created.value.id, id)).toBe(true);
    expect(services.byId(created.value.id)).toBeNull();
    expect(db().query<{ n: number }, []>("SELECT COUNT(*) AS n FROM service_prices").get()?.n).toBe(
      0,
    );
    expect(db().query<{ n: number }, []>("SELECT COUNT(*) AS n FROM service_skills").get()?.n).toBe(
      0,
    );
  });

  test("borrar la cuenta se lleva los servicios", async () => {
    services.create(id, completo());
    await users.removeAccount(id, "una clave larga");
    expect(services.listByUser(id)).toHaveLength(0);
    expect(db().query<{ n: number }, []>("SELECT COUNT(*) AS n FROM services").get()?.n).toBe(0);
  });
});

describe("moderación", () => {
  test("publicar fija la fecha con la que entra a la lista", () => {
    const created = services.create(id, completo());
    if (!created.ok) return;

    const publicado = services.moderate(created.value.id, "published");
    expect(publicado.ok && publicado.value.published_at).not.toBe("");

    const fecha = publicado.ok ? publicado.value.published_at : "";
    services.moderate(created.value.id, "suspended");
    const otraVez = services.moderate(created.value.id, "published");
    /** Volver a publicar algo suspendido no lo sube de nuevo al tope. */
    expect(otraVez.ok && otraVez.value.published_at).toBe(fecha);
  });

  test("la cola por defecto es lo que está esperando", () => {
    services.create(id, completo());
    services.create(otro, { title: "Borrador ajeno" });
    expect(services.listByStatus("pending")).toHaveLength(1);
    expect(services.counts()).toEqual({ draft: 1, pending: 1, published: 0, suspended: 0 });
  });
});
