import { Loader2, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type MyServices as MyServicesData,
  deleteService,
  fetchMyServices,
} from "../../lib/account.ts";
import { SERVICE_STATUS_LABEL, type Service } from "../../lib/services.ts";
import { mutedChip } from "../../lib/styles.ts";

interface MyServicesProps {
  /** Sube cada vez que algo se guarda, para volver a pedir la lista. */
  reload: number;
  onEdit: (service: Service) => void;
  onNew: () => void;
}

/** Lo que publicó quien está en sesión, con el estado de cada uno dicho como
 * es: un borrador no se ve, uno en revisión todavía tampoco. */
export function MyServices({ reload, onEdit, onNew }: MyServicesProps) {
  const [data, setData] = useState<MyServicesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchMyServices()
      .then((mine) => {
        if (alive) setData(mine);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [reload]);

  const remove = (service: Service) => {
    setBusyId(service.id);
    deleteService(service.id)
      .then(() =>
        setData((current) =>
          current
            ? { ...current, services: current.services.filter((entry) => entry.id !== service.id) }
            : current,
        ),
      )
      .catch(() => {})
      .finally(() => setBusyId(null));
  };

  if (loading && data === null) {
    return <p className="text-xs text-muted">Cargando lo tuyo…</p>;
  }

  const services = data?.services ?? [];
  const full = data !== null && services.length >= data.max;

  return (
    <div className="rounded-2xl border border-sky/50 bg-surface p-5 shadow-[var(--shadow-hairline)]">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">Lo que publicaste</h2>
        <button
          className="rounded-xl border border-sky/70 bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-brand hover:bg-mist disabled:opacity-60"
          disabled={full}
          type="button"
          onClick={onNew}
        >
          Publicar otro
        </button>
      </div>

      {full ? (
        <p className="mt-1 text-xs text-muted">
          Llegaste al tope de {data?.max} servicios por cuenta. Borrá alguno para publicar otro.
        </p>
      ) : null}

      {services.length === 0 ? (
        <p className="mt-3 text-sm text-soft">Todavía no publicaste nada.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {services.map((service) => (
            <li
              key={service.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-sky/50 px-3 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{service.title}</span>
              <span className={mutedChip}>{SERVICE_STATUS_LABEL[service.status]}</span>
              <button
                aria-label={`Editar ${service.title}`}
                className="rounded-lg p-2 text-muted transition-colors hover:text-ink"
                type="button"
                onClick={() => onEdit(service)}
              >
                <Pencil aria-hidden className="size-4" />
              </button>
              <button
                aria-label={`Borrar ${service.title}`}
                className="rounded-lg p-2 text-muted transition-colors hover:text-ink disabled:opacity-60"
                disabled={busyId === service.id}
                type="button"
                onClick={() => remove(service)}
              >
                {busyId === service.id ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : (
                  <Trash2 aria-hidden className="size-4" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
