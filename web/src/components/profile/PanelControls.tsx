import { Check, EyeOff, Star } from "lucide-react";
import type { ReactNode } from "react";
import type { Facet, Stance, StanceLists } from "../../lib/types.ts";
import { nextStance, setStance, stanceOf } from "../../lib/types.ts";

/** The chip and group used by both sheets inside the island. */
export function PanelChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-xs ${
        active
          ? "bg-sky text-ink"
          : "bg-onpanel-wash text-onpanel/75 hover:bg-onpanel/20 hover:text-onpanel"
      }`}
      type="button"
      onClick={onClick}
    >
      {active ? <Check aria-hidden className="size-3" /> : null}
      {children}
    </button>
  );
}

export function PanelGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wide text-onpanel-muted uppercase">
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

const STANCE_STYLE: Record<Stance, string> = {
  wanted: "bg-sky text-ink",
  hidden: "bg-onpanel-wash text-onpanel-faint line-through decoration-onpanel-faint",
  neutral: "bg-onpanel-wash text-onpanel/75 hover:bg-onpanel/20 hover:text-onpanel",
};

const STANCE_HINT: Record<Stance, string> = {
  wanted: "Lo querés: tocá para ocultarlo",
  hidden: "Está oculto: tocá para volver a verlo",
  neutral: "Tocá para priorizarlo",
};

/**
 * One chip per rubro or departamento, cycling through the three things a
 * person can mean: lo quiero, me da igual, no me lo muestres. Two separate
 * controls for "preferir" and "ocultar" would let both be set at once, which
 * cannot mean anything.
 */
export function StanceChips({
  title,
  hint,
  facets,
  lists,
  onChange,
}: {
  title: string;
  hint: string;
  facets: Facet[];
  lists: StanceLists;
  onChange: (lists: StanceLists) => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wide text-onpanel-muted uppercase">
        {title}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-onpanel-faint">{hint}</p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {facets.map((facet) => {
          const stance = stanceOf(lists, facet.value);
          return (
            <button
              key={facet.value}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-xs ${STANCE_STYLE[stance]}`}
              title={STANCE_HINT[stance]}
              type="button"
              onClick={() => onChange(setStance(lists, facet.value, nextStance(stance)))}
            >
              {stance === "wanted" ? <Star aria-hidden className="size-3 fill-current" /> : null}
              {stance === "hidden" ? <EyeOff aria-hidden className="size-3" /> : null}
              {facet.label}
              <span className="text-[10px] opacity-60 tabular-nums">{facet.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
