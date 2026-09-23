/**
 * Qué tanda de ofertas se está mirando.
 *
 * La API dice cuándo scrapeó lo que sirve (`scraped_at`), y ese sello es el
 * único momento en que lo guardado deja de ser verdad: mientras no cambie, una
 * lista traída hace una hora sigue siendo la misma lista. Cuando cambia, todo
 * lo que se trajo antes quedó viejo de una vez, sin importar de qué consulta
 * era.
 *
 * Vive fuera de React porque lo miran dos cosas que no se conocen entre sí (la
 * lista y el informe de mercado) y porque lo escribe una tercera, la que
 * revalida el `meta`. Se lee con `useSyncExternalStore`, así que un cambio
 * repinta lo que haya montado sin que nadie tenga que pasarse el dato.
 */
let version = "";

const listeners = new Set<() => void>();

export const boardVersion = (): string => version;

export function subscribeBoard(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Anota qué tanda está sirviendo la API.
 *
 * `invalidate` corre antes de avisarle a nadie, y ese orden es el punto: al
 * avisar, lo que esté montado vuelve a leer el caché en el mismo tick, así que
 * si todavía no se tiró se encuentra lo viejo y decide que no hace falta pedir
 * nada. La primera respuesta estrena el valor sin invalidar, porque no había
 * nada de antes.
 */
export function setBoardVersion(next: string, invalidate: () => void): void {
  if (next === "" || next === version) return;

  const first = version === "";
  version = next;
  if (first) return;

  invalidate();
  for (const listener of listeners) listener();
}

/** Solo para los tests: deja el módulo como recién cargado. */
export function resetBoardVersion(): void {
  version = "";
  listeners.clear();
}
