import { motion } from "motion/react";
import { fadeUpTransition, stagger } from "../lib/motion.ts";

/** One measured thing, whatever shape it ends up being drawn as. */
export interface ChartRow {
  key: string;
  label: string;
  value: number;
  /** The second number the row carries, already formatted. */
  note?: string;
  onClick?: () => void;
}

export type ChartKind = "bars" | "donut" | "table";

const CHART_LABEL: Record<ChartKind, string> = {
  bars: "Barras",
  donut: "Torta",
  table: "Tabla",
};

const share = (value: number, total: number): number => (total === 0 ? 0 : value / total);

const percent = new Intl.NumberFormat("es-UY", { style: "percent", maximumFractionDigits: 1 });
const counter = new Intl.NumberFormat("es-UY");

/**
 * Slices are one colour at falling strength rather than a rainbow: the palette
 * has four tones and inventing more would be inventing meaning that is not
 * there. Order is the only thing the colour encodes.
 */
const sliceOpacity = (index: number, total: number): number =>
  1 - (index / Math.max(total - 1, 1)) * 0.72;

function Bars({ rows }: { rows: ChartRow[] }) {
  const max = Math.max(...rows.map((row) => row.value), 0);

  return (
    <ol className="-mx-1.5">
      {rows.map((row, index) => {
        const width = max === 0 ? 0 : Math.max((row.value / max) * 100, 1.5);
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-ink/85">{row.label}</span>
              <span className="shrink-0 text-xs text-muted tabular-nums">
                {row.note ?? counter.format(row.value)}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-mist">
              <motion.div
                animate={{ width: `${width}%` }}
                className="h-full rounded-full bg-brand"
                initial={{ width: 0 }}
                transition={{ ...fadeUpTransition, delay: stagger(index, 0.03, 0.2) }}
              />
            </div>
          </>
        );

        return (
          <li key={row.key}>
            {row.onClick ? (
              <button
                className="w-full rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-mist"
                type="button"
                onClick={row.onClick}
              >
                {body}
              </button>
            ) : (
              <div className="px-1.5 py-1.5">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

const RADIUS = 60;
const STROKE = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** A hairline of background between slices, so neighbours stay countable. */
const SLICE_GAP = 2;
/** Past this many slices a ring says nothing; the tail becomes one wedge. */
const MAX_SLICES = 8;

/** Everything below the cut is one slice, because that is what it means. */
function foldTail(rows: ChartRow[]): ChartRow[] {
  if (rows.length <= MAX_SLICES) return rows;

  const head = rows.slice(0, MAX_SLICES - 1);
  const tail = rows.slice(MAX_SLICES - 1);

  return [
    ...head,
    {
      key: "__resto",
      label: `Otros ${tail.length}`,
      value: tail.reduce((sum, row) => sum + row.value, 0),
    },
  ];
}

function Donut({ rows: given }: { rows: ChartRow[] }) {
  const rows = foldTail(given);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
      <svg aria-hidden className="w-40 shrink-0 -rotate-90" viewBox="0 0 160 160">
        <circle
          cx="80"
          cy="80"
          fill="none"
          r={RADIUS}
          stroke="var(--color-mist)"
          strokeWidth={STROKE}
        />
        {/* The arc lengths are set outright and only the opacity is animated:
            a tweened dash array is a string motion re-reads on every render,
            and the slices were arriving stuck part-way. */}
        {rows.map((row, index) => {
          const length = share(row.value, total) * CIRCUMFERENCE;
          const circle = (
            <motion.circle
              key={row.key}
              animate={{ opacity: sliceOpacity(index, rows.length) }}
              cx="80"
              cy="80"
              fill="none"
              initial={{ opacity: 0 }}
              r={RADIUS}
              stroke="var(--color-brand)"
              strokeDasharray={`${Math.max(length - SLICE_GAP, 0.5)} ${CIRCUMFERENCE - length + SLICE_GAP}`}
              strokeDashoffset={-offset}
              strokeWidth={STROKE}
              transition={{ ...fadeUpTransition, delay: stagger(index, 0.04, 0.24) }}
            />
          );
          offset += length;
          return circle;
        })}
      </svg>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {rows.map((row, index) => (
          <li key={row.key} className="flex items-baseline gap-2">
            <span
              aria-hidden
              className="mt-1 size-2.5 shrink-0 rounded-full bg-brand"
              style={{ opacity: sliceOpacity(index, rows.length) }}
            />
            <span className="min-w-0 flex-1 truncate text-sm text-ink/85">{row.label}</span>
            <span className="shrink-0 text-xs text-muted tabular-nums">
              {percent.format(share(row.value, total))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Table({
  rows,
  unit,
  showShare,
}: {
  rows: ChartRow[];
  unit: string;
  /** Off where the values do not add up to anything: a column of medians has
   * no whole for a share to be a part of. */
  showShare: boolean;
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-sky/50 text-left text-[11px] tracking-wide text-faint uppercase">
            <th className="pb-2 font-semibold">Nombre</th>
            <th className="pb-2 text-right font-semibold">{unit}</th>
            {showShare ? <th className="pb-2 text-right font-semibold">Parte</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-sky/25 last:border-0">
              <td className="py-2 pr-3 text-ink/85">
                {row.onClick ? (
                  <button
                    className="text-left transition-colors hover:text-brand"
                    type="button"
                    onClick={row.onClick}
                  >
                    {row.label}
                  </button>
                ) : (
                  row.label
                )}
              </td>
              <td className="py-2 text-right text-soft tabular-nums whitespace-nowrap">
                {row.note ?? counter.format(row.value)}
              </td>
              {showShare ? (
                <td className="py-2 text-right text-faint tabular-nums">
                  {percent.format(share(row.value, total))}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The same rows drawn three ways, because the useful shape depends on the
 * question: bars to compare, a donut for how a whole splits up, a table when
 * the exact number is the point.
 */
export function Chart({
  kind,
  rows,
  unit = "Ofertas",
  empty = "No hay datos para mostrar.",
  additive = true,
}: {
  kind: ChartKind;
  rows: ChartRow[];
  unit?: string;
  empty?: string;
  /** Whether the values sum to a meaningful whole. Counts do; medians do not. */
  additive?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  }
  if (kind === "donut" && additive) return <Donut rows={rows} />;
  if (kind === "table") return <Table rows={rows} showShare={additive} unit={unit} />;
  return <Bars rows={rows} />;
}

/** The control that switches between them, shown only where more than one fits. */
export function ChartSwitch({
  kind,
  options,
  onChange,
}: {
  kind: ChartKind;
  options: ChartKind[];
  onChange: (kind: ChartKind) => void;
}) {
  return (
    <div className="inline-flex shrink-0 gap-0.5 rounded-lg bg-mist p-0.5" role="group">
      {options.map((option) => (
        <button
          key={option}
          aria-pressed={kind === option}
          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
            kind === option
              ? "bg-surface text-ink shadow-[var(--shadow-hairline)]"
              : "text-muted hover:text-ink"
          }`}
          type="button"
          onClick={() => onChange(option)}
        >
          {CHART_LABEL[option]}
        </button>
      ))}
    </div>
  );
}
