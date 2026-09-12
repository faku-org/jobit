import { useCallback, useEffect, useState } from "react";
import { type Decision, type QueueItem, decideService, listServiceQueue } from "./api.ts";
import { ServiceRow } from "./ServiceRow.tsx";

interface Props {
  onFail: (cause: unknown) => void;
}

/**
 * La cola de moderación. Llega ordenada de la API: primero lo denunciado,
 * después lo que el filtro puso más arriba. Acá no se reordena nada, para que
 * lo que se ve sea lo que el filtro dijo.
 */
export function Services({ onFail }: Props) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [counts, setCounts] = useState({ pending: 0, reported: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      listServiceQueue()
        .then((data) => {
          setQueue(data.queue);
          setCounts(data.counts);
        })
        .catch(onFail)
        .finally(() => setLoading(false)),
    [onFail],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const decide = (id: string, decision: Decision) => {
    setBusyId(id);
    decideService(id, decision)
      .then(refresh)
      .catch(onFail)
      .finally(() => setBusyId(null));
  };

  return (
    <>
      <p className="text-xs text-muted">
        {counts.pending} {counts.pending === 1 ? "servicio esperando" : "servicios esperando"}
        {counts.reported > 0 ? ` · ${counts.reported} con denuncias` : ""}
      </p>

      {loading ? (
        <p className="mt-6 text-xs text-muted">Cargando…</p>
      ) : queue.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-sky/70 px-4 py-8 text-center text-xs text-muted">
          No hay nada para revisar.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {queue.map((item) => (
            <ServiceRow
              key={item.service.id}
              busy={busyId === item.service.id}
              item={item}
              onDecide={(decision) => decide(item.service.id, decision)}
            />
          ))}
        </ul>
      )}
    </>
  );
}
