import { afterEach, describe, expect, test } from "bun:test";
import { boardVersion, resetBoardVersion, setBoardVersion, subscribeBoard } from "./board.ts";

const noop = (): void => {};

afterEach(() => {
  resetBoardVersion();
});

describe("setBoardVersion", () => {
  test("la primera respuesta estrena la versión sin invalidar nada", () => {
    let invalidated = 0;
    let avisos = 0;
    subscribeBoard(() => {
      avisos += 1;
    });

    setBoardVersion("2026-09-05T06:00:00.000Z", () => {
      invalidated += 1;
    });

    expect(boardVersion()).toBe("2026-09-05T06:00:00.000Z");
    expect(invalidated).toBe(0);
    expect(avisos).toBe(0);
  });

  test("el mismo sello no mueve nada", () => {
    setBoardVersion("2026-09-05T06:00:00.000Z", noop);

    let avisos = 0;
    subscribeBoard(() => {
      avisos += 1;
    });
    setBoardVersion("2026-09-05T06:00:00.000Z", noop);

    expect(avisos).toBe(0);
  });

  test("una respuesta sin sello se ignora en vez de borrar el tablero", () => {
    setBoardVersion("2026-09-05T06:00:00.000Z", noop);
    setBoardVersion("", noop);

    expect(boardVersion()).toBe("2026-09-05T06:00:00.000Z");
  });

  test("otro sello invalida y después avisa, en ese orden", () => {
    setBoardVersion("2026-09-05T06:00:00.000Z", noop);

    const pasos: string[] = [];
    subscribeBoard(() => {
      pasos.push("aviso");
    });

    setBoardVersion("2026-09-06T06:00:00.000Z", () => {
      pasos.push("tirar lo guardado");
    });

    /** El orden es el punto: quien escucha vuelve a leer el caché en el mismo
     * tick, así que tiene que encontrarlo ya vacío. */
    expect(pasos).toEqual(["tirar lo guardado", "aviso"]);
    expect(boardVersion()).toBe("2026-09-06T06:00:00.000Z");
  });

  test("quien se desuscribe deja de escuchar", () => {
    setBoardVersion("2026-09-05T06:00:00.000Z", noop);

    let avisos = 0;
    const unsubscribe = subscribeBoard(() => {
      avisos += 1;
    });
    unsubscribe();

    setBoardVersion("2026-09-06T06:00:00.000Z", noop);

    expect(avisos).toBe(0);
  });
});
