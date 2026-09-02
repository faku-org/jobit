import { Check } from "lucide-react";
import type { ReactNode } from "react";

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
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-sky text-ink"
          : "bg-onpanel/10 text-onpanel/75 hover:bg-onpanel/20 hover:text-onpanel"
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
      <p className="text-[11px] font-semibold tracking-wide text-onpanel/50 uppercase">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
