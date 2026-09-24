import { Copy, Download, X } from "lucide-react";
import { m } from "motion/react";
import { type FormEvent, Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { islandTransition } from "../../lib/motion.ts";
import { iconButtonClass } from "../../lib/styles.ts";
import {
  type SessionUser,
  type TotpSetup,
  confirmTotp,
  deleteMe,
  disableTotp,
  login,
  patchMe,
  recover,
  register,
  startTotp,
  submitTotp,
} from "../../lib/session.ts";
import {
  accountDangerClass,
  accountFieldClass,
  accountPrimaryClass,
  accountQuietClass,
} from "./controls.ts";

/** El generador de QR pesa y solo hace falta al activar el segundo paso: baja
 * en su propio chunk, no con la app entera. */
const TotpQr = lazy(() => import("./TotpQr.tsx").then((module) => ({ default: module.TotpQr })));

/**
 * Cada trámite de la cuenta es una pantalla del mismo modal. Nada de esto se
 * dibuja dentro del panel: crear, entrar o borrar la cuenta son decisiones, no
 * ajustes, y merecen una ventana que tape el resto mientras se toman.
 */
export type AccountAction =
  | "register"
  | "login"
  | "recover"
  | "password"
  | "email"
  | "totp-on"
  | "totp-off"
  | "delete";

type View = AccountAction | "totp" | "codes";

interface AccountDialogProps {
  action: AccountAction;
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
    hint: "Se guarda lo mínimo: un handle, tu nombre visible y una contraseña.",
  },
  login: { title: "Entrar", hint: "Con tu handle y tu contraseña." },
  totp: {
    title: "Segundo paso",
    hint: "Poné el código de seis dígitos de tu app de autenticación.",
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
    title: "Email de recuperación",
    hint: "Solo sirve para recuperar la cuenta. Va cifrado en el servidor.",
  },
  "totp-on": {
    title: "Activar el segundo paso",
    hint: "Escaneá el código con tu app de autenticación y confirmá con el código que te muestre.",
  },
  "totp-off": {
    title: "Desactivar el segundo paso",
    hint: "Pide tu contraseña. Después vas a poder entrar solo con ella.",
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
  recover: "Recuperar",
  codes: "Ya los guardé",
  password: "Guardar",
  email: "Guardar",
  "totp-on": "Activar",
  "totp-off": "Desactivar",
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

export function AccountDialog({ action, user, onClose, onUser, onRefresh }: AccountDialogProps) {
  const [view, setView] = useState<View>(action);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [confirmed, setConfirmed] = useState(false);

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
  /** El QR ampliado: el mismo Escape que lo cierra no debe cerrar el modal. */
  const [qrZoom, setQrZoom] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (qrZoom) {
        setQrZoom(false);
        return;
      }
      close();
    };

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close, qrZoom]);

  /** La clave del segundo paso se pide al abrir. El ref evita el doble pedido
   * con el que StrictMode monta los efectos en desarrollo. */
  const started = useRef(false);
  useEffect(() => {
    if (view !== "totp-on" || started.current) return;
    started.current = true;
    setBusy(true);
    startTotp()
      .then((result) => {
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSetup(result.value);
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
          if (result.value.status === "totp_required") {
            setCode("");
            setView("totp");
            return;
          }
          onUser(result.value.user);
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
        case "totp-on": {
          if (!setup) return "La clave todavía no está lista.";
          const result = await confirmTotp(code);
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
            : view === "password"
              ? password !== "" && next !== ""
              : view === "email"
                ? email !== ""
                : view === "totp-on"
                  ? setup !== null && code !== ""
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
                  placeholder="Email (opcional, para recuperar)"
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
                <button
                  className="self-start text-[11px] font-medium text-brand underline underline-offset-2 transition-colors hover:text-ink"
                  type="button"
                  onClick={() => {
                    setError("");
                    setView("recover");
                  }}
                >
                  Olvidé mi contraseña o mi handle
                </button>
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
                    ? "Cargar uno nuevo reemplaza el anterior."
                    : "Sin email, los códigos de respaldo siguen siendo la única salida."}
                </p>
              </>
            ) : null}

            {view === "totp-on" ? (
              setup ? (
                <>
                  <p className="text-[11px] leading-relaxed text-muted">
                    Escaneá este código con tu app de autenticación y después poné el código que te
                    muestre.
                  </p>
                  <Suspense fallback={<div className="mx-auto size-44 rounded-xl bg-white" />}>
                    <TotpQr
                      expanded={qrZoom}
                      value={setup.otpauth}
                      onCollapse={() => setQrZoom(false)}
                      onExpand={() => setQrZoom(true)}
                    />
                  </Suspense>
                  <p className="text-[11px] leading-relaxed text-muted">
                    ¿No podés escanear? Cargá esta clave a mano:
                  </p>
                  <p className="rounded-lg bg-onpanel-wash px-2 py-1.5 font-mono text-xs tracking-wide text-onpanel">
                    {setup.secret}
                  </p>
                  <details className="text-[11px] text-onpanel/60">
                    <summary className="cursor-pointer">Ver el enlace otpauth</summary>
                    <p className="mt-1 break-all rounded-lg bg-onpanel-wash px-2 py-1.5 font-mono text-[10px]">
                      {setup.otpauth}
                    </p>
                  </details>
                  <input
                    autoComplete="one-time-code"
                    className={field}
                    inputMode="numeric"
                    placeholder="000000"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                  />
                </>
              ) : (
                <p className="text-[11px] leading-relaxed text-muted">Generando tu clave…</p>
              )
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
                <button className={accountQuietClass} disabled={busy} type="button" onClick={close}>
                  Volver
                </button>
              </>
            )}
          </div>
        </form>
      </m.div>
    </div>,
    document.body,
  );
}
