import { describe, expect, test } from "bun:test";
import { fold } from "./catalog.ts";
import { isEmptyReading, readCv, readExperience } from "./cv.ts";

const YEAR = 2026;
const read = (text: string) => readCv(text, YEAR);

describe("readExperience", () => {
  const years = (text: string) => readExperience(fold(text), YEAR);

  test("an explicit statement is taken at its word", () => {
    expect(years("Tengo 7 años de experiencia en ventas")).toBe(7);
    expect(years("5+ años de experiencia")).toBe(5);
  });

  test("periods add up when they do not overlap", () => {
    expect(years("2014 - 2016\n2018 - 2021")).toBe(5);
  });

  test("two jobs held at once are one stretch, not two", () => {
    expect(years("2018 - 2022\n2020 - 2023")).toBe(5);
  });

  test("an open period runs to today", () => {
    expect(years("2023 - actualidad")).toBe(3);
    expect(years("03/2024 – presente")).toBe(2);
  });

  test("impossible periods are ignored", () => {
    expect(years("1850 - 1900")).toBeNull();
    expect(years("2030 - 2035")).toBeNull();
  });

  test("a CV that says nothing about time answers nothing", () => {
    expect(years("Vendedor en una tienda de ropa")).toBeNull();
  });
});

describe("readCv", () => {
  test("recognises títulos and cursos, and nothing else", () => {
    const reading = read(`
      Formación
      Licenciatura en Informática, Universidad de la República
      Inglés avanzado
      Excel avanzado
      Aficiones: ajedrez y jardinería japonesa
    `);
    expect(reading.degrees).toContain("lic-informatica");
    expect(reading.courses).toContain("ingles-avanzado");
    expect(reading.courses).toContain("excel-avanzado");
    expect(reading.education).toBe("university");
  });

  test("the level comes from the highest título found", () => {
    expect(read("Bachillerato en Informática. Maestría en Administración.").education).toBe(
      "postgrad",
    );
  });

  test("a level named without a título still counts", () => {
    expect(read("Estudios terciarios incompletos en UTU").education).toBe("technical");
  });

  test("suggests rubros from the work the CV describes", () => {
    const reading = read("Desarrollador de software. Trabajé con Python y bases de datos SQL.");
    expect(reading.categories).toContain("tecnologia");
  });

  test("empty text reads as nothing at all", () => {
    expect(isEmptyReading(read("   "))).toBe(true);
    expect(read("").characters).toBe(0);
  });

  test("a CV about something else adds no studies", () => {
    const reading = read("Me gusta cocinar los domingos.");
    expect(reading.degrees).toEqual([]);
  });

  test("counts the text it managed to read, to explain an empty result", () => {
    expect(read("hola mundo").characters).toBe(10);
  });
});
