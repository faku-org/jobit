import { SearchX, TriangleAlert } from "lucide-react";

export function JobListSkeleton() {
  return (
    <div aria-label="Cargando ofertas" className="space-y-3" role="status">
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-neutral-200 bg-white p-5"
        >
          <div className="h-4 w-2/5 rounded-full bg-neutral-200" />
          <div className="mt-3 h-3 w-3/5 rounded-full bg-neutral-100" />
          <div className="mt-4 flex gap-2">
            <div className="h-6 w-20 rounded-full bg-neutral-100" />
            <div className="h-6 w-16 rounded-full bg-neutral-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ saved, onReset }: { saved: boolean; onReset: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/60 px-6 py-16 text-center">
      <SearchX aria-hidden className="mx-auto size-7 text-neutral-400" />
      <p className="mt-4 text-[15px] font-medium text-neutral-900">
        {saved ? "Todavía no guardaste ninguna oferta" : "No hay ofertas para estos filtros"}
      </p>
      <p className="mt-1 text-sm text-neutral-500">
        {saved
          ? "Usá el marcador en cada oferta para armar tu lista."
          : "Probá ampliar la búsqueda o quitar filtros."}
      </p>
      <button
        className="mt-5 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
        type="button"
        onClick={onReset}
      >
        Limpiar filtros
      </button>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-12 text-center">
      <TriangleAlert aria-hidden className="mx-auto size-7 text-amber-500" />
      <p className="mt-4 text-[15px] font-medium text-amber-900">
        No se pudieron cargar las ofertas
      </p>
      <p className="mt-1 text-sm text-amber-700">{message}</p>
    </div>
  );
}
