import { beforeEach, describe, expect, test } from "bun:test";

process.env.DB_FILE = ":memory:";

const { closeDb, db } = await import("./db.ts");
const users = await import("./users.ts");
const services = await import("./services.ts");
const queue = await import("./queue.ts");
const reviews = await import("./reviews.ts");

/** El día de hoy para las pruebas, y una cuenta hecha hace bastante. */
const HOY = new Date("2026-03-10T15:00:00Z");
const VIEJA = new Date("2026-01-01T09:00:00Z");

let ownerId = "";
let clientId = "";
let serviceId = "";

/** Una cuenta con la antigüedad que se le pase: la regla mira el día. */
async function cuenta(handle: string, when: Date): Promise<string> {
  const created = await users.create(
    { handle, display_name: handle, password: "una clave larga" },
    when,
  );
  if (!created.ok) throw new Error(created.error);
  return created.value.user.id;
}

beforeEach(async () => {
  closeDb();

  ownerId = await cuenta("juana", VIEJA);
  clientId = await cuenta("pedro", VIEJA);

  const created = services.create(
    ownerId,
    {
      title: "Electricista a domicilio",
      summary: "Tableros, tomas y luces",
      description: "Instalaciones en casas y locales.",
      category: "oficios",
      department: "Canelones",
    },
    VIEJA,
  );
  if (!created.ok) throw new Error(created.error);

  queue.decide(created.value.id, "approved", "admin", VIEJA);
  serviceId = created.value.id;
});

const nota = (rating: number, comment = "", who = clientId, when = HOY) =>
  reviews.create(serviceId, who, { rating, comment }, when);

const ratingOf = (): { rating_avg: number; rating_count: number } =>
  db()
    .query<{ rating_avg: number; rating_count: number }, [string]>(
      "SELECT rating_avg, rating_count FROM services WHERE id = ?",
    )
    .get(serviceId) ?? { rating_avg: 0, rating_count: 0 };

describe("calificar", () => {
  test("guarda la nota, el comentario y el día", () => {
    const created = nota(4, "Puntual y prolijo.");
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.value.rating).toBe(4);
    expect(created.value.comment).toBe("Puntual y prolijo.");
    expect(created.value.author_handle).toBe("pedro");
    expect(created.value.status).toBe("visible");
    expect(created.value.edited).toBe(false);
    /** El día y no el momento: la hora exacta correlaciona personas. */
    expect(created.value.created_at).toBe("2026-03-10");
  });

  test("deja el promedio y el conteo escritos en el servicio", async () => {
    expect(nota(5).ok).toBe(true);

    const otro = await cuenta("sofia", VIEJA);
    expect(nota(4, "", otro).ok).toBe(true);

    expect(ratingOf()).toEqual({ rating_avg: 4.5, rating_count: 2 });
  });

  test("nadie califica un servicio propio", () => {
    const created = nota(5, "", ownerId);
    expect(created.ok).toBe(false);
    expect(created.ok === false && created.error).toContain("propio");
  });

  test("una cuenta recién hecha todavía no puede calificar", async () => {
    const nueva = await cuenta("recien", HOY);
    const created = nota(5, "", nueva);

    expect(created.ok).toBe(false);
    expect(created.ok === false && created.error).toContain("días");
  });

  test("un voto por persona y por servicio", () => {
    expect(nota(5).ok).toBe(true);

    const otra = nota(1, "Me arrepentí.");
    expect(otra.ok).toBe(false);
    expect(otra.ok === false && otra.error).toContain("ya calificaste");
    expect(ratingOf().rating_count).toBe(1);
  });

  test("lo que no está publicado no se califica", () => {
    services.setStatus(serviceId, "suspended", HOY);

    const created = nota(5);
    expect(created.ok).toBe(false);
    expect(created.ok === false && created.error).toContain("no existe");
  });

  test("la nota va de 1 a 5", () => {
    expect(nota(0).ok).toBe(false);
    expect(nota(6).ok).toBe(false);
    expect(nota(3).ok).toBe(true);
  });
});

describe("corregir", () => {
  test("se puede una vez y después no", () => {
    const created = nota(2, "Llegó tarde.");
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const fixed = reviews.update(created.value.id, clientId, { rating: 4, comment: "Lo arregló." });
    expect(fixed.ok).toBe(true);
    expect(fixed.ok && fixed.value.edited).toBe(true);
    expect(ratingOf().rating_avg).toBe(4);

    const again = reviews.update(created.value.id, clientId, { rating: 5 });
    expect(again.ok).toBe(false);
    expect(again.ok === false && again.error).toContain("una sola vez");
  });

  test("la de otra persona no se toca", async () => {
    const created = nota(2);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const ajena = reviews.update(created.value.id, await cuenta("ajeno", VIEJA), { rating: 5 });
    expect(ajena.ok).toBe(false);
    expect(ajena.ok === false && ajena.error).toBe("esa calificación no existe");
  });
});

