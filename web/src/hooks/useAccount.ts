import { useCallback, useEffect, useState } from "react";
import { type Account, NoSession, fetchMe, logout as sendLogout } from "../lib/account.ts";

export interface AccountState {
  account: Account | null;
  /** Mientras no se sabe si hay sesión, el alta de un servicio no se ofrece
   * ni se niega: se espera, que es medio segundo y no una pantalla en falso. */
  checking: boolean;
  setAccount: (account: Account | null) => void;
  logout: () => void;
}

/**
 * La sesión de quien publica. Vive acá y no en el almacenamiento del
 * navegador: la cookie es del servidor, así que la única fuente de verdad es
 * preguntarle a la API quién soy.
 */
export function useAccount(enabled: boolean): AccountState {
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(false);
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    if (!enabled || asked) return;

    setAsked(true);
    setChecking(true);
    fetchMe()
      .then((me) => setAccount(me.user))
      .catch((cause: unknown) => {
        /** Sin sesión no es un error: es no haber entrado todavía. */
        if (!(cause instanceof NoSession)) setAccount(null);
      })
      .finally(() => setChecking(false));
  }, [enabled, asked]);

  const logout = useCallback(() => {
    setAccount(null);
    void sendLogout().catch(() => {});
  }, []);

  return { account, checking, setAccount, logout };
}
