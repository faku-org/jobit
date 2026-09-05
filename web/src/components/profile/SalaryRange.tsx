import { Wallet } from "lucide-react";
import type { SalaryPreference } from "../../lib/types.ts";

interface SalaryRangeProps {
  value: SalaryPreference;
  onChange: (value: SalaryPreference) => void;
  /** The panel and the onboarding paint on different backgrounds. */
  tone?: "panel" | "surface";
}

/** Pesos a month. The top of the track means "sin tope", not 200.000. */
const FLOOR = 0;
const CEILING = 200_000;
const STEP = 2_500;

const pesos = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 });

const formatEdge = (value: number, isCeiling: boolean): string =>
  isCeiling && value >= CEILING ? "sin tope" : `$ ${pesos.format(value)}`;

/**
 * Two range inputs sharing one track. A single dual-thumb control does not
 * exist natively, and two do: each keeps its own keyboard handling and its own
 * label, which a div with pointer handlers would have to reinvent badly.
 */
export function SalaryRange({ value, onChange, tone = "panel" }: SalaryRangeProps) {
  const min = value.min ?? FLOOR;
  const max = value.max ?? CEILING;

  const onMuted = tone === "panel" ? "text-onpanel-muted" : "text-muted";
  const onStrong = tone === "panel" ? "text-onpanel" : "text-ink";
  const trackBase = tone === "panel" ? "bg-onpanel/15" : "bg-mist";

  /** A bound at the end of the track means the person set no bound at all. */
  const commit = (nextMin: number, nextMax: number) =>
    onChange({
      ...value,
      min: nextMin <= FLOOR ? null : nextMin,
      max: nextMax >= CEILING ? null : nextMax,
    });

  const percent = (amount: number) => ((amount - FLOOR) / (CEILING - FLOOR)) * 100;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className={`text-[11px] font-semibold tracking-wide uppercase ${onMuted}`}>
          Sueldo pretendido
        </p>
        <p className={`text-xs font-medium tabular-nums ${onStrong}`}>
          {formatEdge(min, false)} a {formatEdge(max, true)}
        </p>
      </div>

      <div className="relative mt-4 h-5">
        <div
          className={`absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full ${trackBase}`}
        />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-sky"
          style={{ left: `${percent(min)}%`, right: `${100 - percent(max)}%` }}
        />

        <input
          aria-label="Sueldo mínimo"
          aria-valuetext={formatEdge(min, false)}
          className="range-thumb"
          max={CEILING}
          min={FLOOR}
          step={STEP}
          type="range"
          value={min}
          onChange={(event) => commit(Math.min(Number(event.target.value), max - STEP), max)}
        />
        <input
          aria-label="Sueldo máximo"
          aria-valuetext={formatEdge(max, true)}
          className="range-thumb"
          max={CEILING}
          min={FLOOR}
          step={STEP}
          type="range"
          value={max}
          onChange={(event) => commit(min, Math.max(Number(event.target.value), min + STEP))}
        />
      </div>

      <label className="mt-3 flex cursor-pointer items-start gap-2">
        <input
          checked={value.includeUnknown}
          className="mt-0.5 size-3.5 shrink-0 accent-sky"
          type="checkbox"
          onChange={(event) => onChange({ ...value, includeUnknown: event.target.checked })}
        />
        <span className={`text-[11px] leading-relaxed ${onMuted}`}>
          <Wallet aria-hidden className="mr-1 inline size-3 align-[-1px]" />
          Mostrar también las ofertas que no publican el sueldo. Son la mayoría: si las sacás, la
          lista se achica muchísimo.
        </span>
      </label>
    </div>
  );
}
