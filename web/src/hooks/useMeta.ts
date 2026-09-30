import { useEffect, useState } from "react";
import { fetchMeta } from "../lib/api.ts";
import { setBoardVersion } from "../lib/board.ts";
import { expireJobs } from "../lib/jobsCache.ts";
import type { Meta } from "../lib/types.ts";
import { clearMarket } from "./useMarket.ts";

/**
 * Cada cuánto se vuelve a preguntar mientras la pestaña está a la vista.
 *
 * No es un poll de ofertas: `meta` son el conteo, la fecha y las facetas, unos
 * pocos cientos de bytes, y lo que se está mirando es el sello de scrape. El
 * scraper corre unas pocas veces por día, así que cinco minutos alcanzan para
 * que una tanda nueva aparezca sola y no son nada para la API.
 */
const CHECK_MS = 5 * 60_000;

/**
 * Lo que la API dice del tablero, y el único lugar que se entera de que hubo
 * un scrape nuevo.
 *
 * Se vuelve a preguntar cuando la pestaña se muestra de nuevo y cada tanto
 * mientras se la está mirando. Si el `scraped_at` cambió, lo guardado describe
 * ofertas de otra tanda: se tira, y la lista y el mercado que estén abiertos se
 * vuelven a pedir solos. Antes esto se traía una sola vez al montar, así que
 * las ofertas nuevas solo aparecían recargando la página.
 */
export function useMeta(): Meta | null {
  const [meta, setMeta] = useState<Meta | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let asked = 0;

    const check = (): void => {
      if (document.hidden) return;

      const now = Date.now();
      /** Volver a la pestaña diez veces en un minuto es una sola pregunta. */
      if (now - asked < CHECK_MS) return;
      asked = now;

      fetchMeta(controller.signal)
        .then((next) => {
          setMeta(next);
          setBoardVersion(next.scraped_at, () => {
            expireJobs();
            clearMarket();
          });
        })
        /** Que falle no borra lo que se está mostrando: se vuelve a preguntar
         * en la próxima vuelta. */
        .catch(() => {});
    };

    check();
    const timer = setInterval(check, CHECK_MS);
    document.addEventListener("visibilitychange", check);

    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  return meta;
}
