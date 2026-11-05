import { describe, expect, test } from "bun:test";
import { parseSearch, withoutToken } from "./search.ts";

describe("parseSearch", () => {
  test("el texto suelto queda igual y no produce atajos", () => {
    const parsed = parseSearch("soporte técnico");
    expect(parsed.text).toBe("soporte técnico");
    expect(parsed.filters).toEqual({});
    expect(parsed.tokens).toEqual([]);
  });

  test("@empresa filtra por la empresa y sale del texto", () => {
    const parsed = parseSearch("@urudata soporte");
    expect(parsed.filters.company).toBe("urudata");
    expect(parsed.text).toBe("soporte");
    expect(parsed.tokens[0]?.label).toBe("empresa: urudata");
  });

  test("varias @ se juntan por coma", () => {
    expect(parseSearch("@urudata @tata-services").filters.company).toBe("urudata,tata-services");
  });

  test("etiquetas: puesto, ubicacion, rubro", () => {
    const parsed = parseSearch("puesto:Soporte ubicacion:Montevideo rubro:Tecnología");
    expect(parsed.filters.title).toBe("Soporte");
    expect(parsed.filters.place).toBe("Montevideo");
    expect(parsed.filters.category).toBe("tecnologia");
    expect(parsed.text).toBe("");
  });

  test("etiquetas: nivel, modalidad, jornada, sueldo, dias", () => {
    const parsed = parseSearch(
      "nivel:junior modalidad:remoto jornada:completa sueldo:30.000 dias:7",
    );
    expect(parsed.filters.level).toBe("entry");
    expect(parsed.filters.mode).toBe("remote");
    expect(parsed.filters.jobType).toBe("full_time");
    expect(parsed.filters.salaryMin).toBe(30000);
    expect(parsed.filters.days).toBe(7);
  });

  test("sin-experiencia es un atajo sin valor", () => {
    expect(parseSearch("sin-experiencia").filters.noExperience).toBe(true);
    expect(parseSearch("SIN-EXPERIENCIA").filters.noExperience).toBe(true);
  });

  test("los atajos se combinan con el texto y entre sí", () => {
    const parsed = parseSearch("soporte @urudata ubicacion:montevideo modalidad:remoto");
    expect(parsed.text).toBe("soporte");
    expect(parsed.filters.company).toBe("urudata");
    expect(parsed.filters.place).toBe("montevideo");
    expect(parsed.filters.mode).toBe("remote");
    expect(parsed.tokens).toHaveLength(3);
  });

  test("una etiqueta que no se entiende queda como texto", () => {
    const parsed = parseSearch("nivel:raro");
    expect(parsed.filters.level).toBeUndefined();
    expect(parsed.text).toBe("nivel:raro");
    expect(parsed.tokens).toEqual([]);
  });
});

describe("withoutToken", () => {
  test("saca el atajo exacto", () => {
    expect(withoutToken("soporte @urudata ubicacion:montevideo", "@urudata")).toBe(
      "soporte ubicacion:montevideo",
    );
  });
});
