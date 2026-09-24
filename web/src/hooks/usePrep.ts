import type { ContentItem, ContentKind } from "@jobit/worker/content/types";
import { useEffect, useState } from "react";
import { fetchContent } from "../lib/content.ts";

/**
 * El contenido de un rubro, pedido por tipo. Se pide una sola vez por
 * combinación y se guarda en memoria mientras dure la pestaña, así abrir otra
 * oferta del mismo rubro no vuelve a la red.
 *
 * `enabled` es lo que lo ata al momento: en la ficha solo se pide cuando la
 * oferta ya está en seguimiento, no al abrir cualquier oferta.
 *
 * Los dos conjuntos de tipos son constantes porque son la clave de la caché:
 * pasar un array nuevo cada render la vaciaría sola.
 */
export const PRACTICE_KINDS: ContentKind[] = ["faq", "exercise"];
export const INTERVIEW_KINDS: ContentKind[] = ["faq", "topic"];

const LIMIT = 12;
const FRESH_MS = 30 * 60_000;

interface Entry {
  at: number;
  items: ContentItem[];
}

const cache = new Map<string, Entry>();

export interface PrepState {
  items: ContentItem[];
  status: "idle" | "loading" | "ready" | "error";
}

const keyOf = (category: string, kinds: ContentKind[]): string => `${kinds.join(",")}:${category}`;

function fresh(category: string, kinds: ContentKind[]): ContentItem[] | null {
  const hit = cache.get(keyOf(category, kinds));
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.items;
  return null;
}

function initial(category: string, enabled: boolean, kinds: ContentKind[]): PrepState {
  if (!enabled || category === "") return { items: [], status: "idle" };
  const hit = fresh(category, kinds);
  return hit ? { items: hit, status: "ready" } : { items: [], status: "loading" };
}

export function usePrep(
  category: string,
  enabled: boolean,
  kinds: ContentKind[] = PRACTICE_KINDS,
): PrepState {
  const kindsKey = kinds.join(",");
  const [state, setState] = useState<PrepState>(() => initial(category, enabled, kinds));

  useEffect(() => {
    const selected = kindsKey.split(",") as ContentKind[];

    if (!enabled || category === "") {
      setState({ items: [], status: "idle" });
      return;
    }

    const hit = fresh(category, selected);
    if (hit) {
      setState({ items: hit, status: "ready" });
      return;
    }

    const controller = new AbortController();
    setState((current) => (current.items.length > 0 ? current : { items: [], status: "loading" }));

    fetchContent({ kinds: selected, category, limit: LIMIT }, controller.signal)
      .then((page) => {
        cache.set(keyOf(category, selected), { at: Date.now(), items: page.items });
        setState({ items: page.items, status: "ready" });
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        /** Un rubro sin contenido o una API caída no rompen la vista: no se
         * muestra nada, que es mejor que una caja vacía. */
        setState({ items: [], status: "error" });
      });

    return () => controller.abort();
  }, [category, enabled, kindsKey]);

  return state;
}
