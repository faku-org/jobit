import { useEffect, useState } from "react";
import { fetchEmployers } from "../lib/employers.ts";
import type { Facet } from "../lib/types.ts";

const cache = new Map<string, Facet[]>();

/** Las empresas de un rubro, para el selector. Se cachea por rubro. */
export function useEmployers(rubro: string): Facet[] {
  const [employers, setEmployers] = useState<Facet[]>(() => cache.get(rubro) ?? []);

  useEffect(() => {
    const hit = cache.get(rubro);
    if (hit) {
      setEmployers(hit);
      return;
    }

    const controller = new AbortController();
    fetchEmployers(rubro, controller.signal)
      .then((list) => {
        cache.set(rubro, list);
        setEmployers(list);
      })
      /** Un rubro sin empresas o una API caída dejan el selector vacío. */
      .catch(() => {});

    return () => controller.abort();
  }, [rubro]);

  return employers;
}
