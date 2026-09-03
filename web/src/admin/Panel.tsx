import { useEffect, useState } from "react";
import { Admin } from "./Admin.tsx";
import { Login } from "./Login.tsx";
import { checkSession } from "./api.ts";

/**
 * La cookie es httpOnly, así que la página no puede mirarla: le pregunta a la
 * API si la sesión sigue abierta y con eso decide qué pintar.
 */
export function Panel() {
  const [entered, setEntered] = useState<boolean | null>(null);

  useEffect(() => {
    checkSession()
      .then(() => setEntered(true))
      .catch(() => setEntered(false));
  }, []);

  /* Ni la entrada ni el panel hasta saber cuál de los dos va: pintar el login
     y sacarlo un instante después se lee como un parpadeo. */
  if (entered === null) return <div className="min-h-svh" />;

  return entered ? (
    <Admin onLeft={() => setEntered(false)} />
  ) : (
    <Login onEntered={() => setEntered(true)} />
  );
}