describe("responder", () => {
  test("quien publica responde una sola vez", () => {
    const created = nota(2, "Llegó tarde.");
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const answered = reviews.reply(created.value.id, ownerId, "Se me pinchó una goma, perdón.");
    expect(answered.ok).toBe(true);
    expect(answered.ok && answered.value.reply).toContain("goma");

    const again = reviews.reply(created.value.id, ownerId, "Otra cosa más.");
    expect(again.ok).toBe(false);
    expect(again.ok === false && again.error).toContain("ya respondiste");
  });

  test("responder es del dueño del servicio y de nadie más", () => {
    const created = nota(2);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const ajena = reviews.reply(created.value.id, clientId, "Yo también opino.");
    expect(ajena.ok).toBe(false);
  });
});

describe("moderación", () => {
  test("bajar una calificación la saca del promedio", async () => {
    const uno = nota(1, "Spam.");
    const otro = await cuenta("sofia", VIEJA);
    expect(nota(5, "", otro).ok).toBe(true);
    expect(ratingOf()).toEqual({ rating_avg: 3, rating_count: 2 });

    expect(uno.ok).toBe(true);
    if (!uno.ok) return;

    expect(reviews.setStatus(uno.value.id, "hidden")).toBe(true);
    expect(ratingOf()).toEqual({ rating_avg: 5, rating_count: 1 });
    /** Bajada sigue estando para quien la escribió, que si no no entendería
     * por qué desapareció. */
    expect(reviews.mineFor(serviceId, clientId)?.status).toBe("hidden");
    expect(reviews.listFor(serviceId)).toHaveLength(1);
  });

  test("la denuncia va a la misma cola y se atiende una vez", () => {
    const created = nota(1, "Esto es mentira.");
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(queue.reportReview(created.value.id, "enganoso", HOY)).toBe(true);
    expect(queue.counts().reported_reviews).toBe(1);

    const item = queue.pending().find((entry) => entry.service.id === serviceId);
    expect(item?.reported_reviews).toHaveLength(1);
    expect(item?.service.status).toBe("published");

    expect(queue.decideReview(created.value.id, "hidden")).toBe(true);
    expect(queue.counts().reported_reviews).toBe(0);
    expect(ratingOf().rating_count).toBe(0);
  });

  test("la denuncia no guarda quién denunció", () => {
    const created = nota(1);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    queue.reportReview(created.value.id, "spam", HOY);

    const row = db()
      .query<Record<string, unknown>, []>("SELECT * FROM review_reports")
      .get() as Record<string, unknown>;
    expect(Object.keys(row).sort()).toEqual([
      "created_at",
      "handled",
      "reason",
      "review_id",
      "service_id",
    ]);
    expect(row.created_at).toBe("2026-03-10");
  });
});

describe("borrar", () => {
  test("borrar la propia recalcula el promedio", () => {
    const created = nota(5);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(reviews.remove(created.value.id, ownerId)).toBe(false);
    expect(reviews.remove(created.value.id, clientId)).toBe(true);
    expect(ratingOf()).toEqual({ rating_avg: 0, rating_count: 0 });
  });

  test("borrar la cuenta le saca el autor a la calificación pero la deja", () => {
    const created = nota(4, "Recomendable.");
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(users.remove(clientId)).toBe(true);

    const kept = reviews.byId(created.value.id);
    expect(kept?.author_user_id).toBeNull();
    expect(kept?.author_handle).toBe("");
    expect(kept?.comment).toBe("Recomendable.");
    /** El promedio no se movió: la nota es de un tercero y sigue valiendo. */
    expect(ratingOf()).toEqual({ rating_avg: 4, rating_count: 1 });
  });

  test("borrar el servicio se lleva sus calificaciones", () => {
    expect(nota(4).ok).toBe(true);
    expect(services.remove(serviceId, ownerId)).toBe(true);

    expect(
      db().query<{ n: number }, []>("SELECT COUNT(*) AS n FROM service_reviews").get()?.n,
    ).toBe(0);
  });
});

describe("lo público", () => {
  test("la vista pública no lleva el id de la cuenta", () => {
    const created = nota(5, "Muy bien.");
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const shown = reviews.publicView(created.value);
    expect(shown).not.toHaveProperty("author_user_id");
    expect(shown.author_handle).toBe("pedro");
  });
});
