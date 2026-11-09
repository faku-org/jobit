import { useEffect, useState } from "react";
import {
  type Company,
  EMAIL_KIND_LABEL,
  EMAIL_KINDS,
  type CompanyEmailKind,
  checkSession,
} from "./api.ts";
import { Dashboard } from "./Dashboard.tsx";
import { Login, ResetAccess } from "./Login.tsx";

/** El enlace de verificación vuelve a `/empresas?verificado=<tipo>`; el de
 * recuperación llega con el id y el token. */
function verificationNotice(value: string): string {
  if (value === "error") return "No pudimos verificar el correo: el enlace venció o no vale.";
  const kind = EMAIL_KINDS.find((candidate) => candidate === value) as
    | CompanyEmailKind
    | undefined;
  return kind
    ? `Correo de ${EMAIL_KIND_LABEL[kind].toLowerCase()} verificado.`
    : "Correo verificado.";
}

function readReset(): { companyId: string; token: string } | null {
  const raw = new URLSearchParams(window.location.search).get("recuperar");
  if (!raw) return null;
  const separator = raw.indexOf(".");
  if (separator <= 0) return null;
  return { companyId: raw.slice(0, separator), token: raw.slice(separator + 1) };
}

/**
 * La cookie es httpOnly, así que la página no puede mirarla: le pregunta a la
 * API qué empresa está detrás de la sesión y con eso decide qué pintar. Si la
 * URL trae un enlace de recuperación, esa pantalla gana.
 */
export function Panel() {
  const [reset, setReset] = useState(readReset);
  const [notice] = useState(() => {
    const verified = new URLSearchParams(window.location.search).get("verificado");
    return verified ? verificationNotice(verified) : undefined;
  });
  const [company, setCompany] = useState<Company | null | undefined>(undefined);

  useEffect(() => {
    if (reset) return;
    checkSession()
      .then((session) => setCompany(session.company))
      .catch(() => setCompany(null));
  }, [reset]);

  /* El enlace de recuperación se limpia de la barra de direcciones al terminar:
     si no, recargar pediría el mismo token ya consumido. */
  const finishReset = () => {
    window.history.replaceState(null, "", "/empresas");
    setCompany(undefined);
    setReset(null);
  };

  if (reset) {
    return <ResetAccess companyId={reset.companyId} token={reset.token} onDone={finishReset} />;
  }

  /* Ni la entrada ni el panel hasta saber cuál de los dos va: pintar el login
     y sacarlo un instante después se lee como un parpadeo. */
  if (company === undefined) return <div className="min-h-svh" />;

  return company ? (
    <Dashboard company={company} onLeft={() => setCompany(null)} />
  ) : (
    <Login onEntered={setCompany} notice={notice} />
  );
}
