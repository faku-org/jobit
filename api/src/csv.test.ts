import { describe, expect, test } from "bun:test";
import { toCsv } from "./csv.ts";

describe("toCsv", () => {
  test("escribe una fila por lista y cierra la última", () => {
    expect(
      toCsv([
        ["a", "b"],
        [1, 2],
      ]),
    ).toBe("a,b\r\n1,2\r\n");
  });

  test("una celda vacía queda vacía y no dice null", () => {
    expect(toCsv([["a", null, 0]])).toBe("a,,0\r\n");
  });

  test("entrecomilla lo que llevaría a leer mal la fila", () => {
    expect(toCsv([["Salto, Uruguay"]])).toBe('"Salto, Uruguay"\r\n');
    expect(toCsv([['Vendedor "senior"']])).toBe('"Vendedor ""senior"""\r\n');
    expect(toCsv([["dos\nlíneas"]])).toBe('"dos\nlíneas"\r\n');
  });

  test("lo que no lo necesita queda sin comillas", () => {
    expect(toCsv([["Montevideo", 120]])).toBe("Montevideo,120\r\n");
  });
});
