import { describe, expect, test } from "bun:test";
import { type Block, parseDescription, renderSpans } from "./description.ts";
import { findMarks, findPerks, findProfileMatches } from "./perks.ts";
import { EMPTY_PROFILE, type Profile } from "./profile.ts";

const kinds = (blocks: Block[]) => blocks.map((block) => block.kind);

describe("parseDescription", () => {
  test("a shouted line with a colon is the heading of what follows", () => {
    const blocks = parseDescription("REQUISITOS:\n\n- Inglés\n- Excel");
    expect(kinds(blocks)).toEqual(["heading", "list"]);
    expect(blocks[0]).toEqual({ kind: "heading", text: "REQUISITOS" });
  });

  test("a question the next paragraph answers is a heading too", () => {
    const blocks = parseDescription("¿Cuál será tu desafío?\n\nLiderar el equipo.");
    expect(blocks[0]).toEqual({ kind: "heading", text: "¿Cuál será tu desafío?" });
  });

  test("a long shouted sentence is text, not a heading", () => {
    const long = "NIVEL DE CONOCIMIENTOS EQUIVALENTE A UN TITULO DE POSGRADO DOCUMENTADO";
    expect(kinds(parseDescription(long))).toEqual(["paragraph"]);
  });

  test("a shouted list of areas stays a paragraph", () => {
    expect(kinds(parseDescription("EXTENSION, INVESTIGACION, ENSEÑANZA"))).toEqual(["paragraph"]);
  });

  test("dashes and numbers are both bullets, and they group", () => {
    const blocks = parseDescription("- uno\n- dos\n\n1. tres\n2. cuatro");
    expect(blocks).toEqual([
      { kind: "list", items: ["uno", "dos"] },
      { kind: "list", items: ["tres", "cuatro"] },
    ]);
  });

  test("label and value pairs group into one block of fields", () => {
    const blocks = parseDescription("Organismo: UdelaR\nVínculo: Presupuestado\nPlazo: 2 AÑOS");
    expect(blocks).toEqual([
      {
        kind: "fields",
        rows: [
          { label: "Organismo", value: "UdelaR" },
          { label: "Vínculo", value: "Presupuestado" },
          { label: "Plazo", value: "2 AÑOS" },
        ],
      },
    ]);
  });

  test("a url is not a label with a value", () => {
    const blocks = parseDescription("https://www.concursos.udelar.edu.uy/index.php?id=1");
    expect(kinds(blocks)).toEqual(["paragraph"]);
  });

  test("a sentence carrying a clock time is not a field either", () => {
    const line = "La modalidad de trabajo será de Lun a Vie de 10:00 a 18:00";
    expect(kinds(parseDescription(line))).toEqual(["paragraph"]);
  });

  test("emoji the board dropped are removed, the heading survives", () => {
    expect(parseDescription("???? ¿Cuál será tu desafío?")).toEqual([
      { kind: "heading", text: "¿Cuál será tu desafío?" },
    ]);
    expect(parseDescription("- ???? Gestión de personal")).toEqual([
      { kind: "list", items: ["Gestión de personal"] },
    ]);
  });

  test("consecutive lines of prose join into one paragraph", () => {
    const blocks = parseDescription("Somos una empresa\nque busca gente.\n\nOtro párrafo.");
    expect(blocks).toEqual([
      { kind: "paragraph", text: "Somos una empresa que busca gente." },
      { kind: "paragraph", text: "Otro párrafo." },
    ]);
  });
});

describe("renderSpans", () => {
  test("markdown emphasis becomes a strong run", () => {
    expect(renderSpans("Buscamos *un analista* para el equipo")).toEqual([
      { kind: "text", text: "Buscamos " },
      { kind: "strong", text: "un analista" },
      { kind: "text", text: " para el equipo" },
    ]);
  });

  test("urls and e-mails become links", () => {
    const spans = renderSpans("Escribí a rrhh@acme.com o entrá a https://acme.com/jobs");
    expect(spans).toContainEqual({
      kind: "link",
      text: "rrhh@acme.com",
      href: "mailto:rrhh@acme.com",
    });
    expect(spans).toContainEqual({
      kind: "link",
      text: "https://acme.com/jobs",
      href: "https://acme.com/jobs",
    });
  });

  test("a highlight splits the plain text around it", () => {
    const text = "Ofrecemos capacitación paga desde el primer día";
    const spans = renderSpans(text, findMarks(text, EMPTY_PROFILE));
    expect(spans.some((span) => span.kind === "mark")).toBe(true);
    expect(spans.map((span) => span.text).join("")).toBe(text);
  });

  test("no run is ever lost, whatever the mix", () => {
    const text = "Beneficios: *mutualista* y viáticos, escribí a rrhh@acme.com";
    const spans = renderSpans(text, findMarks(text, EMPTY_PROFILE));
    const rebuilt = spans
      .map((span) => (span.kind === "strong" ? `*${span.text}*` : span.text))
      .join("");
    expect(rebuilt).toBe(text);
  });
});

const profile = (overrides: Partial<Profile> = {}): Profile => ({ ...EMPTY_PROFILE, ...overrides });

describe("perks", () => {
  test("finds what the offer gives, by the words employers use", () => {
    const found = findPerks("Contrato efectivo, mutualista y posibilidades de crecimiento laboral");
    expect(found.map((perk) => perk.id).sort()).toEqual(["crecimiento", "efectivo", "salud"]);
  });

  test("an offer that promises nothing lists nothing", () => {
    expect(findPerks("Se busca personal con experiencia en el rubro.")).toEqual([]);
  });

  test("accents in the text do not hide a perk", () => {
    expect(findPerks("Brindamos capacitación").map((p) => p.id)).toEqual(["capacitacion"]);
  });
});

describe("profile matches", () => {
  const mine = profile({
    courses: ["ingles-avanzado", "libreta-b"],
    degrees: ["contador-publico"],
  });

  test("names back what the offer asks for and the person has", () => {
    const text = "Se requiere inglés avanzado, libreta de conducir y ser Contador Público.";
    expect(findProfileMatches(text, mine).sort()).toEqual([
      "Contador Público",
      "Inglés avanzado (C1-C2)",
      "Libreta de conducir B (auto)",
    ]);
  });

  test("says nothing about what the person did not claim", () => {
    expect(findProfileMatches("Se requiere portugués fluido.", mine)).toEqual([]);
  });

  test("a search alias is not evidence: 'sistemas' is not a licenciatura", () => {
    const graduate = profile({ degrees: ["lic-informatica"] });
    expect(findProfileMatches("Mantenimiento de sistemas de riego", graduate)).toEqual([]);
  });
});

describe("findMarks", () => {
  test("offsets land on the original text, accents and all", () => {
    const text = "Damos capacitación y una excelente mutualista";
    for (const mark of findMarks(text, EMPTY_PROFILE)) {
      expect(text.slice(mark.start, mark.end).length).toBeGreaterThan(0);
    }
    expect(findMarks(text, EMPTY_PROFILE).map((m) => text.slice(m.start, m.end))).toEqual([
      "capacitación",
      "mutualista",
    ]);
  });

  test("marks never overlap, so they cannot nest when rendered", () => {
    const text = "capacitación paga y capacitación continua, con mutualista";
    const marks = findMarks(text, EMPTY_PROFILE);
    for (let index = 1; index < marks.length; index++) {
      expect(marks[index]?.start ?? 0).toBeGreaterThanOrEqual(marks[index - 1]?.end ?? 0);
    }
  });
});
