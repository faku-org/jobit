import { describe, expect, test } from "bun:test";
import { formatWeeklyHours, jobWeeklyHours, weeklyHours } from "./schedule.ts";
import type { Job } from "./types.ts";

describe("weeklyHours", () => {
  test("counts each weekday and saturday on its own range", () => {
    expect(weeklyHours("lunes a viernes de 10 a 18 y sábados de 9 a 13h")).toBe(44);
  });

  test("a range without days is a monday-to-friday week", () => {
    expect(weeklyHours("09:00 a 18:00")).toBe(45);
    expect(weeklyHours("9 a 18")).toBe(45);
  });

  test("named weekdays beat the five-day default", () => {
    expect(weeklyHours("Lunes a viernes de 9 a 18 hs")).toBe(45);
    expect(weeklyHours("lunes a jueves de 09 a 18 y Viernes de 9 a 17")).toBe(44);
  });

  test("reads an explicit weekly total", () => {
    expect(weeklyHours("44hs semanales")).toBe(44);
    expect(weeklyHours("40 horas semanales efectivas de labor.")).toBe(40);
  });

  test("minutes and dotted hours still add up", () => {
    expect(weeklyHours("Lunes a Viernes de 8:45 a 17:30 hs.")).toBe(44);
    expect(weeklyHours("de lunes a viernes de 8.30 a 18 hs")).toBe(47.5);
  });

  test("an overnight shift wraps the clock", () => {
    expect(weeklyHours("de miércoles a lunes de 17:40hs. a 1 a.m.")).toBe(44);
  });

  test("abbreviated days keep their span across the dot", () => {
    expect(weeklyHours("Lun. a Vie. 11:00 a 20:00 y Dom. de 9:00 a 13:00")).toBe(49);
  });

  test("a second stretch glued on without a separator is its own clause", () => {
    expect(weeklyHours("Lun a Vie de 9:30 a 18:30 Sab de 10:00 a 14:00")).toBe(49);
  });

  test("days named after the hours still describe the same stretch", () => {
    expect(weeklyHours("De 8:30 a 17:00 de Lunes a Viernes")).toBe(42.5);
    expect(weeklyHours("9 a 18 lunes a viernes")).toBe(45);
  });

  test("the weekly total survives the dot after the unit", () => {
    expect(weeklyHours("44 hs. semanales")).toBe(44);
  });

  test("single-letter days are read as days", () => {
    expect(weeklyHours("L a V 9 a 18hs S 9 a 13")).toBe(49);
    expect(weeklyHours("L. a V. de 7:30 a 15:30 y S. de 9:00 a 13:00")).toBe(44);
    expect(weeklyHours("Lunes a Viernes 15:00 a 21:00hs S 9:00 a 15:00")).toBe(36);
  });

  test("two shifts to choose between count once", () => {
    expect(weeklyHours("9a15hs / 15-21hs")).toBe(30);
  });

  test("stays quiet when there is no timetable", () => {
    expect(weeklyHours("Rotativo")).toBeNull();
    expect(weeklyHours("A convenir")).toBeNull();
    expect(weeklyHours("Lunes a viernes")).toBeNull();
  });

  test("a rotating shift stays quiet even when it names hours", () => {
    expect(weeklyHours("Rotativo : 07:30 a 15:30 / 12:30 a 20:30")).toBeNull();
    expect(weeklyHours("rango L a V de 07 a 18h y S 8 a 12horas.")).toBeNull();
  });

  /** Media frase sumada da un número peor que no dar ninguno: "8 a 4" no se
   * puede leer, y sin este corte el total quedaba en las cuatro horas del
   * sábado. */
  test("one unreadable stretch drops the whole reading", () => {
    expect(weeklyHours("8 a 4 y sabados 8 a 12")).toBeNull();
  });

  test("above sixty it is the opening window, not somebody's week", () => {
    expect(weeklyHours("lunes a domingos 9 a 21")).toBeNull();
    /** Un total declarado sí se cree: lo afirma el aviso. */
    expect(weeklyHours("60 horas semanales")).toBe(60);
  });
});

describe("formatWeeklyHours", () => {
  test("uses a comma for the half hour", () => {
    expect(formatWeeklyHours(44)).toBe("44 h semanales");
    expect(formatWeeklyHours(43.5)).toBe("43,5 h semanales");
  });
});

describe("jobWeeklyHours", () => {
  test("reads a Horario line out of the description when the field is empty", () => {
    const job = {
      schedule: null,
      description:
        "Ofrecemos\n\nRemuneración acorde al cargo.\n\nHorario: lunes a viernes de 10 a 18 y sábados de 9 a 13h.",
    } as Job;
    expect(jobWeeklyHours(job)).toBe(44);
  });
});
