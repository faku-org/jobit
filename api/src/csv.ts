/**
 * CSV como lo define el RFC 4180: coma, comillas dobles para lo que las
 * necesita, y `\r\n` entre filas.
 *
 * Es el formato que abre cualquier cosa, así que la única libertad que se toma
 * es no tomarse ninguna: separador coma aunque Excel en español prefiera el
 * punto y coma, porque un `sep=;` adelante rompe a todo lector que no sea
 * Excel. Quien lo quiere en una planilla tiene el XLSX al lado.
 */

/** Lo que entra en una celda. Vacío es `null` y no `""`: una celda sin dato no
 * es lo mismo que una celda con texto vacío cuando esto llega a una planilla. */
export type Cell = string | number | null;

const NEEDS_QUOTES = /[",\r\n]/;

function escape(value: Cell): string {
  if (value === null) return "";
  const text = String(value);
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Las filas ya vienen alineadas con el encabezado, que es la primera. */
export const toCsv = (rows: readonly (readonly Cell[])[]): string =>
  rows.map((row) => row.map(escape).join(",")).join("\r\n") + "\r\n";
