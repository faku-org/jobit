import { describe, expect, test } from "bun:test";
import { inflateRawSync } from "node:zlib";
import { toXlsx } from "./xlsx.ts";

/**
 * Un lector de zip mínimo, solo para sacar lo que el módulo puso. Recorre los
 * encabezados locales uno atrás del otro, que es como quedan escritos: si esto
 * lo lee, un lector de verdad también.
 */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const parts = new Map<string, string>();
  let at = 0;

  while (at + 4 <= bytes.length && view.getUint32(at, true) === 0x04034b50) {
    const compressed = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const extraLength = view.getUint16(at + 28, true);
    const name = decoder.decode(bytes.subarray(at + 30, at + 30 + nameLength));
    const start = at + 30 + nameLength + extraLength;
    parts.set(name, decoder.decode(inflateRawSync(bytes.subarray(start, start + compressed))));
    at = start + compressed;
  }

  return parts;
}

/** El directorio central, que es por donde un lector entra al archivo. */
function directory(bytes: Uint8Array): { count: number; offset: number; signature: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const offset = view.getUint32(end + 16, true);
  return { count: view.getUint16(end + 8, true), offset, signature: view.getUint32(offset, true) };
}

const book = toXlsx([
  {
    name: "total",
    rows: [
      ["etiqueta", "ofertas"],
      ["Todo el país", 1200],
    ],
  },
  {
    name: "nivel",
    rows: [
      ["etiqueta", "ofertas"],
      ["Junior & Semi", 40],
    ],
  },
]);

describe("toXlsx", () => {
  test("trae las partes que un xlsx necesita, una por hoja", () => {
    expect([...unzip(book).keys()]).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/worksheets/sheet1.xml",
      "xl/worksheets/sheet2.xml",
    ]);
  });

  test("el directorio central está donde el final dice y cuenta todas las partes", () => {
    const { count, offset, signature } = directory(book);
    expect(signature).toBe(0x02014b50);
    expect(count).toBe(6);
    expect(offset).toBeGreaterThan(0);
  });

  test("el texto viaja inline y los números como números", () => {
    const sheet = unzip(book).get("xl/worksheets/sheet1.xml") ?? "";
    expect(sheet).toContain('<t xml:space="preserve">Todo el país</t>');
    expect(sheet).toContain('<c r="B2"><v>1200</v></c>');
  });

  test("escapa lo que XML se reservó", () => {
    expect(unzip(book).get("xl/worksheets/sheet2.xml")).toContain("Junior &amp; Semi");
  });

  test("las pestañas se llaman como se pidió", () => {
    const workbook = unzip(book).get("xl/workbook.xml") ?? "";
    expect(workbook).toContain('name="total"');
    expect(workbook).toContain('name="nivel"');
  });

  test("un nombre que Excel rechazaría se acomoda en vez de romper el archivo", () => {
    const workbook = unzip(toXlsx([{ name: "a/b:c".repeat(20), rows: [["x"]] }])).get(
      "xl/workbook.xml",
    );
    expect(workbook).toContain('name="a-b-ca-b-ca-b-ca-b-ca-b-ca-b-ca"');
  });

  test("una celda vacía no ocupa lugar en la hoja", () => {
    const sheet = unzip(toXlsx([{ name: "h", rows: [["a", null, "c"]] }])).get(
      "xl/worksheets/sheet1.xml",
    );
    expect(sheet).toContain('<c r="A1"');
    expect(sheet).not.toContain('<c r="B1"');
    expect(sheet).toContain('<c r="C1"');
  });
});
