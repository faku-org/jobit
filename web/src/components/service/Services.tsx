import { Loader2, Plus, SearchX, TriangleAlert, UserRound } from "lucide-react";
import { m } from "motion/react";
import { useState } from "react";
import { useAccount } from "../../hooks/useAccount.ts";
import { useDebounced } from "../../hooks/useDebounced.ts";
import { useServices, useServicesMeta } from "../../hooks/useServices.ts";
import { fadeUpTransition, stagger } from "../../lib/motion.ts";
import {
  EMPTY_SERVICE_FILTERS,
  type Service,
  type ServiceFilters as Filters,
  hasActiveServiceFilters,
  pluralServices,
} from "../../lib/services.ts";
import { FadeUp } from "../ui/FadeUp.tsx";
import { AccountPanel } from "./AccountPanel.tsx";
import { MyServices } from "./MyServices.tsx";
import { ServiceCard } from "./ServiceCard.tsx";
import { ServiceFilters } from "./ServiceFilters.tsx";
import { ServiceForm } from "./ServiceForm.tsx";

interface ServicesProps {
  /** La sección está a la vista: nada se pide de fondo desde otra pestaña. */
  active: boolean;
  onOpen: (service: Service) => void;
}

/** Qué ocupa la parte de arriba de la sección; "none" es solo la lista. */
type Panel = "none" | "account" | "form" | "mine";

function Skeleton() {
  return (
    <div aria-label="Cargando servicios" className="space-y-3" role="status">
      {Array.from({ length: 4 }, (_, index) => (
        <FadeUp key={index} delay={stagger(index)}>
          <div className="animate-pulse rounded-2xl border border-sky/50 bg-surface p-5">
            <div className="h-4 w-2/5 rounded-full bg-sky/60" />
            <div className="mt-3 h-3 w-3/5 rounded-full bg-mist" />
            <div className="mt-4 flex gap-2">
              <div className="h-6 w-24 rounded-full bg-mist" />
              <div className="h-6 w-20 rounded-full bg-mist" />
            </div>
          </div>
        </FadeUp>
      ))}
    </div>
  );
}

/**
 * La sección Servicios: lo que la gente ofrece hacer, que no es una oferta de
 * empleo y por eso tiene su propia lista, sus propios filtros y su propia alta.
 */
