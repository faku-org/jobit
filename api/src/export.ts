/**
 * El mercado como tablas, para bajarlo y mirarlo en otro lado.
 *
 * El reporte que sirve `/api/market` es un objeto anidado: un total, varios
 * cortes y un resumen de sueldos colgando de cada uno. Nada de eso entra en una
 * planilla tal cual, así que acá se aplana a una forma larga: cada fila es un
 * corte, y la columna `tabla` dice de qué corte se trata. Las columnas son
 * siempre las mismas, con vacío donde ese corte no tiene ese dato.
 *
 * El CSV es todas las tablas una abajo de la otra, que es lo que espera quien
 * lo va a filtrar por código. El XLSX es una pestaña por tabla, que es lo que
 * espera quien lo va a abrir a mano.
 */
import { JOB_TYPE_LABEL, LEVEL_LABEL, SOURCE_LABEL, WORK_MODE_LABEL } from "@jobit/worker/labels";
import { type Cell, toCsv } from "./csv.ts";
import type { Breakdown, MarketReport, SalarySummary } from "./market.ts";
import type { Sheet } from "./xlsx.ts";

/** Una fila del reporte, en los términos del reporte y no en los de la planilla. */
interface Row {
  /** El valor con el que se filtra la API: un slug, un departamento, un enum. */
  clave: string;
  /** El mismo valor como se lee en pantalla. */
  etiqueta: string;
  /** Solo los puestos: el rubro donde cae la mayoría de sus avisos. */
  rubro?: string;
  ofertas: number;
  sinExperiencia?: number;
  /**
   * Cuántas de esas ofertas publican un monto creíble. Sale del resumen de
   * sueldos, salvo en el total, donde se cuenta aunque sean muy pocas para
   * armar un rango.
   */
  conSueldo?: number;
  salary?: SalarySummary | null;
}

export interface MarketTable {
  /** Nombre de la pestaña en el XLSX y valor de la columna `tabla` en el CSV. */
  name: string;
  rows: Row[];
}

export const EXPORT_COLUMNS = [
  "tabla",
  "clave",
  "etiqueta",
  "rubro",
  "ofertas",
  "sin_experiencia",
  "sueldos_publicados",
  "sueldo_min",
  "sueldo_p25",
  "sueldo_mediana",
  "sueldo_p75",
  "sueldo_max",
] as const;

const cells = (table: string, row: Row): Cell[] => [
  table,
  row.clave,
  row.etiqueta,
  row.rubro ?? null,
  row.ofertas,
  row.sinExperiencia ?? null,
  row.conSueldo ?? row.salary?.count ?? null,
  row.salary?.min ?? null,
  row.salary?.p25 ?? null,
  row.salary?.median ?? null,
  row.salary?.p75 ?? null,
  row.salary?.max ?? null,
];

/** Un valor cerrado que solo se cuenta: modalidad, jornada, nivel, fuente. */
const breakdown = (rows: Breakdown[], labels: Record<string, string>): Row[] =>
  rows.map((row) => ({
    clave: row.value,
    etiqueta: labels[row.value] ?? row.value,
    ofertas: row.count,
  }));

/**
 * Lo que sale exportado, y en qué orden. `entryFriendly` no está: es la tabla
 * de rubros ordenada por `sin_experiencia / ofertas`, y quien exporta puede
 * ordenarla igual sin que se la repitan.
 */
export function marketTables(report: MarketReport): MarketTable[] {
  return [
    {
      name: "total",
      rows: [
        {
          clave: "total",
          etiqueta: "Todo el país",
          ofertas: report.count,
          sinExperiencia: report.noExperience,
          conSueldo: report.withSalary,
          salary: report.salary,
        },
      ],
    },
    {
      name: "frescura",
      rows: [
        {
          clave: "ultimos_7_dias",
          etiqueta: "Publicadas en los últimos 7 días",
          ofertas: report.fresh7,
        },
        {
          clave: "ultimos_30_dias",
          etiqueta: "Publicadas en los últimos 30 días",
          ofertas: report.fresh30,
        },
      ],
    },
    { name: "fuente", rows: breakdown(report.sources, SOURCE_LABEL) },
    {
      name: "puesto",
      rows: report.roles.map((role) => ({
        clave: role.slug,
        etiqueta: role.label,
        rubro: role.categoryLabel,
        ofertas: role.count,
        sinExperiencia: role.noExperience,
        salary: role.salary,
      })),
    },
    {
      name: "rubro",
      rows: report.categories.map((category) => ({
        clave: category.value,
        etiqueta: category.label,
        ofertas: category.count,
        sinExperiencia: category.noExperience,
        salary: category.salary,
      })),
    },
    {
      name: "departamento",
      rows: report.departments.map((department) => ({
        clave: department.value,
        etiqueta: department.value,
        ofertas: department.count,
        salary: department.salary,
      })),
    },
    { name: "modalidad", rows: breakdown(report.modes, WORK_MODE_LABEL) },
    { name: "jornada", rows: breakdown(report.jobTypes, JOB_TYPE_LABEL) },
    { name: "nivel", rows: breakdown(report.levels, LEVEL_LABEL) },
  ];
}

/** Todas las tablas, una abajo de la otra, bajo un solo encabezado. */
export function marketCsv(report: MarketReport): string {
  const rows: Cell[][] = [[...EXPORT_COLUMNS]];
  for (const table of marketTables(report)) {
    for (const row of table.rows) rows.push(cells(table.name, row));
  }
  return toCsv(rows);
}

/** Saca las columnas que en esta tabla no tienen ni un dato: la pestaña de
 * niveles no necesita seis columnas de sueldos vacías para decir tres números. */
function used(header: readonly string[], body: Cell[][]): Cell[][] {
  const keep = header.map((_, index) => body.some((row) => row[index] !== null));
  const pick = (row: readonly Cell[]): Cell[] => row.filter((_, index) => keep[index]);
  return [pick(header), ...body.map(pick)];
}

/** Una pestaña por tabla, sin la columna `tabla`: el nombre ya lo dice. */
export function marketSheets(report: MarketReport): Sheet[] {
  const header = EXPORT_COLUMNS.slice(1);

  return marketTables(report).map((table) => ({
    name: table.name,
    rows: used(
      header,
      table.rows.map((row) => cells(table.name, row).slice(1)),
    ),
  }));
}
