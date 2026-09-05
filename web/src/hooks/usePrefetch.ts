import { useEffect } from "react";
import { prefetchJobs } from "../lib/jobsCache.ts";
import { prefetchMarket } from "./useMarket.ts";

/** Las claves son query strings, así que el separador no puede aparecer en
 * ninguna: viajan juntas para que el efecto dependa de un dato y no de un
 * arreglo nuevo en cada render. */
const SEPARATOR = "|";

/**
 * Cuando el navegador queda libre. `requestIdleCallback` no está en todos
 * lados; donde falta, un timeout corto hace lo mismo que importa acá, que es
 * no pelearle el ancho de banda a la primera pantalla.
 */
function onIdle(run: () => void): () => void {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(run, { timeout: 2500 });
    return () => cancelIdleCallback(id);
  }

  const id = window.setTimeout(run, 800);
  return () => window.clearTimeout(id);
}

/**
 * Deja traídas las pestañas que no se están mirando. La lista que se está
 * viendo manda: mientras carga no se le saca ancho de banda, y recién cuando
 * terminó y hay un rato libre se piden las otras. Es la diferencia entre
 * tocar Estado y esperar, y tocar Estado y verlo.
 */
export function usePrefetchViews(keys: string[], ready: boolean): void {
  const joined = keys.join(SEPARATOR);

  useEffect(() => {
    if (!ready || joined === "") return;

    return onIdle(() => {
      for (const key of joined.split(SEPARATOR)) prefetchJobs(key);
      prefetchMarket();
    });
  }, [joined, ready]);
}
