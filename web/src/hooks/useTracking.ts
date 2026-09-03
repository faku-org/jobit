import { useEffect, useRef } from "react";
import { searchEvent } from "../lib/events.ts";
import { flushEvents, setTracking, track } from "../lib/track.ts";
import { type Filters, hasActiveFilters } from "../lib/types.ts";

/**
 * Enciende y apaga la cola con la misma casilla que el resumen diario, y manda
 * lo juntado cuando la pestaña se va. `pagehide` en vez de `beforeunload`
 * porque es el que dispara en iOS al cambiar de app.
 */
export function useTracking(shareStats: boolean): void {
  useEffect(() => {
    setTracking(shareStats);
    if (!shareStats) return;

    const leave = () => flushEvents();
    const hidden = () => {
      if (document.visibilityState === "hidden") flushEvents();
    };

    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", hidden);

    /* Sin flush acá a propósito: esta limpieza también corre cuando alguien
       apaga la casilla, y lo que se juntó antes de apagarla se tira, no se
       manda de despedida. */
    return () => {
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [shareStats]);
}

/**
 * Un evento por búsqueda resuelta, no por tecla: espera a que la lista llegue
 * y no repite mientras los filtros no cambien, así paginar no cuenta de nuevo.
 * El tablero sin filtros no es una búsqueda y no se cuenta.
 */
export function useSearchTracking(filters: Filters, total: number, ready: boolean): void {
  const sent = useRef("");

  useEffect(() => {
    if (!ready || !hasActiveFilters(filters)) return;

    const key = JSON.stringify(filters);
    if (sent.current === key) return;

    sent.current = key;
    track(searchEvent(filters, total));
  }, [filters, total, ready]);
}
