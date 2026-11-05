import { beforeEach, describe, expect, test } from "bun:test";

process.env.DB_FILE = ":memory:";

const { closeDb, db } = await import("./db.ts");
const users = await import("./users.ts");
const services = await import("./services.ts");
const queue = await import("./queue.ts");

let userId = "";

const LIMPIO = {
  title: "Electricista a domicilio",
  summary: "Instalaciones y arreglos",
  description:
    "Hago instalaciones eléctricas en casas y locales: tableros, tomas, luces y " +
    "cambios de instalación vieja. Trabajo en Canelones y Montevideo, con " +
    "presupuesto antes de empezar y garantía por escrito sobre lo que instalo.",
  category: "oficios",
  department: "Canelones",
  skills: ["Tableros", "Luminarias"],
  status: "pending",
};

beforeEach(async () => {
  closeDb();

  const created = await users.create({
    handle: "juana",
    display_name: "Juana Pérez",
    password: "una clave larga",
  });
  if (!created.ok) throw new Error(created.error);
  userId = created.value.user.id;
});

function crear(extra: Record<string, unknown> = {}): NonNullable<ReturnType<typeof services.byId>> {
  const created = services.create(userId, {
    ...LIMPIO,
    ...extra,
  } as Parameters<typeof services.create>[1]);
  if (!created.ok) throw new Error(created.error);
  return created.value;
}

describe("mandar a la cola", () => {
  test("lo limpio queda esperando, con el puntaje anotado", () => {
    const service = crear();
    const review = queue.submit(service);

    expect(review.score).toBe(0);
    expect(review.decision).toBe("queue");
    expect(services.byId(service.id)?.status).toBe("pending");
  });

  test("lo sucio espera igual, pero arriba", () => {
    crear({ title: "Uno" });
    const sucio = crear({
      title: "GANA PLATA YA",
      description: "ESCRIBIME AL 099 123 456 Y TE CUENTO",
      skills: [],
    });

    queue.submit(services.byId(sucio.id) ?? sucio);
    const cola = queue.pending();

    expect(cola[0]?.service.id).toBe(sucio.id);
    expect(cola[0]?.review?.score).toBeGreaterThan(0);
  });

  test("el mismo texto que ya se rechazó vuelve a borrador solo", () => {
    const primero = crear();
    queue.decide(primero.id, "rejected");

    const segundo = crear();
    queue.submit(segundo);

    expect(services.byId(segundo.id)?.status).toBe("draft");
    expect(queue.reviewOf(segundo.id)?.decision).toBe("rejected");
  });

  test("y queda en la cola igual, para que alguien pueda discutirlo", () => {
    const primero = crear();
    queue.decide(primero.id, "rejected");

    const segundo = crear();
    queue.submit(segundo);

    expect(queue.pending().some((item) => item.service.id === segundo.id)).toBe(true);
  });

  /** Parecido no es lo mismo: ahí decide una persona. */
  test("un texto apenas distinto se queda esperando", () => {
    const primero = crear();
    queue.decide(primero.id, "rejected");

    const segundo = crear({ title: "Electricista a domicilio en Canelones" });
    queue.submit(segundo);

    expect(services.byId(segundo.id)?.status).toBe("pending");
    expect(queue.reviewOf(segundo.id)?.score).toBeGreaterThan(0);
  });

  test("parecerse a uno mismo no cuenta", () => {
    const service = crear();
    queue.remember(service, "published");

    const review = queue.submit(services.byId(service.id) ?? service);
    expect(review.reasons.map((reason) => reason.code)).not.toContain("copia");
  });
});

describe("decidir", () => {
  test("aprobar publica y deja la fecha", () => {
    const service = crear();
    queue.submit(service);

    expect(queue.decide(service.id, "approved", "admin", new Date("2026-04-01T10:00:00Z"))).toBe(
      true,
    );

    const published = services.byId(service.id);
    expect(published?.status).toBe("published");
    expect(published?.published_at).toBe("2026-04-01");
  });

  test("rechazar devuelve a borrador, para que se pueda arreglar", () => {
    const service = crear();
    queue.decide(service.id, "rejected");

    expect(services.byId(service.id)?.status).toBe("draft");
  });

  test("suspender baja y no devuelve", () => {
    const service = crear();
    queue.decide(service.id, "approved");
    queue.decide(service.id, "suspended");

    expect(services.byId(service.id)?.status).toBe("suspended");
  });

  test("queda anotado quién decidió y cuándo, con el día y no la hora", () => {
    const service = crear();
    queue.decide(service.id, "approved", "admin", new Date("2026-04-01T15:30:00Z"));

    const review = queue.reviewOf(service.id);
    expect(review?.decided_by).toBe("admin");
    expect(review?.decided_at).toBe("2026-04-01");
  });

  test("decidir sobre algo que no existe no rompe nada", () => {
    expect(queue.decide("no-existe", "approved")).toBe(false);
  });
});

describe("lo que se recuerda", () => {
  test("es el hash y la firma, nunca el texto", () => {
    const service = crear();
    queue.decide(service.id, "rejected");

    const row = db()
      .query<{ text_hash: string; signature: string; kind: string }, []>(
        "SELECT text_hash, signature, kind FROM moderation_prints",
      )
      .get();

    expect(row?.kind).toBe("rejected");
    expect(row?.text_hash).toHaveLength(64);
    expect(row?.signature).not.toContain("electricista");
    expect(JSON.stringify(row)).not.toContain("tableros");
  });
});

describe("denuncias", () => {
  test("suben el servicio a la cola sin decir quién denunció", () => {
    const service = crear();
    queue.decide(service.id, "approved");

    expect(queue.report(service.id, "spam")).toBe(true);
    expect(queue.counts().reported).toBe(1);

    const item = queue.pending().find((entry) => entry.service.id === service.id);
    expect(item?.reports).toBe(1);

    const row = db().query<Record<string, unknown>, []>("SELECT * FROM service_reports").get();
    expect(Object.keys(row ?? {})).toEqual(["service_id", "reason", "created_at", "handled"]);
  });

  test("lo denunciado va antes que lo que solo tiene puntaje", () => {
    const sucio = crear({ title: "GANA PLATA YA", description: "ESCRIBIME", skills: [] });
    queue.submit(sucio);

    const denunciado = crear({ title: "Clases de guitarra" });
    queue.decide(denunciado.id, "approved");
    queue.report(denunciado.id, "enganoso");

    expect(queue.pending()[0]?.service.id).toBe(denunciado.id);
  });

  test("decidir da la denuncia por atendida", () => {
    const service = crear();
    queue.decide(service.id, "approved");
    queue.report(service.id, "spam");

    queue.decide(service.id, "suspended");
    expect(queue.counts().reported).toBe(0);
  });

  test("no se denuncia lo que no existe", () => {
    expect(queue.report("no-existe", "spam")).toBe(false);
  });
});
