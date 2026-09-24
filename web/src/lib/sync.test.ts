import { describe, expect, test } from "bun:test";
import { EMPTY_PROFILE, type Profile } from "./profile.ts";
import { type SyncedState, mergeSynced } from "./sync.ts";
import { type Application, EMPTY_PREFERENCES, type Preferences } from "./types.ts";

const profile = (over: Partial<Profile> = {}): Profile => ({ ...EMPTY_PROFILE, ...over });
const preferences = (over: Partial<Preferences> = {}): Preferences => ({
  ...EMPTY_PREFERENCES,
  ...over,
});

const base = (over: Partial<SyncedState> = {}): SyncedState => ({
  saved: [],
  dismissed: [],
  preferences: preferences(),
  applications: [],
  sources: [],
  feeds: [],
  profile: profile(),
  ...over,
});

const application = (over: Partial<Application> = {}): Application => ({
  id: "1",
  status: "applied",
  appliedAt: "",
  title: "Puesto",
  company: null,
  category: "",
  categoryLabel: "",
  source: "",
  applyUrl: "",
  ...over,
});

describe("mergeSynced", () => {
  test("lo guardado se une y nada queda guardado y descartado a la vez", () => {
    const merged = mergeSynced(
      base({ saved: ["a"], dismissed: ["b"] }),
      base({ saved: ["b"], dismissed: ["c"] }),
    );
    expect(merged.saved.sort()).toEqual(["a", "b"]);
    expect(merged.dismissed).toEqual(["c"]);
  });

  test("las preferencias se mezclan campo por campo", () => {
    const merged = mergeSynced(
      base({ preferences: preferences({ mix: "balanced" }) }),
      base({ preferences: preferences({ mix: "focused", categories: ["ventas"], modes: ["remote"] }) }),
    );
    expect(merged.preferences.mix).toBe("focused");
    expect(merged.preferences.categories).toEqual(["ventas"]);
    expect(merged.preferences.modes).toEqual(["remote"]);
  });

  test("una preferencia puesta en este navegador le gana a la de la cuenta", () => {
    const merged = mergeSynced(
      base({ preferences: preferences({ mix: "focused" }) }),
      base({ preferences: preferences({ mix: "broad" }) }),
    );
    expect(merged.preferences.mix).toBe("focused");
  });

  test("un rubro oculto saca al mismo rubro de los queridos", () => {
    const merged = mergeSynced(
      base({ preferences: preferences({ categories: ["ventas"] }) }),
      base({ preferences: preferences({ hiddenCategories: ["ventas"] }) }),
    );
    expect(merged.preferences.categories).toEqual([]);
    expect(merged.preferences.hiddenCategories).toEqual(["ventas"]);
  });

  test("el perfil se mezcla campo por campo y compartir queda apagado si alguno lo apagó", () => {
    const merged = mergeSynced(
      base({ profile: profile({ shareStats: false }) }),
      base({
        profile: profile({
          experienceYears: 5,
          education: "technical",
          onboardedAt: "2026-01-01T00:00:00.000Z",
        }),
      }),
    );
    expect(merged.profile.experienceYears).toBe(5);
    expect(merged.profile.education).toBe("technical");
    expect(merged.profile.onboardedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(merged.profile.shareStats).toBe(false);
  });

  test("las postulaciones se unen por id y la local manda", () => {
    const merged = mergeSynced(
      base({ applications: [application({ status: "interview" })] }),
      base({ applications: [application({ status: "closed" }), application({ id: "2" })] }),
    );
    expect(merged.applications.map((entry) => entry.id)).toEqual(["1", "2"]);
    expect(merged.applications[0]?.status).toBe("interview");
  });

  test("las fuentes propias se unen por id y la local manda", () => {
    const feed = (id: string, label: string) => ({
      id,
      url: `https://${id}.test/feed`,
      label,
      enabled: true,
    });
    const merged = mergeSynced(
      base({ feeds: [feed("uno", "local")] }),
      base({ feeds: [feed("uno", "remota"), feed("dos", "otra")] }),
    );
    expect(merged.feeds.map((item) => item.id)).toEqual(["uno", "dos"]);
    expect(merged.feeds[0]?.label).toBe("local");
  });
});
