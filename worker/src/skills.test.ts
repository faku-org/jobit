import { describe, expect, test } from "bun:test";
import { SKILLS, skillsOf } from "./skills.ts";

describe("skillsOf", () => {
  test("reconoce una habilidad dentro de una frase", () => {
    expect(skillsOf("Manejo de Excel avanzado").map((skill) => skill.slug)).toContain("excel");
  });

  test("saca varias del mismo texto", () => {
    const slugs = skillsOf("Excel y atención al cliente, con inglés intermedio").map(
      (skill) => skill.slug,
    );
    expect(slugs).toContain("excel");
    expect(slugs).toContain("atencion-cliente");
    expect(slugs).toContain("ingles");
  });

  test("el acento y las mayúsculas no importan", () => {
    expect(skillsOf("ATENCIÓN AL PÚBLICO").map((skill) => skill.slug)).toContain(
      "atencion-cliente",
    );
  });

  test("java no se come a javascript", () => {
    const slugs = skillsOf("Desarrollo en JavaScript y React").map((skill) => skill.slug);
    expect(slugs).toContain("javascript");
    expect(slugs).toContain("react");
    expect(slugs).not.toContain("java");
  });

  test("no repite la misma habilidad", () => {
    const slugs = skillsOf("Excel, excel y más excel").map((skill) => skill.slug);
    expect(slugs.filter((slug) => slug === "excel")).toHaveLength(1);
  });

  test("un texto sin habilidades no devuelve ninguna", () => {
    expect(skillsOf("Buscamos una persona responsable")).toEqual([]);
  });

  test("el catálogo no tiene slugs repetidos", () => {
    const slugs = SKILLS.map((skill) => skill.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
