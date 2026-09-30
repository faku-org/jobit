import { useEffect, useState } from "react";
import { mailLanding } from "../lib/session.ts";
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
  /** Si se llegó desde un enlace de correo. Un reset va directo a la
   * contraseña nueva aunque haya sesión: resetear cierra todas igual. */
  const [landing] = useState(mailLanding);
  const [note, setNote] = useState(
    landing?.kind === "verified"
      ? "Listo: el correo de contacto quedó confirmado."
      : landing?.kind === "expired"
        ? "Ese enlace ya venció o se usó. Pedí uno nuevo desde la cuenta de la empresa."
        : "",
  );

  useEffect(() => {
    checkSession()
      .then((session) => setCompany(session.company))
      .catch(() => setCompany(null));
  }, []);

  /* Ni la entrada ni el panel hasta saber cuál de los dos va: pintar el login
     y sacarlo un instante después se lee como un parpadeo. */
  if (company === undefined) return <div className="min-h-svh" />;

  const reset = landing?.kind === "reset" ? landing.token : undefined;

  return (
    <>
      {note ? (
        <div className="mx-auto mt-4 flex max-w-3xl items-start gap-3 rounded-xl border border-sky/60 bg-surface px-4 py-3 text-sm text-soft">
          <p className="flex-1">{note}</p>
          <button
            className="text-xs text-muted hover:text-ink"
            type="button"
            onClick={() => setNote("")}
          >
            Cerrar
          </button>
        </div>
      ) : null}
      {company && !reset ? (
        <Dashboard company={company} onLeft={() => setCompany(null)} />
      ) : (
        <Login resetToken={reset} onEntered={setCompany} />
      )}
    </>
  );
}
