import { useEffect, useState } from "react";
import { isAbortError } from "../lib/api.ts";
import {
  type Rate,
  type Service,
  type ServiceFilters,
  type ServicesMeta,
  fetchServices,
  fetchServicesMeta,
  servicesQuery,
} from "../lib/services.ts";

type Status = "loading" | "loadingMore" | "ready" | "error";

interface ServicesState {
  services: Service[];
  total: number;
  status: Status;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  /** La tasa con la que la API comparó precios, para poder decirlo. */
  rate: Rate | null;
  priceSort: boolean;
}

interface State {
  /** La consulta ya armada, que es lo que identifica a una lista. */
  query: string;
  filters: ServiceFilters;
  services: Service[];
  total: number;
  /** Desde dónde falta pedir; null es que no hay nada pendiente. */
  pending: number | null;
  status: Status;
  error: string | null;
  rate: Rate | null;
  priceSort: boolean;
}

const begin = (query: string, filters: ServiceFilters): State => ({
  query,
  filters,
  services: [],
  total: 0,
  pending: 0,
  status: "loading",
  error: null,
  rate: null,
  priceSort: false,
});

/**
 * La lista de servicios. No guarda páginas como la de ofertas: la sección se
 * recorre mirando y no se vuelve a ella con una lista armada, así que una
 * caché acá sería complejidad sin nada que ahorrar.
 */
export function useServices(filters: ServiceFilters, enabled = true): ServicesState {
  const query = servicesQuery(filters);
  const [state, setState] = useState<State>(() => begin(query, filters));

  if (state.query !== query) setState(begin(query, filters));

  const { query: asked, filters: sent, pending } = state;

  useEffect(() => {
    if (!enabled || pending === null) return;

    const controller = new AbortController();

    fetchServices(servicesQuery(sent, pending), controller.signal)
      .then((page) => {
        setState((current) => {
          if (current.query !== asked) return current;
          return {
            ...current,
            services: pending === 0 ? page.services : [...current.services, ...page.services],
            total: page.total,
            pending: null,
            status: "ready",
            error: null,
            rate: page.rate,
            priceSort: page.price_sort,
          };
        });
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return;
        setState((current) => {
          if (current.query !== asked) return current;
          return {
            ...current,
            pending: null,
            status: "error",
            error: cause instanceof Error ? cause.message : "Error desconocido",
          };
        });
      });

    return () => controller.abort();
  }, [asked, sent, pending, enabled]);

  return {
    services: state.services,
    total: state.total,
    status: state.status,
    error: state.error,
    hasMore: state.services.length < state.total,
    rate: state.rate,
    priceSort: state.priceSort,
    loadMore: () =>
      setState((current) =>
        current.pending !== null
          ? current
          : { ...current, status: "loadingMore", pending: current.services.length },
      ),
  };
}

/** Las facetas de los filtros, una sola vez por visita a la sección. */
export function useServicesMeta(enabled: boolean): ServicesMeta | null {
  const [meta, setMeta] = useState<ServicesMeta | null>(null);

  useEffect(() => {
    if (!enabled || meta !== null) return;

    const controller = new AbortController();
    fetchServicesMeta(controller.signal)
      .then(setMeta)
      .catch(() => {});
    return () => controller.abort();
  }, [enabled, meta]);

  return meta;
}
