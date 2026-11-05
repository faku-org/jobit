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
 * Los conjuntos de tipos son constantes porque son la clave de la caché: pasar
 * un array nuevo cada render la vaciaría sola.
 */
export const PRACTICE_KINDS: ContentKind[] = ["faq", "exercise"];
export const INTERVIEW_KINDS: ContentKind[] = ["faq", "topic"];
/** Todo lo de preparación: preguntas, habilidades y ejercicios. */
export const ALL_PREP_KINDS: ContentKind[] = ["faq", "topic", "exercise"];
/** Recursos del rubro: plataformas, documentación, cursos, videos y podcasts. */
export const RESOURCE_KINDS: ContentKind[] = ["resource"];

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

const keyOf = (category: string, kinds: ContentKind[], limit: number): string =>
  `${kinds.join(",")}:${limit}:${category}`;

function fresh(category: string, kinds: ContentKind[], limit: number): ContentItem[] | null {
  const hit = cache.get(keyOf(category, kinds, limit));
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.items;
  return null;
}

function initial(
  category: string,
  enabled: boolean,
  kinds: ContentKind[],
  limit: number,
): PrepState {
  if (!enabled || category === "") return { items: [], status: "idle" };
  const hit = fresh(category, kinds, limit);
  return hit ? { items: hit, status: "ready" } : { items: [], status: "loading" };
}

export function usePrep(
  category: string,
  enabled: boolean,
  kinds: ContentKind[] = PRACTICE_KINDS,
  limit: number = LIMIT,
): PrepState {
  const kindsKey = kinds.join(",");
  const [state, setState] = useState<PrepState>(() => initial(category, enabled, kinds, limit));

  useEffect(() => {
    const selected = kindsKey.split(",") as ContentKind[];

    if (!enabled || category === "") {
      setState({ items: [], status: "idle" });
      return;
    }

    const hit = fresh(category, selected, limit);
    if (hit) {
      setState({ items: hit, status: "ready" });
      return;
    }

    const controller = new AbortController();
    setState((current) => (current.items.length > 0 ? current : { items: [], status: "loading" }));

    fetchContent({ kinds: selected, category, limit }, controller.signal)
      .then((page) => {
        cache.set(keyOf(category, selected, limit), { at: Date.now(), items: page.items });
        setState({ items: page.items, status: "ready" });
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        /** Un rubro sin contenido o una API caída no rompen la vista: no se
         * muestra nada, que es mejor que una caja vacía. */
        setState({ items: [], status: "error" });
      });

    return () => controller.abort();
  }, [category, enabled, kindsKey, limit]);

  return state;
}
