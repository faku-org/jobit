import type { ContentItem, ContentKind } from "@jobit/worker/content/types";
import { useEffect, useState } from "react";
import { fetchContent } from "../lib/content.ts";

/**
 * El contenido de preparación de un rubro: preguntas y ejercicios. Se pide una
 * sola vez por rubro y se guarda en memoria mientras dure la pestaña, así abrir
 * otra oferta del mismo rubro no vuelve a la red.
 *
 * `enabled` es lo que lo ata al momento: solo se pide cuando la oferta ya está
 * en seguimiento, no al abrir cualquier ficha.
 */
const KINDS: ContentKind[] = ["faq", "exercise"];
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

function fresh(category: string): ContentItem[] | null {
  const hit = cache.get(category);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.items;
  return null;
}

function initial(category: string, enabled: boolean): PrepState {
  if (!enabled || category === "") return { items: [], status: "idle" };
  const hit = fresh(category);
  return hit ? { items: hit, status: "ready" } : { items: [], status: "loading" };
}

export function usePrep(category: string, enabled: boolean): PrepState {
  const [state, setState] = useState<PrepState>(() => initial(category, enabled));

  useEffect(() => {
    if (!enabled || category === "") {
      setState({ items: [], status: "idle" });
      return;
    }

    const hit = fresh(category);
    if (hit) {
      setState({ items: hit, status: "ready" });
      return;
    }

    const controller = new AbortController();
    setState((current) => (current.items.length > 0 ? current : { items: [], status: "loading" }));

    fetchContent({ kinds: KINDS, category, limit: LIMIT }, controller.signal)
      .then((page) => {
        cache.set(category, { at: Date.now(), items: page.items });
        setState({ items: page.items, status: "ready" });
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        /** Un rubro sin contenido o una API caída no rompen la ficha: no se
         * muestra nada, que es mejor que una caja vacía. */
        setState({ items: [], status: "error" });
      });

    return () => controller.abort();
  }, [category, enabled]);

  return state;
}
