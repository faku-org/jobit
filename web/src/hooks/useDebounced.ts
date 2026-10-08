import { useEffect, useState } from "react";

/** Espera a que el valor deje de cambiar antes de devolverlo: lo usa el
 * buscador de servicios, que no puede pedir en cada tecla. */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
