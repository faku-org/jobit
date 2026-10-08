import { useEffect, useState } from "react";
import type { Company } from "./api.ts";
import { checkSession } from "./api.ts";
import { Dashboard } from "./Dashboard.tsx";
import { Login } from "./Login.tsx";

/**
 * La cookie es httpOnly, así que la página no puede mirarla: le pregunta a la
 * API qué empresa está detrás de la sesión y con eso decide qué pintar.
 */
export function Panel() {
  const [company, setCompany] = useState<Company | null | undefined>(undefined);

  useEffect(() => {
    checkSession()
      .then((session) => setCompany(session.company))
      .catch(() => setCompany(null));
  }, []);

  /* Ni la entrada ni el panel hasta saber cuál de los dos va: pintar el login
     y sacarlo un instante después se lee como un parpadeo. */
  if (company === undefined) return <div className="min-h-svh" />;

  return company ? (
    <Dashboard company={company} onLeft={() => setCompany(null)} />
  ) : (
    <Login onEntered={setCompany} />
  );
}