export function Services({ active, onOpen }: ServicesProps) {
  const [filters, setFilters] = useState<Filters>(EMPTY_SERVICE_FILTERS);
  const [panel, setPanel] = useState<Panel>("none");
  const [editing, setEditing] = useState<Service | null>(null);
  /** Sube al guardar, para que la lista de lo propio se vuelva a pedir. */
  const [saved, setSaved] = useState(0);
  const [note, setNote] = useState("");

  const account = useAccount(active);
  const meta = useServicesMeta(active);
  const debounced = useDebounced(filters.q);
  const list = useServices({ ...filters, q: debounced }, active);

  const isDirty = hasActiveServiceFilters(filters);

  /** Publicar pide sesión, así que la cuenta aparece acá adentro y no como
   * una sección aparte: es un paso del alta, no un lugar al que ir. */
  const publish = () => {
    setNote("");
    setEditing(null);
    setPanel(account.account ? "form" : "account");
  };

  return (
    <div className="mt-6 space-y-6">
      <FadeUp>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-relaxed text-muted">
            Lo que la gente ofrece hacer: oficios, clases, trabajo por cuenta propia. Se revisa
            antes de publicarse.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {account.account ? (
              <button
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky/70 bg-surface px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-brand hover:bg-mist"
                type="button"
                onClick={() => {
                  setNote("");
                  setPanel(panel === "mine" ? "none" : "mine");
                }}
              >
                <UserRound aria-hidden className="size-3.5" />
                {account.account.display_name}
              </button>
            ) : null}

            <m.button
              className="inline-flex items-center gap-1.5 rounded-xl bg-panel px-3.5 py-2 text-xs font-medium text-onpanel transition-colors hover:bg-brand disabled:opacity-60"
              disabled={account.checking}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={publish}
            >
              {account.checking ? (
                <Loader2 aria-hidden className="size-3.5 animate-spin" />
              ) : (
                <Plus aria-hidden className="size-3.5" />
              )}
              Publicar un servicio
            </m.button>
          </div>
        </div>
      </FadeUp>

      {note ? (
        <FadeUp>
          <p className="rounded-xl border border-sky/60 bg-mist px-3.5 py-2.5 text-xs leading-relaxed text-soft">
            {note}
          </p>
        </FadeUp>
      ) : null}

      {panel === "account" ? (
        <FadeUp>
          <AccountPanel
            reason="Publicar necesita una cuenta: es lo que te deja volver a editar lo tuyo."
            onCancel={() => setPanel("none")}
            onReady={(ready) => {
              account.setAccount(ready);
              setPanel("form");
            }}
          />
        </FadeUp>
      ) : null}

      {panel === "form" ? (
        <FadeUp>
          <ServiceForm
            key={editing?.id ?? "nuevo"}
            {...(editing ? { service: editing } : {})}
            onCancel={() => setPanel("none")}
            onSaved={(service) => {
              setSaved((current) => current + 1);
              setEditing(null);
              setPanel("mine");
              setNote(
                service.status === "pending"
                  ? "Quedó en revisión. Cuando alguien lo apruebe aparece en la lista."
                  : service.status === "published"
                    ? "Quedó publicado."
                    : "Quedó guardado como borrador: nadie lo ve hasta que lo mandes a revisión.",
              );
            }}
          />
        </FadeUp>
      ) : null}

      {panel === "mine" && account.account ? (
        <FadeUp>
          <div className="space-y-2">
            <MyServices
              reload={saved}
              onEdit={(service) => {
                setEditing(service);
                setPanel("form");
              }}
              onNew={() => {
                setEditing(null);
                setPanel("form");
              }}
            />
            <button
              className="text-xs font-medium text-muted transition-colors hover:text-ink"
              type="button"
              onClick={() => {
                account.logout();
                setPanel("none");
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </FadeUp>
      ) : null}

      <FadeUp delay={0.05}>
        <ServiceFilters
          categories={meta?.categories ?? []}
          departments={meta?.departments ?? []}
          filters={filters}
          isDirty={isDirty}
          priceSort={list.priceSort}
          rate={list.rate}
          onChange={setFilters}
          onReset={() => setFilters(EMPTY_SERVICE_FILTERS)}
        />
      </FadeUp>

      <div className="-mb-3 flex h-5 items-center px-1 text-xs text-muted">
        {list.status === "ready" || list.status === "loadingMore" ? (
          <m.span
            key={`${list.total}-${list.services.length}`}
            animate={{ opacity: 1 }}
            initial={{ opacity: 0 }}
            transition={fadeUpTransition}
          >
            {pluralServices(list.total)}
            {list.services.length < list.total ? ` · mostrando ${list.services.length}` : ""}
          </m.span>
        ) : null}
      </div>

      {list.status === "loading" ? <Skeleton /> : null}

      {list.status === "error" ? (
        <div className="rounded-2xl border border-brand bg-mist px-6 py-12 text-center">
          <TriangleAlert aria-hidden className="mx-auto size-7 text-brand" />
          <p className="mt-4 text-[15px] font-medium text-ink">
            No se pudieron cargar los servicios
          </p>
          <p className="mt-1 text-sm text-soft">{list.error}</p>
        </div>
      ) : null}

      {list.status !== "loading" && list.status !== "error" && list.services.length === 0 ? (
        <FadeUp>
          <div className="rounded-2xl border border-dashed border-sky bg-surface/60 px-6 py-16 text-center">
            <SearchX aria-hidden className="mx-auto size-7 text-brand" />
            <p className="mt-4 text-[15px] font-medium text-ink">
              {isDirty ? "No hay servicios para estos filtros" : "Todavía no hay servicios"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {isDirty
                ? "Probá ampliar la búsqueda o quitar filtros."
                : "La sección recién arranca. Si ofrecés algo, podés ser el primero."}
            </p>
            {isDirty ? (
              <button
                className="mt-5 rounded-xl border border-sky/70 bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-mist"
                type="button"
                onClick={() => setFilters(EMPTY_SERVICE_FILTERS)}
              >
                Limpiar filtros
              </button>
            ) : null}
          </div>
        </FadeUp>
      ) : null}

      {list.services.length > 0 ? (
        <div className="isolate space-y-3">
          {list.services.map((service, index) => (
            <FadeUp key={service.id} delay={stagger(index)}>
              <ServiceCard service={service} onOpen={onOpen} />
            </FadeUp>
          ))}
        </div>
      ) : null}

      {list.hasMore ? (
        <div className="flex justify-center">
          <m.button
            className="inline-flex items-center gap-2 rounded-xl border border-sky/70 bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-mist disabled:opacity-60"
            disabled={list.status === "loadingMore"}
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={list.loadMore}
          >
            {list.status === "loadingMore" ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : null}
            Ver más servicios
          </m.button>
        </div>
      ) : null}
    </div>
  );
}
