import { useEffect, useState } from "react";
import { type SessionUser, currentUser } from "../lib/session.ts";

/**
 * Quién está adentro, si hay alguien. Se pregunta una vez al montar: la cookie
 * es HttpOnly, así que el estado real solo lo sabe el servidor.
 */
export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    currentUser()
      .then((found) => {
        if (alive) setUser(found);
      })
      .catch(() => {
        /* Sin API, la cuenta queda como si no hubiera sesión. */
      })
      .finally(() => {
        if (alive) setReady(true);
      });

    return () => {
      alive = false;
    };
  }, []);

  return { user, ready, setUser };
}
