import { afterEach, describe, expect, test } from "bun:test";
import { createReview, fetchReviews, pluralReviews, reportReview, replyReview } from "./reviews.ts";

/** Lo que se le pidió a la API en la última llamada. */
interface Call {
  url: string;
  init: RequestInit | undefined;
}

const real = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = real;
});

function stub(status = 200, body: unknown = {}): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = ((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
  }) as unknown as typeof fetch;
  return calls;
}

describe("pluralReviews", () => {
  test("sin votos lo dice con palabras y no con un cero", () => {
    expect(pluralReviews(0)).toBe("Todavía sin calificaciones");
    expect(pluralReviews(1)).toBe("1 opinión");
    expect(pluralReviews(4)).toBe("4 opiniones");
  });
});

describe("lo que se le pide a la API", () => {
  test("leer va sin método y el slug entra escapado", async () => {
    const calls = stub(200, { reviews: [], summary: { average: 0, count: 0 } });
    await fetchReviews("plomería a domicilio");

    expect(calls[0]?.url).toBe("/api/services/plomer%C3%ADa%20a%20domicilio/reviews");
    expect(calls[0]?.init?.method).toBeUndefined();
  });

  test("calificar manda la nota con la cookie de la cuenta", async () => {
    const calls = stub(201, { id: "1" });
    await createReview("electricista", { rating: 4, comment: "Puntual." });

    expect(calls[0]?.url).toBe("/api/services/electricista/reviews");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.credentials).toBe("same-origin");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ rating: 4, comment: "Puntual." });
  });

  test("responder y denunciar van por el id de la calificación", async () => {
    const calls = stub(200, { id: "abc" });
    await replyReview("abc", "Mi versión.");
    await reportReview("abc", "spam");

    expect(calls[0]?.url).toBe("/api/reviews/abc/reply");
    expect(calls[1]?.url).toBe("/api/reviews/abc/report");
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({ reason: "spam" });
  });

  test("el error de la API se muestra tal como lo dijo", async () => {
    stub(422, { error: "ya calificaste este servicio" });

    expect(createReview("electricista", { rating: 5 })).rejects.toThrow(
      "ya calificaste este servicio",
    );
  });
});
