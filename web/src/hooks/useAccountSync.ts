import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import type { SessionUser } from "../lib/session.ts";
import { disableSync, mergeSynced, pullSync, pushSync } from "../lib/sync.ts";
import { type JobPrefs, readSynced } from "./useJobPrefs.ts";

export interface AccountSync {
  /** Si la cuenta tiene el sync prendido. */
  enabled: boolean;
  /** Si ya se preguntó: hasta entonces el interruptor no miente. */
  known: boolean;
  busy: boolean;
  error: string;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

/** Lo que se espera después del último cambio antes de mandarlo: escribir en
 * cada tecla sería un viaje por letra. */
const DEBOUNCE_MS = 1500;

/**
 * Llevar los datos de la persona entre navegadores, atado a la cuenta.
 *
 * Es opt-in: si la cuenta no tiene nada guardado, no se manda nada hasta que
 * alguien lo prenda. Al entrar, si ya estaba prendido, se baja, se mezcla con
 * lo de este navegador y se vuelve a subir lo mezclado.
 */
export function useAccountSync(
  prefs: JobPrefs,
  user: SessionUser | null,
  ready: boolean,
): AccountSync {
  const { synced, applySynced } = prefs;
  const [enabled, setEnabled] = useState(false);
  const [known, setKnown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lastSent = useRef("");
  /** Solo el id: la identidad del objeto cambia al editar la cuenta y no hay
   * que volver a bajar por eso. */
  const userId = user?.id ?? null;

  /** Se lee el estado más nuevo sin que el efecto dependa de él: si no, cada
   * cambio dispararía otra bajada. */
  const mergeRemote = useEffectEvent((payload: unknown) => {
    if (payload) applySynced(mergeSynced(synced, readSynced(payload)));
    setEnabled(true);
  });

  useEffect(() => {
    if (!ready) return;
    if (!userId) {
      setEnabled(false);
      setKnown(true);
      lastSent.current = "";
      return;
    }

    let alive = true;
    setKnown(false);
    void pullSync().then((result) => {
      if (!alive) return;
      setKnown(true);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!result.value.enabled) return;
      mergeRemote(result.value.payload);
    });

    return () => {
      alive = false;
    };
  }, [ready, userId]);

  /** Mientras está prendido, cada cambio se manda con una pausa. */
  useEffect(() => {
    if (!enabled || !known || !user) return;
    const payload = JSON.stringify(synced);
    if (payload === lastSent.current) return;

    const timer = setTimeout(() => {
      lastSent.current = payload;
      void pushSync(synced);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [enabled, known, user, synced]);

  const enable = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const remote = await pullSync();
      if (!remote.ok) {
        setError(remote.error);
        return;
      }
      const merged = remote.value.payload
        ? mergeSynced(synced, readSynced(remote.value.payload))
        : synced;
      applySynced(merged);
      lastSent.current = JSON.stringify(merged);

      const sent = await pushSync(merged);
      if (!sent.ok) {
        setError(sent.error);
        return;
      }
      setKnown(true);
      setEnabled(true);
    } finally {
      setBusy(false);
    }
  }, [synced, applySynced]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await disableSync();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      lastSent.current = "";
      setEnabled(false);
    } finally {
      setBusy(false);
    }
  }, []);

  return { enabled, known, busy, error, enable, disable };
}
