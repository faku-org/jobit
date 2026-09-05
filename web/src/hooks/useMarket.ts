import { useEffect, useState } from "react";
import { fetchMarket } from "../lib/api.ts";
import type { MarketReport } from "../lib/market.ts";

type Status = "loading" | "ready" | "error";

/** El informe es el mismo para todos y solo cambia cuando corre el scraper,
 * así que se trae una vez por pestaña y se guarda acá, fuera del componente:
 * así lo puede dejar listo un prefetch antes de que nadie abra Mercado. */
let cached: MarketReport | null = null;
let inFlight: Promise<MarketReport> | null = null;

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

/**
 * Loaded the first time the market view is opened and then kept: the report is
 * the same for everyone and only changes when the scraper runs.
 */
export function useMarket(enabled: boolean): { report: MarketReport | null; status: Status } {
  const [report, setReport] = useState<MarketReport | null>(cached);
  const [status, setStatus] = useState<Status>(cached === null ? "loading" : "ready");

  useEffect(() => {
    if (!enabled || report !== null) return;

    let live = true;
    setStatus("loading");

    load()
      .then((value) => {
        if (!live) return;
        setReport(value);
        setStatus("ready");
      })
      .catch(() => {
        if (live) setStatus("error");
      });

    return () => {
      live = false;
    };
  }, [enabled, report]);

  return { report, status };
}
