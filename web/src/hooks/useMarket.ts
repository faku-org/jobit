import { useEffect, useState } from "react";
import { fetchMarket, isAbortError } from "../lib/api.ts";
import type { MarketReport } from "../lib/market.ts";

type Status = "loading" | "ready" | "error";

/**
 * Loaded the first time the market view is opened and then kept: the report is
 * the same for everyone and only changes when the scraper runs.
 */
export function useMarket(enabled: boolean): { report: MarketReport | null; status: Status } {
  const [report, setReport] = useState<MarketReport | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!enabled || report !== null) return;

    const controller = new AbortController();
    setStatus("loading");

    fetchMarket(controller.signal)
      .then((value) => {
        setReport(value);
        setStatus("ready");
      })
      .catch((cause: unknown) => {
        if (!isAbortError(cause)) setStatus("error");
      });

    return () => controller.abort();
  }, [enabled, report]);

  return { report, status };
}
