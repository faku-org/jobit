import { useEffect, useState } from "react";
import { isAbortError } from "../lib/api.ts";
import { type Service, fetchService } from "../lib/services.ts";
import { setSharedServiceSlug, sharedServiceSlug } from "../lib/share.ts";

/**
 * Ata el servicio abierto a la barra de direcciones en los dos sentidos, como
 * useJobLink con las ofertas: un enlace compartido abre su ficha al llegar, y
 * abrir una ficha la deja en la barra para poder pasarla.
 */
export function useServiceLink(
  open: Service | null,
  onOpen: (service: Service) => void,
): { resolving: boolean } {
  /** Se lee una sola vez al montar: el efecto de abajo reescribe la barra. */
  const [linked] = useState(sharedServiceSlug);
  const [resolving, setResolving] = useState(linked !== null);

  useEffect(() => {
    if (linked === null) return;

    const controller = new AbortController();
    fetchService(linked, controller.signal)
      .then((service) => {
        onOpen(service);
        setResolving(false);
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return;
        setResolving(false);
      });

    return () => controller.abort();
  }, [linked, onOpen]);

  useEffect(() => {
    if (resolving) return;
    setSharedServiceSlug(open?.slug ?? null);
  }, [open, resolving]);

  return { resolving };
}
