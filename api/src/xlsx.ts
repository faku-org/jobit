/**
 * Un XLSX mínimo, escrito a mano.
 *
 * Un `.xlsx` es un zip con cuatro XML y una hoja por pestaña, y eso es todo lo
 * que hace falta acá: números, texto y nada más. Las librerías del rubro traen
 * fórmulas, estilos, gráficos y su propia superficie de ataque para leer
 * archivos ajenos; este módulo solo escribe, así que no hay nada que parsear ni
 * nada que dependa de que un archivo de afuera esté bien formado.
 *
 * Los textos van como `inlineStr` en vez de la tabla de strings compartida:
 * ocupa un poco más y evita una parte entera y su índice.
 */
import { deflateRawSync } from "node:zlib";
import type { Cell } from "./csv.ts";

export interface Sheet {
  /** Nombre de la pestaña. La primera fila es el encabezado. */
  name: string;
  rows: readonly (readonly Cell[])[];
}

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

/** Un carácter de control no es XML válido en ninguna versión y un aviso puede
 * traerlo: se va cuando se escribe, no cuando Excel se queja. */
const isControl = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return code < 32 && code !== 9 && code !== 10 && code !== 13;
};

/** Un solo recorrido hace las dos cosas: escapar lo que XML reserva y tirar lo
 * que XML no admite. */
const xml = (value: string): string =>
  [...value].map((char) => (isControl(char) ? "" : (XML_ESCAPES[char] ?? char))).join("");

/** A, B, ... Z, AA, AB. */
function columnName(index: number): string {
  let name = "";
  for (let rest = index; rest >= 0; rest = Math.floor(rest / 26) - 1) {
    name = String.fromCharCode(65 + (rest % 26)) + name;
  }
  return name;
}

/** Excel no acepta más de 31 caracteres ni `: \ / ? * [ ]` en el nombre de una
 * pestaña, y rechaza el archivo entero si aparecen. */
const sheetName = (name: string): string =>
  name.replace(/[:\\/?*[\]]/g, "-").slice(0, 31) || "hoja";

function cellXml(value: Cell, reference: string): string {
  if (value === null || value === "") return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return `<c r="${reference}"><v>${value}</v></c>`;
  }
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

function sheetXml(sheet: Sheet): string {
  const rows = sheet.rows
    .map((cells, index) => {
      const number = index + 1;
      const body = cells.map((cell, column) => cellXml(cell, `${columnName(column)}${number}`));
      return `<row r="${number}">${body.join("")}</row>`;
    })
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${rows}</sheetData></worksheet>`
  );
}

const OFFICE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PACKAGE = "http://schemas.openxmlformats.org/package/2006/relationships";
const SPREADSHEET = "application/vnd.openxmlformats-officedocument.spreadsheetml";

export const XLSX_MIME = `${SPREADSHEET}.sheet`;

const sheetPath = (index: number): string => `xl/worksheets/sheet${index + 1}.xml`;

function contentTypesXml(sheets: Sheet[]): string {
  const overrides = sheets
    .map(
      (_, index) =>
        `<Override PartName="/${sheetPath(index)}" ContentType="${SPREADSHEET}.worksheet+xml"/>`,
    )
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="${SPREADSHEET}.sheet.main+xml"/>` +
    `${overrides}</Types>`
  );
}

function workbookXml(sheets: Sheet[]): string {
  const entries = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${xml(sheetName(sheet.name))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${OFFICE}">` +
    `<sheets>${entries}</sheets></workbook>`
  );
}

function workbookRelsXml(sheets: Sheet[]): string {
  const entries = sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="${OFFICE}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="${PACKAGE}">${entries}</Relationships>`
  );
}

const ROOT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="${PACKAGE}">` +
  `<Relationship Id="rId1" Type="${OFFICE}/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`;

interface Part {
  name: string;
  body: string;
}

function parts(sheets: Sheet[]): Part[] {
  return [
    { name: "[Content_Types].xml", body: contentTypesXml(sheets) },
    { name: "_rels/.rels", body: ROOT_RELS },
    { name: "xl/workbook.xml", body: workbookXml(sheets) },
    { name: "xl/_rels/workbook.xml.rels", body: workbookRelsXml(sheets) },
    ...sheets.map((sheet, index) => ({ name: sheetPath(index), body: sheetXml(sheet) })),
  ];
}

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * La fecha del zip queda fija en el comienzo del calendario de MS-DOS, que es
 * la más vieja que el formato sabe decir. Sirve para que el mismo reporte dé el
 * mismo archivo byte a byte: lo que fecha el contenido es la fecha de scrape que
 * va adentro, no el minuto en que alguien apretó descargar.
 */
const DOS_TIME = 0;
const DOS_DATE = 33;

interface Encoded {
  name: Uint8Array;
  data: Uint8Array;
  size: number;
  crc: number;
  offset: number;
}

function localHeader(entry: Encoded): Uint8Array {
  const head = new Uint8Array(30 + entry.name.length);
  const view = new DataView(head.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 8, true);
  view.setUint16(10, DOS_TIME, true);
  view.setUint16(12, DOS_DATE, true);
  view.setUint32(14, entry.crc, true);
  view.setUint32(18, entry.data.length, true);
  view.setUint32(22, entry.size, true);
  view.setUint16(26, entry.name.length, true);
  view.setUint16(28, 0, true);
  head.set(entry.name, 30);
  return head;
}

/** El byte 42 es el offset del encabezado local: sin él un lector abre el
 * archivo y no encuentra ninguna de las partes. */
function centralHeader(entry: Encoded): Uint8Array {
  const head = new Uint8Array(46 + entry.name.length);
  const view = new DataView(head.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 8, true);
  view.setUint16(12, DOS_TIME, true);
  view.setUint16(14, DOS_DATE, true);
  view.setUint32(16, entry.crc, true);
  view.setUint32(20, entry.data.length, true);
  view.setUint32(24, entry.size, true);
  view.setUint16(28, entry.name.length, true);
  view.setUint32(42, entry.offset, true);
  head.set(entry.name, 46);
  return head;
}

function endOfDirectory(count: number, size: number, offset: number): Uint8Array {
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, size, true);
  view.setUint32(16, offset, true);
  return end;
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** Las hojas, empaquetadas como el zip que Excel espera encontrar. */
export function toXlsx(sheets: Sheet[]): Uint8Array {
  const encoder = new TextEncoder();
  const entries: Encoded[] = [];
  const body: Uint8Array[] = [];
  let offset = 0;

  for (const part of parts(sheets)) {
    const raw = encoder.encode(part.body);
    const entry: Encoded = {
      name: encoder.encode(part.name),
      data: new Uint8Array(deflateRawSync(raw)),
      size: raw.length,
      crc: crc32(raw),
      offset,
    };

    const head = localHeader(entry);
    body.push(head, entry.data);
    offset += head.length + entry.data.length;
    entries.push(entry);
  }

  const directory = entries.map(centralHeader);
  const directorySize = directory.reduce((sum, chunk) => sum + chunk.length, 0);

  return concat([...body, ...directory, endOfDirectory(entries.length, directorySize, offset)]);
}
