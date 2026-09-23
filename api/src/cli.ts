/**
 * La URL del tablero, contestada en texto.
 *
 * Los filtros ya viajan en la barra de direcciones con los mismos nombres que
 * la API. Esta capa es lo que falta para que `curl` de esa dirección (y no de
 * `/api/jobs.txt`) devuelva el listado: entiende `view` y `job`, que son del
 * tablero y no de la consulta.
 *
 * Guardadas y seguimiento viven en el navegador: desde acá no hay nada que
 * devolver. El mercado es el informe, no las ofertas.
 */
import { SOURCE_LABEL } from "@jobit/worker/labels";
import type { MarketReport } from "./market.ts";

export type BoardView = "all" | "state" | "market" | "saved" | "tracking";

const VIEWS = new Set<BoardView>(["all", "state", "market", "saved", "tracking"]);

/** Misma fuente que `STATE_SOURCE` en la web: el tablero de llamados. */
export const STATE_SOURCE = "uruguayconcursa";

export function boardView(raw: string | undefined): BoardView {
  return raw !== undefined && VIEWS.has(raw as BoardView) ? (raw as BoardView) : "all";
}

/** Estado ignora los portales elegidos y ordena por fecha de cierre. */
export function withBoardView<Q extends { source?: string; sort?: "recent" | "closing" | "match" }>(
  query: Q,
  view: BoardView,
): Q {
  if (view !== "state") return query;
  return { ...query, source: STATE_SOURCE, sort: query.sort ?? "closing" };
}

export function localViewMessage(view: BoardView): string | null {
  if (view !== "saved" && view !== "tracking") return null;
  return [
    "JobIt",
    "",
    "Las guardadas y el seguimiento viven en el navegador, no en el servidor.",
    "Desde la CLI se lee el tablero público:",
    "",
    "  curl 'https://jobs.wefaber.net/?q=cajero'",
    "  curl 'https://jobs.wefaber.net/?view=state'",
    "  curl 'https://jobs.wefaber.net/?view=market'",
    "",
  ].join("\n");
}

const ROLE_CAP = 20;

function column(
  title: string,
  rows: readonly { label: string; count: number }[],
  cap?: number,
): string {
  if (rows.length === 0) return "";
  const shown = cap === undefined ? rows : rows.slice(0, cap);
  const width = String(shown[0]?.count ?? 0).length;
  const lines = shown.map((row) => `  ${String(row.count).padStart(width)}  ${row.label}`);
  if (cap !== undefined && rows.length > cap) lines.push(`  … ${rows.length - cap} más`);
  return `${title}\n${lines.join("\n")}`;
}

function pesos(value: number): string {
  return `$${value.toLocaleString("es-UY")}`;
}

/** El informe del mercado para leerlo en la terminal, no para procesarlo. */
export function formatMarket(report: MarketReport): string {
  const day = (report.scraped_at || "").slice(0, 10);
  const header = [`JobIt mercado · ${report.count} ofertas${day ? ` · ${day}` : ""}`];
  const bits = [`${report.noExperience} sin experiencia previa`];
  if (report.salary) bits.push(`mediana ${pesos(report.salary.median)}`);
  header.push(`  ${bits.join(" · ")}`);

  const sections = [
    header.join("\n"),
    column(
      "Fuente",
      report.sources.map((row) => ({
        label: SOURCE_LABEL[row.value] ?? row.value,
        count: row.count,
      })),
    ),
    column(
      "Puesto",
      report.roles.map((row) => ({ label: row.label, count: row.count })),
      ROLE_CAP,
    ),
    column(
      "Rubro",
      report.categories.map((row) => ({ label: row.label, count: row.count })),
    ),
    column(
      "Departamento",
      report.departments.map((row) => ({ label: row.value, count: row.count })),
    ),
    "CSV   /api/market.csv\nXLSX  /api/market.xlsx",
  ].filter((section) => section !== "");

  return `${sections.join("\n\n")}\n`;
}
