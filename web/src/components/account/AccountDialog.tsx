import {
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { Copy, Download, X } from "lucide-react";
import { m } from "motion/react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { islandTransition } from "../../lib/motion.ts";
import { iconButtonClass } from "../../lib/styles.ts";
import {
  type SessionUser,
  addPasskey,
  deleteMe,
  disableTotp,
  login,
  passkeyOptions,
  patchMe,
  recover,
  register,
  removePasskey,
  requestReset,
  resetPassword,
  submitPasskey,
  submitTotp,
} from "../../lib/session.ts";
import {
  accountDangerClass,
  accountFieldClass,
  accountPrimaryClass,
  accountQuietClass,
} from "./controls.ts";

/** Lo que tira el navegador cuando la persona cancela la llave o se le pasa el
 * tiempo: no es un error de la cuenta y no hay que mostrarlo como tal. */
const passkeyProblem = (cause: unknown): string =>
  cause instanceof Error && cause.name === "NotAllowedError"
    ? "Se canceló o se venció el tiempo. Probá de nuevo."
    : "Este navegador no pudo usar la llave. Probá con otro dispositivo o con un código de respaldo.";

/**
 * Cada trámite de la cuenta es una pantalla del mismo modal. Nada de esto se
 * dibuja dentro del panel: crear, entrar o borrar la cuenta son decisiones, no
 * ajustes, y merecen una ventana que tape el resto mientras se toman.
 */
export type AccountAction =
  | "register"
  | "login"
  | "recover"
  | "forgot"
  | "reset"
  | "password"
  | "email"
  | "passkey-add"
  | "passkey-remove"
  | "totp-off"
  | "delete";

/** `passkey` es el segundo paso del login; `sent`, la respuesta a un pedido de
 * reset, que dice lo mismo exista o no la cuenta. */
type View = AccountAction | "totp" | "passkey" | "codes" | "sent";

/** Lo que algunas pantallas necesitan traer de afuera: el token de un enlace
 * de reset, o qué llave se quiere sacar. */
export interface AccountContext {
  token?: string;
  passkeyId?: string;
  passkeyName?: string;
}

interface AccountDialogProps {
  action: AccountAction;
  context?: AccountContext;
  user: SessionUser | null;
  onClose: () => void;
  /** La sesión cambió (alta, ingreso o borrado): el panel se entera acá. */
  onUser: (user: SessionUser | null) => void;
  /** Cambió algo del perfil guardado: se vuelve a leer sin adivinar. */
  onRefresh: () => Promise<void>;
}

const HEADING: Record<View, { title: string; hint: string }> = {
  register: {
    title: "Crear cuenta",
    hint: "Se guarda lo mínimo: un handle, tu nombre visible, una contraseña y, si querés, un correo.",
  },
  login: { title: "Entrar", hint: "Con tu handle y tu contraseña." },
  totp: {
    title: "Segundo paso",
    hint: "Poné el código de seis dígitos de tu app de autenticación.",
  },
  passkey: {
    title: "Segundo paso",
    hint: "Tu cuenta tiene una llave de acceso: usala para terminar de entrar.",
  },
  forgot: {
    title: "Olvidé mi contraseña",
    hint: "Si tu cuenta tiene un correo verificado, te mandamos un enlace para cambiarla.",
  },
  sent: {
    title: "Revisá tu correo",
    hint: "El enlace vence en 30 minutos y sirve una sola vez.",
  },
  reset: {
    title: "Contraseña nueva",
    hint: "Al guardarla se cierran todas las sesiones abiertas de la cuenta.",
  },
  recover: {
    title: "Recuperar el acceso",
    hint: "Con tu handle y uno de los códigos de respaldo que guardaste.",
  },
  codes: {
    title: "Tus códigos de respaldo",
    hint: "Se muestran una sola vez. Guardalos en un lugar seguro.",
  },
  password: { title: "Cambiar contraseña", hint: "Para cambiarla hace falta la actual." },
  email: {
    title: "Tu correo",
    hint: "Para recuperar la cuenta y para los avisos. Va cifrado en el servidor y solo se usa para escribirte. Los correos de JobIt no llevan tus datos: dicen que hay algo y te traen acá.",
  },
  "passkey-add": {
    title: "Agregar una llave de acceso",
    hint: "La huella, la cara o el PIN de tu dispositivo, o una llave física. JobIt guarda solo la parte pública: con una copia de la base no se entra a ninguna cuenta.",
  },
  "passkey-remove": {
    title: "Sacar una llave",
    hint: "Pide tu contraseña, para que nadie frente a una sesión abierta pueda desarmar el segundo paso.",
  },
  "totp-off": {
    title: "Apagar los códigos de seis dígitos",
    hint: "Pide tu contraseña. Mejor todavía: agregá una llave de acceso, que los reemplaza y los apaga sola.",
  },
  delete: {
    title: "Borrar mi cuenta",
    hint: "Se borra de verdad y no se puede deshacer.",
  },
};

const SUBMIT_LABEL: Record<View, string> = {
  register: "Crear cuenta",
  login: "Entrar",
  totp: "Confirmar",
  passkey: "Usar mi llave",
  recover: "Recuperar",
  forgot: "Mandar el enlace",
  sent: "Listo",
  reset: "Guardar",
  codes: "Ya los guardé",
  password: "Guardar",
  email: "Guardar",
  "passkey-add": "Crear la llave",
  "passkey-remove": "Sacar la llave",
  "totp-off": "Apagar",
  delete: "Borrar todo",
};

/** Los códigos en un archivo: es la forma en que de verdad se guardan. Copiarlos
 * a mano es donde alguien se equivoca y después no puede entrar. */
function downloadCodes(codes: string[], handle: string): void {
  const head = [
    "JobIt — códigos de respaldo",
    handle ? `Cuenta: @${handle}` : "",
    "",
    "Cada código sirve para entrar una sola vez si perdés la contraseña.",
    "No se vuelven a mostrar: guardá este archivo en un lugar seguro.",
  ].join("\n");
  const url = URL.createObjectURL(
    new Blob([`${head}\n\n${codes.join("\n")}\n`], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `jobit-codigos-${handle || "de-respaldo"}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export function AccountDialog({
  action,
  context,
  user,
  onClose,
  onUser,
  onRefresh,
}: AccountDialogProps) {
  const [view, setView] = useState<View>(action);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [keyName, setKeyName] = useState("");
  /** Las opciones de la llave, pedidas antes del clic: ver el efecto de abajo. */
  const [loginOptions, setLoginOptions] = useState<PublicKeyCredentialRequestOptionsJSON | null>(
    null,
  );
  const [createOptions, setCreateOptions] = useState<PublicKeyCredentialCreationOptionsJSON | null>(
    null,
  );

  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [next, setNext] = useState("");
  const [code, setCode] = useState("");

  /** El modal juega su salida y recién ahí pide que lo desmonten. */
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => setClosing(true), []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close]);

  /**
   * Las opciones para crear una llave se piden al abrir la pantalla, no al
   * tocar el botón. Safari solo deja usar la llave pegada a un clic, y un
   * fetch en el medio le hace perder ese clic: el botón tiene que llamar a la
   * llave directo. El ref evita el doble pedido de StrictMode en desarrollo.
   */
  const started = useRef(false);
  useEffect(() => {
    if (view !== "passkey-add" || started.current) return;
    started.current = true;
    setBusy(true);
    passkeyOptions()
      .then((result) => {
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setCreateOptions(result.value);
      })
      .finally(() => setBusy(false));
  }, [view]);

  /** Corre una acción con el botón bloqueado y un solo lugar donde cae el error. */
  const run = async (task: () => Promise<string | void>): Promise<void> => {
    setBusy(true);
    setError("");
    try {
      const problem = await task();
      if (problem) setError(problem);
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      switch (view) {
        case "register": {
          const result = await register({
            handle,
            display_name: displayName,
            password,
            email,
          });
          if (!result.ok) return result.error;
          onUser(result.value.user);
          setCodes(result.value.recovery_codes);
          setView("codes");
          return;
        }
        case "login": {
          const result = await login(handle, password);
          if (!result.ok) return result.error;
          if (result.value.status === "passkey_required") {
            setLoginOptions(result.value.options);
            setView("passkey");
            return;
          }
          if (result.value.status === "totp_required") {
            setCode("");
            setView("totp");
            return;
          }
          onUser(result.value.user);
          close();
          return;
        }
        case "passkey": {
          if (!loginOptions) return "El segundo paso venció, volvé a entrar.";
          let response;
          try {
            response = await startAuthentication({ optionsJSON: loginOptions });
          } catch (cause) {
            return passkeyProblem(cause);
          }
          const result = await submitPasskey(response);
          if (!result.ok) return result.error;
          onUser(result.value.user);
          close();
          return;
        }
        case "forgot": {
          const result = await requestReset(handle);
          if (!result.ok) return result.error;
          setView("sent");
          return;
        }
        case "sent":
          close();
          return;
        case "reset": {
          if (!context?.token) return "Ese enlace no trae un token. Pedí uno nuevo.";
          const result = await resetPassword(context.token, password);
          if (!result.ok) return result.error;
          setPassword("");
          setRepeat("");
          setNotice("Listo. Entrá con la contraseña nueva.");
          setView("login");
          return;
        }
        case "passkey-add": {
          if (!createOptions) return "La llave todavía no está lista.";
          let response;
          try {
            response = await startRegistration({ optionsJSON: createOptions });
          } catch (cause) {
            return passkeyProblem(cause);
          }
          const result = await addPasskey(response, keyName);
          if (!result.ok) return result.error;
          await onRefresh();
          close();
          return;
        }
        case "passkey-remove": {
          if (!context?.passkeyId) return "No se sabe qué llave sacar.";
          const result = await removePasskey(context.passkeyId, password);
          if (!result.ok) return result.error;
          await onRefresh();
          close();
          return;
        }
        case "totp": {
          const result = await submitTotp(code);
          if (!result.ok) return result.error;
          onUser(result.value.user);
          close();
          return;
        }
        case "recover": {
          const result = await recover(handle, code);
          if (!result.ok) return result.error;
          onUser(result.value.user);
          close();
          return;
        }
        case "password": {
          const result = await patchMe({ current_password: password, new_password: next });
          if (!result.ok) return result.error;
          await onRefresh();
          close();
          return;
        }
        case "email": {
          const result = await patchMe({ email });
          if (!result.ok) return result.error;
          await onRefresh();
          close();
          return;
        }
        case "totp-off": {
          const result = await disableTotp(password);
          if (!result.ok) return result.error;
          await onRefresh();
          close();
          return;
        }
        case "delete": {
          const result = await deleteMe(password);
          if (!result.ok) return result.error;
          onUser(null);
          close();
          return;
        }
        case "codes":
          close();
      }
    });
  };

  const ready =
    view === "register"
      ? handle !== "" && displayName !== "" && password !== "" && repeat === password
      : view === "login"
        ? handle !== "" && password !== ""
        : view === "totp"
          ? code !== ""
          : view === "recover"
            ? handle !== "" && code !== ""
            : view === "forgot"
              ? handle !== ""
              : view === "reset"
                ? password !== "" && repeat === password
                : view === "passkey"
                  ? loginOptions !== null
                  : view === "passkey-add"
                    ? createOptions !== null
                    : view === "passkey-remove"
                      ? password !== ""
                      : view === "password"
                        ? password !== "" && next !== ""
                        : view === "email"
                          ? email !== ""
                          : view === "totp-off"
                            ? password !== ""
                            : view === "delete"
                              ? password !== "" && confirmed
                              : true;

  const heading = HEADING[view];
  const field = accountFieldClass;

  return createPortal(
    <div className="fixed inset-0 z-70 flex items-end justify-center sm:items-center sm:p-6">
      <m.div
        animate={{ opacity: closing ? 0 : 1 }}
        aria-hidden
        className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        onClick={close}
      />

      <m.div
        animate={closing ? { opacity: 0, y: 24, scale: 0.98 } : { opacity: 1, y: 0, scale: 1 }}
        aria-labelledby="account-dialog-title"
        aria-modal
        className="relative flex max-h-[92svh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-sky/50 bg-surface shadow-[var(--shadow-panel)] sm:max-h-[85svh] sm:rounded-3xl"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        role="dialog"
        transition={islandTransition}
        onAnimationComplete={() => {
          if (closing) onClose();
        }}
      >
        <header className="flex items-start gap-3 border-b border-sky/40 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2
              className="text-[17px] leading-snug font-semibold tracking-tight text-ink"
              id="account-dialog-title"
            >
              {heading.title}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">{heading.hint}</p>
          </div>
          <m.button
            aria-label="Cerrar"
            className={iconButtonClass}
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={close}
          >
            <X aria-hidden className="size-4" />
          </m.button>
        </header>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 py-5">
            {view === "register" || view === "login" ? (
              <input
                autoComplete="username"
                className={field}
                placeholder={view === "register" ? "Handle (tu usuario para entrar)" : "Handle"}
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
              />
            ) : null}

            {view === "register" ? (
              <>
                <input
                  autoComplete="name"
                  className={field}
                  placeholder="Nombre visible (como te van a ver)"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
                <p className="text-[11px] leading-relaxed text-muted">
                  El <strong className="font-medium text-soft">handle</strong> es tu usuario para
                  entrar: único y con @. El{" "}
                  <strong className="font-medium text-soft">nombre visible</strong> es lo que ve la
                  gente.
                </p>
                <input
                  autoComplete="new-password"
                  className={field}
                  placeholder="Contraseña"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <input
                  autoComplete="new-password"
                  className={field}
                  placeholder="Repetí la contraseña"
                  type="password"
                  value={repeat}
                  onChange={(event) => setRepeat(event.target.value)}
                />
                {repeat !== "" && repeat !== password ? (
                  <p className="text-[11px] leading-relaxed text-red-400">
                    Las contraseñas no coinciden.
                  </p>
                ) : null}
                <input
                  autoComplete="email"
                  className={field}
                  placeholder="Correo (opcional: para recuperar la cuenta y los avisos)"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </>
            ) : null}

            {view === "login" ? (
              <>
                <input
                  autoComplete="current-password"
                  className={field}
                  placeholder="Contraseña"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <button
                    className="text-[11px] font-medium text-brand underline underline-offset-2 transition-colors hover:text-ink"
                    type="button"
                    onClick={() => {
                      setError("");
                      setNotice("");
                      setView("forgot");
                    }}
                  >
                    Olvidé mi contraseña
                  </button>
                  <button
                    className="text-[11px] font-medium text-brand underline underline-offset-2 transition-colors hover:text-ink"
                    type="button"
                    onClick={() => {
                      setError("");
                      setNotice("");
                      setView("recover");
                    }}
                  >
                    Tengo un código de respaldo
                  </button>
                </div>
              </>
            ) : null}

            {view === "totp" ? (
              <>
                <p className="text-[11px] leading-relaxed text-muted">
                  Tu cuenta tiene segundo paso: además de la contraseña hace falta este código.
                </p>
                <input
                  autoComplete="one-time-code"
                  className={field}
                  inputMode="numeric"
                  placeholder="000000"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </>
            ) : null}

            {view === "recover" ? (
              <>
                <input
                  autoComplete="username"
                  className={field}
                  placeholder="handle"
                  value={handle}
                  onChange={(event) => setHandle(event.target.value)}
                />
                <input
                  className={field}
                  placeholder="código de respaldo"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </>
            ) : null}

            {view === "codes" ? (
              <>
                <p className="text-[11px] leading-relaxed text-muted">
                  Cada uno sirve para entrar una vez, si perdés la contraseña. No se vuelven a
                  mostrar.
                </p>
                <ul className="grid grid-cols-2 gap-1.5">
                  {codes.map((value) => (
                    <li
                      key={value}
                      className="rounded-lg bg-onpanel-wash px-2 py-1 font-mono text-xs tracking-wide text-onpanel"
                    >
                      {value}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {view === "password" ? (
              <>
                <input
                  autoComplete="current-password"
                  className={field}
                  placeholder="contraseña actual"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <input
                  autoComplete="new-password"
                  className={field}
                  placeholder="contraseña nueva"
                  type="password"
                  value={next}
                  onChange={(event) => setNext(event.target.value)}
                />
              </>
            ) : null}

            {view === "email" ? (
              <>
                <input
                  autoComplete="email"
                  className={field}
                  placeholder="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <p className="text-[11px] leading-relaxed text-muted">
                  {user?.has_email
                    ? "Cargar uno nuevo reemplaza el anterior y te manda un enlace para confirmarlo."
                    : "Te mandamos un enlace para confirmarlo. Sin correo, los códigos de respaldo siguen siendo la única salida."}
                </p>
              </>
            ) : null}

            {view === "passkey" ? (
              <p className="text-[11px] leading-relaxed text-muted">
                Tocá el botón y seguí lo que te pida el dispositivo: la huella, la cara, el PIN o la
                llave física. Si la perdiste, entrá con un código de respaldo.
              </p>
            ) : null}

            {view === "passkey-add" ? (
              <>
                <input
                  className={field}
                  maxLength={60}
                  placeholder="Un nombre para reconocerla (ej.: mi teléfono)"
                  value={keyName}
                  onChange={(event) => setKeyName(event.target.value)}
                />
                <p className="text-[11px] leading-relaxed text-muted">
                  {user?.totp_enabled
                    ? "Al crearla se apagan los códigos de seis dígitos y se borra su clave del servidor."
                    : "Desde ahora, entrar va a pedir la contraseña y la llave."}
                </p>
              </>
            ) : null}

            {view === "passkey-remove" ? (
              <>
                <p className="text-[11px] leading-relaxed text-muted">
                  Vas a sacar{" "}
                  <strong className="font-medium text-soft">
                    {context?.passkeyName || "esta llave"}
                  </strong>
                  .{" "}
                  {user && user.passkeys <= 1
                    ? "Es la única: sin ella, entrar vuelve a pedir solo la contraseña."
                    : "Las otras llaves siguen andando."}
                </p>
                <input
                  autoComplete="current-password"
                  className={field}
                  placeholder="tu contraseña"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </>
            ) : null}

            {view === "forgot" ? (
              <>
                <input
                  autoComplete="username"
                  className={field}
                  placeholder="handle"
                  value={handle}
                  onChange={(event) => setHandle(event.target.value)}
                />
                <p className="text-[11px] leading-relaxed text-muted">
                  Si no tenés correo cargado, entrá con un código de respaldo.
                </p>
              </>
            ) : null}

            {view === "sent" ? (
              <p className="text-[11px] leading-relaxed text-muted">
                Si hay una cuenta con ese handle y un correo cargado, te llega un enlace en un rato.
                La respuesta es la misma exista o no, para que nadie use esto para saber quién está
                registrado.
              </p>
            ) : null}

            {view === "reset" ? (
              <>
                <input
                  autoComplete="new-password"
                  className={field}
                  placeholder="contraseña nueva"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <input
                  autoComplete="new-password"
                  className={field}
                  placeholder="repetila"
                  type="password"
                  value={repeat}
                  onChange={(event) => setRepeat(event.target.value)}
                />
                {repeat !== "" && repeat !== password ? (
                  <p className="text-[11px] leading-relaxed text-red-400">
                    Las contraseñas no coinciden.
                  </p>
                ) : null}
              </>
            ) : null}

            {view === "totp-off" ? (
              <input
                autoComplete="current-password"
                className={field}
                placeholder="tu contraseña"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            ) : null}

            {view === "delete" ? (
              <>
                <p className="text-[11px] leading-relaxed text-muted">
                  Se borran tu cuenta, tus sesiones, tus códigos de respaldo y todo lo que hayas
                  publicado en el servidor. Lo que guardaste en este navegador no se toca.
                </p>
                <input
                  autoComplete="current-password"
                  className={field}
                  placeholder="tu contraseña"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <label className="flex items-center gap-2 text-[11px] text-onpanel/70">
                  <input
                    checked={confirmed}
                    className="size-3.5 accent-red-400"
                    type="checkbox"
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  Entiendo que no se puede deshacer
                </label>
              </>
            ) : null}

            {notice ? (
              <p className="text-[11px] leading-relaxed text-emerald-400">{notice}</p>
            ) : null}
            {error ? <p className="text-[11px] leading-relaxed text-red-400">{error}</p> : null}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-sky/40 px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
            {view === "codes" ? (
              <>
                <button
                  className={accountPrimaryClass}
                  type="button"
                  onClick={() => downloadCodes(codes, handle)}
                >
                  <Download aria-hidden className="size-3.5" />
                  Descargar
                </button>
                <button
                  className={accountQuietClass}
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(codes.join("\n"))}
                >
                  <Copy aria-hidden className="size-3.5" />
                  Copiar
                </button>
                <button className={accountQuietClass} type="button" onClick={close}>
                  {SUBMIT_LABEL.codes}
                </button>
              </>
            ) : (
              <>
                <button
                  className={view === "delete" ? accountDangerClass : accountPrimaryClass}
                  disabled={busy || !ready}
                  type="submit"
                >
                  {busy ? "Un momento…" : SUBMIT_LABEL[view]}
                </button>
                {view === "sent" ? null : (
                  <button
                    className={accountQuietClass}
                    disabled={busy}
                    type="button"
                    onClick={close}
                  >
                    Volver
                  </button>
                )}
              </>
            )}
          </div>
        </form>
      </m.div>
    </div>,
    document.body,
  );
}
