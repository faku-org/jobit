import { describe, expect, test } from "bun:test";
import { EMPTY_PROFILE } from "./profile.ts";
import { type BoardContext, jobsQuery } from "./query.ts";
import { toRanking } from "./ranking.ts";
import { EMPTY_FILTERS, EMPTY_PREFERENCES, STATE_SOURCE } from "./types.ts";

const context = (overrides: Partial<BoardContext> = {}): BoardContext => ({
  filters: EMPTY_FILTERS,
  preferences: EMPTY_PREFERENCES,
  ranking: toRanking(EMPTY_PREFERENCES, EMPTY_PROFILE),
  savedIds: [],
  discardedIds: [],
  sources: [],
  similarOnly: false,
  reviewing: false,
  ...overrides,
});

const wanting = { ...EMPTY_PREFERENCES, categories: ["tecnologia"] };

describe("jobsQuery", () => {
  test("el orden por calce sale del perfil y de lo que se quiere", () => {
    const query = jobsQuery(
      "all",
      context({ preferences: wanting, ranking: toRanking(wanting, EMPTY_PROFILE) }),
    );

    expect(query.sort).toBe("match");
    expect(query.ranking?.categories).toEqual(["tecnologia"]);
  });

  test("sin nada cargado no hay con qué ordenar", () => {
    expect(jobsQuery("all", context()).sort).toBeUndefined();
  });

  test("Estado va a su fuente y corre contra la fecha de cierre", () => {
    const query = jobsQuery(
      "state",
      context({
        preferences: wanting,
        ranking: toRanking(wanting, EMPTY_PROFILE),
        sources: ["gallito"],
      }),
    );

    expect(query.sources).toEqual([STATE_SOURCE]);
    expect(query.sort).toBe("closing");
    expect(query.ranking).toBeUndefined();
  });

  test("guardadas es la lista de la persona, sin recortes ni puntaje", () => {
    const query = jobsQuery(
      "saved",
      context({
        filters: { ...EMPTY_FILTERS, category: "ventas" },
        preferences: { ...wanting, hiddenCategories: ["salud"] },
        savedIds: ["a", "b"],
      }),
    );

    expect(query.ids).toEqual(["a", "b"]);
    expect(query.filters.category).toBe("");
    expect(query.hiddenCategories).toBeUndefined();
    expect(query.sort).toBeUndefined();
  });

  test("una lista de guardadas vacía pide lo que no existe, no todo", () => {
    expect(jobsQuery("saved", context()).ids).toEqual(["none"]);
  });

  test("la pila de descartadas se mira solo desde Ofertas", () => {
    const reviewing = context({ discardedIds: ["x"], reviewing: true, sources: ["gallito"] });

    expect(jobsQuery("all", reviewing).ids).toEqual(["x"]);
    /** Y sin fuente, porque una descartada puede venir de cualquier portal. */
    expect(jobsQuery("all", reviewing).sources).toBeUndefined();
    expect(jobsQuery("saved", reviewing).ids).toEqual(["none"]);
    expect(jobsQuery("state", reviewing).ids).toBeUndefined();
  });

  test("dos vistas con lo mismo piden lo mismo, que es lo que comparte la caché", () => {
    expect(jobsQuery("all", context())).toEqual(jobsQuery("tracking", context()));
  });
});
