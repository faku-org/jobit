import { beforeEach, describe, expect, test } from "bun:test";

process.env.DB_FILE = ":memory:";
process.env.ADMIN_INSECURE_COOKIES = "true";

const { closeDb } = await import("./db.ts");
const { resetLimits } = await import("./limit.ts");
const users = await import("./users.ts");
const services = await import("./services.ts");
const queue = await import("./queue.ts");
const { app } = await import("./index.ts");

/** Las cuentas se hacen con fecha vieja: calificar pide antigüedad. */
const VIEJA = new Date("2026-01-01T09:00:00Z");

let slug = "";
let ownerCookie = "";
let clientCookie = "";

const call = (path: string, init: RequestInit = {}): Promise<Response> =>
  app.handle(new Request(`http://localhost${path}`, init));

const send = (method: string, body?: unknown, cookie?: string): RequestInit => ({
  method,
  headers: {
    "content-type": "application/json",
    ...(cookie ? { cookie } : {}),
  },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const cookieOf = (response: Response): string =>
  (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

/** Una cuenta con antigüedad, entrando por la puerta de siempre. */
async function entrar(handle: string): Promise<{ id: string; cookie: string }> {
  const created = await users.createUser(
    { handle, display_name: handle, password: "una clave larga" },
    VIEJA,
  );
  if (!created.ok) throw new Error(created.error);

  const login = await call(
    "/api/auth/login",
    send("POST", { handle, password: "una clave larga" }),
  );
  return { id: created.value.user.id, cookie: cookieOf(login) };
}

interface ReviewBody {
  id: string;
  rating: number;
  comment: string;
  reply: string;
  edited: boolean;
  author_handle: string;
}

interface ReviewsBody {
  reviews: ReviewBody[];
  summary: { average: number; count: number };
  mine: ReviewBody | null;
  can_review: boolean | null;
  is_owner: boolean;
}

const read = async (cookie?: string): Promise<ReviewsBody> =>
  (await (
    await call(`/api/services/${slug}/reviews`, cookie ? { headers: { cookie } } : {})
  ).json()) as ReviewsBody;

beforeEach(async () => {
  closeDb();
  resetLimits();
  process.env.USER_SECRET_KEY = "una clave de prueba, larga y sin gracia";

  const owner = await entrar("juana");
  ownerCookie = owner.cookie;
  clientCookie = (await entrar("pedro")).cookie;

  const created = services.create(
    owner.id,
    {
      title: "Electricista a domicilio",
      summary: "Tableros, tomas y luces",
      description: "Instalaciones en casas y locales.",
      category: "oficios",
    },
    VIEJA,
  );
  if (!created.ok) throw new Error(created.error);

  queue.decide(created.value.id, "approved", "admin", VIEJA);
  slug = created.value.slug;
});

describe("leer", () => {
  test("la ficha sin votos dice cero y no inventa un promedio", async () => {
    const body = await read();
    expect(body.reviews).toHaveLength(0);
    expect(body.summary).toEqual({ average: 0, count: 0 });
    /** Sin sesión no se sabe si puede calificar: la ficha muestra el botón de
     * entrar y no un formulario que va a rebotar. */
    expect(body.can_review).toBeNull();
  });

  test("el servicio que no existe contesta 404", async () => {
    const response = await call("/api/services/no-existe/reviews");
    expect(response.status).toBe(404);
  });

  test("lo que sale no lleva el id de la cuenta", async () => {
    await call(`/api/services/${slug}/reviews`, send("POST", { rating: 5 }, clientCookie));

    const body = await read();
    expect(body.reviews[0]).not.toHaveProperty("author_user_id");
    expect(body.reviews[0]?.author_handle).toBe("pedro");
  });
});

describe("calificar", () => {
  test("sin sesión no se califica", async () => {
    const response = await call(`/api/services/${slug}/reviews`, send("POST", { rating: 5 }));
    expect(response.status).toBe(401);
  });

  test("con sesión entra y queda en la ficha con el conteo al lado", async () => {
    const response = await call(
      `/api/services/${slug}/reviews`,
      send("POST", { rating: 4, comment: "Puntual." }, clientCookie),
    );
    expect(response.status).toBe(201);

    const body = await read(clientCookie);
    expect(body.summary).toEqual({ average: 4, count: 1 });
    expect(body.mine?.comment).toBe("Puntual.");
    expect(body.can_review).toBe(true);
  });

  test("quien publica no se califica y la ficha lo sabe de antemano", async () => {
    const response = await call(
      `/api/services/${slug}/reviews`,
      send("POST", { rating: 5 }, ownerCookie),
    );
    expect(response.status).toBe(422);

    const body = await read(ownerCookie);
    expect(body.can_review).toBe(false);
    expect(body.is_owner).toBe(true);
  });

  test("la nota fuera de escala la para el esquema", async () => {
    const response = await call(
      `/api/services/${slug}/reviews`,
      send("POST", { rating: 9 }, clientCookie),
    );
    expect(response.status).toBe(422);
  });
});

describe("corregir y borrar", () => {
  const crear = async (): Promise<string> => {
    const response = await call(
      `/api/services/${slug}/reviews`,
      send("POST", { rating: 2, comment: "Llegó tarde." }, clientCookie),
    );
    return ((await response.json()) as ReviewBody).id;
  };

  test("una corrección sí, la segunda no", async () => {
    const id = await crear();

    const first = await call(`/api/reviews/${id}`, send("PATCH", { rating: 4 }, clientCookie));
    expect(first.status).toBe(200);
    expect(((await first.json()) as ReviewBody).edited).toBe(true);

    const second = await call(`/api/reviews/${id}`, send("PATCH", { rating: 5 }, clientCookie));
    expect(second.status).toBe(422);
  });

  test("la de otra persona no existe para quien no la escribió", async () => {
    const id = await crear();
    const response = await call(`/api/reviews/${id}`, send("PATCH", { rating: 5 }, ownerCookie));
    expect(response.status).toBe(404);
  });

  test("borrar la propia deja el servicio sin calificaciones", async () => {
    const id = await crear();
    expect((await call(`/api/reviews/${id}`, send("DELETE", undefined, clientCookie))).status).toBe(
      200,
    );
    expect((await read()).summary).toEqual({ average: 0, count: 0 });
  });
});

describe("responder", () => {
  test("quien publica responde una vez y nadie más responde", async () => {
    const id = (
      (await (
        await call(`/api/services/${slug}/reviews`, send("POST", { rating: 2 }, clientCookie))
      ).json()) as ReviewBody
    ).id;

    const ajena = await call(
      `/api/reviews/${id}/reply`,
      send("POST", { text: "Yo opino otra cosa." }, clientCookie),
    );
    expect(ajena.status).toBe(404);

    const mine = await call(
      `/api/reviews/${id}/reply`,
      send("POST", { text: "Se me pinchó una goma." }, ownerCookie),
    );
    expect(mine.status).toBe(200);
    expect(((await mine.json()) as ReviewBody).reply).toContain("goma");

    const again = await call(
      `/api/reviews/${id}/reply`,
      send("POST", { text: "Y otra cosa más." }, ownerCookie),
    );
    expect(again.status).toBe(422);
  });
});

describe("denunciar", () => {
  test("no pide cuenta y deja la calificación esperando que alguien la mire", async () => {
    const id = (
      (await (
        await call(`/api/services/${slug}/reviews`, send("POST", { rating: 1 }, clientCookie))
      ).json()) as ReviewBody
    ).id;

    const response = await call(`/api/reviews/${id}/report`, send("POST", { reason: "enganoso" }));
    expect(response.status).toBe(200);
    expect(queue.counts().reported_reviews).toBe(1);
  });

  test("el motivo sale de una lista corta", async () => {
    const id = (
      (await (
        await call(`/api/services/${slug}/reviews`, send("POST", { rating: 1 }, clientCookie))
      ).json()) as ReviewBody
    ).id;

    const response = await call(
      `/api/reviews/${id}/report`,
      send("POST", { reason: "no me gusta" }),
    );
    expect(response.status).toBe(422);
  });

  test("la que no existe contesta 404", async () => {
    const response = await call("/api/reviews/no-existe/report", send("POST", { reason: "spam" }));
    expect(response.status).toBe(404);
  });
});
