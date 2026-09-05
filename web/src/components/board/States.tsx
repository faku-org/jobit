import { SearchX, TriangleAlert } from "lucide-react";
import { stagger } from "../../lib/motion.ts";
import type { View } from "../../lib/types.ts";
import { FadeUp } from "../ui/FadeUp.tsx";

export function JobListSkeleton() {
  return (
    <div aria-label="Cargando ofertas" className="space-y-3" role="status">
      {Array.from({ length: 5 }, (_, index) => (
        <FadeUp key={index} delay={stagger(index)}>
          <div className="animate-pulse rounded-2xl border border-sky/50 bg-surface p-5">
            <div className="h-4 w-2/5 rounded-full bg-sky/60" />
            <div className="mt-3 h-3 w-3/5 rounded-full bg-mist" />
            <div className="mt-4 flex gap-2">
              <div className="h-6 w-20 rounded-full bg-mist" />
              <div className="h-6 w-16 rounded-full bg-mist" />
            </div>
          </div>
        </FadeUp>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  /** The list that came back empty; each one is empty for its own reason. */
  view: View;
  similar: boolean;
  /** Rubros and zonas the person hid, the one setting that removes offers. */
  hidden: number;
  /** Whether there is any filter to clear; an empty shortlist has none. */
  canReset: boolean;
  onReset: () => void;
}

function emptyCopy({ view, similar, hidden }: EmptyStateProps): { title: string; hint: string } {
  if (view === "saved") {
    return {
      title: "Todavía no guardaste ninguna oferta",
      hint: "Usá el marcador en cada oferta para armar tu lista.",
    };
  }
  if (view === "state") {
    return {
      title: "No hay llamados del Estado para estos filtros",
      hint:
        hidden > 0
          ? "Puede ser por los rubros o las zonas que ocultaste en Preferencias."
          : "Uruguay Concursa publica por tandas: probá sin filtros o volvé en unos días.",
    };
  }
  if (similar) {
    return {
      title: "Ninguna oferta coincide con tus preferencias",
      hint: "Ajustá las preferencias en el encabezado o apagá “Solo similares”.",
    };
  }
  return {
    title: "No hay ofertas para estos filtros",
    hint:
      hidden > 0
        ? `Ojo que tenés ${hidden} ${hidden === 1 ? "rubro o zona oculta" : "rubros o zonas ocultas"} en Preferencias.`
        : "Probá ampliar la búsqueda o quitar filtros.",
  };
}

export function EmptyState(props: EmptyStateProps) {
  const { title, hint } = emptyCopy(props);

  return (
    <div className="rounded-2xl border border-dashed border-sky bg-surface/60 px-6 py-16 text-center">
      <SearchX aria-hidden className="mx-auto size-7 text-brand" />
      <p className="mt-4 text-[15px] font-medium text-ink">{title}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
      {props.canReset ? (
        <button
          className="mt-5 rounded-xl border border-sky/70 bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-mist"
          type="button"
          onClick={props.onReset}
        >
          Limpiar filtros
        </button>
      ) : null}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-brand bg-mist px-6 py-12 text-center">
      <TriangleAlert aria-hidden className="mx-auto size-7 text-brand" />
      <p className="mt-4 text-[15px] font-medium text-ink">No se pudieron cargar las ofertas</p>
      <p className="mt-1 text-sm text-soft">{message}</p>
    </div>
  );
}
