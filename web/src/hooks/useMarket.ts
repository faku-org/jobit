import { useEffect, useState, useSyncExternalStore } from "react";
import { fetchMarket } from "../lib/api.ts";
import { boardVersion, subscribeBoard } from "../lib/board.ts";
import type { MarketReport } from "../lib/market.ts";

type Status = "loading" | "ready" | "error";

/** El informe es el mismo para todos y solo cambia cuando corre el scraper,
 * así que se trae una vez por pestaña y se guarda acá, fuera del componente:
 * así lo puede dejar listo un prefetch antes de que nadie abra Mercado. */
let cached: MarketReport | null = null;
let inFlight: Promise<MarketReport> | null = null;

/** Corrió el scraper: lo guardado describe una tanda que ya no está. */
export function clearMarket(): void {
  cached = null;
}

/** Sin señal de cancelación a propósito: lo que trajo un prefetch tiene que
 * sobrevivir al componente que lo pidió, o abrir y cerrar la vista cancelaría
 * justo lo que se estaba adelantando. */
function load(): Promise<MarketReport> {
  if (cached !== null) return Promise.resolve(cached);
  if (inFlight !== null) return inFlight;

  inFlight = fetchMarket()
    .then((report) => {
      cached = report;
      return report;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** Deja el informe listo antes de que se toque la pestaña. */
export function prefetchMarket(): void {
  if (cached !== null) return;
  void load().catch(() => {});
}

interface State {
  report: MarketReport | null;
  status: Status;
  /** La tanda que describe `report`, para soltarlo cuando llega otra. */
  version: string;
}

const begin = (version: string): State =>
  cached === null
    ? { report: null, status: "loading", version }
    : { report: cached, status: "ready", version };

/**
 * Se trae la primera vez que se abre Mercado y después se queda: el informe es
 * el mismo para todos. Cuando corre el scraper cambia la versión del tablero y
 * esto lo vuelve a pedir solo, sin recargar la página.
 */
export function useMarket(enabled: boolean): { report: MarketReport | null; status: Status } {
  const version = useSyncExternalStore(subscribeBoard, boardVersion);
  const [state, setState] = useState<State>(() => begin(version));

  /** Otra tanda deja sin respaldo lo que se está mostrando: se suelta durante
   * el render y no en un efecto, para no pintar un frame con el informe viejo. */
  if (state.version !== version) setState(begin(version));

  const { report, version: asked } = state;

  useEffect(() => {
    if (!enabled || report !== null) return;

    let live = true;

    load()
      .then((value) => {
        if (live) setState({ report: value, status: "ready", version: asked });
      })
      .catch(() => {
        if (live) setState((current) => ({ ...current, status: "error" }));
      });

    return () => {
      live = false;
    };
  }, [enabled, report, asked]);

  return { report: state.report, status: state.status };
}
