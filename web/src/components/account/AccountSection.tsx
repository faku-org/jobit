import { KeyRound, LogOut, ShieldCheck, TriangleAlert, UserRound } from "lucide-react";
import { useState } from "react";
import { useSession } from "../../hooks/useSession.ts";
import {
  type SessionUser,
  confirmTotp,
  currentUser,
  deleteMe,
  disableTotp,
  login,
  logout,
  patchMe,
  recover,
  register,
  startTotp,
  submitTotp,
} from "../../lib/session.ts";

/**
 * La cuenta de quien publica. Es lo único de la app que vive en el servidor, así
 * que va separada y con su propio cartel: el resto del panel guarda en este
 * navegador, esto no.
 *
 * El alta no es una página aparte: cuando exista el flujo de publicar, esto es
 * el paso que va adentro. Mientras tanto se entra desde acá.
 */
type View = "menu" | "login" | "register" | "totp" | "recover" | "codes";

const fieldClass =
  "w-full rounded-xl border border-onpanel/20 bg-onpanel-wash px-3 py-2 text-sm text-onpanel placeholder:text-onpanel-faint outline-none transition-colors focus:border-sky";

const primaryClass =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky px-3 py-2 text-sm font-medium text-ink transition-colors hover:brightness-105 disabled:opacity-60";

const quietClass =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-onpanel/20 px-3 py-2 text-sm font-medium text-onpanel/80 transition-colors hover:border-sky hover:text-onpanel disabled:opacity-60";

export function AccountSection() {
  const { user, ready, setUser } = useSession();
  const [view, setView] = useState<View>("menu");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [codes, setCodes] = useState<string[]>([]);

  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  /** Vuelve a leer la cuenta después de un cambio, para no adivinar el estado. */
  const refresh = async (): Promise<void> => {
    try {
      setUser(await currentUser());
    } catch {
      /* Si la API no contesta, se queda con lo que ya sabía. */
    }
  };

  /** Corre una acción con el botón bloqueado y un solo lugar donde cae el error. */
  const run = async (action: () => Promise<string | void>): Promise<void> => {
    setBusy(true);
    setError("");
    try {
      const problem = await action();
      if (problem) setError(problem);
    } finally {
      setBusy(false);
    }
  };

  const openView = (next: View): void => {
    setError("");
    setPassword("");
    setCode("");
    setView(next);
  };

  if (!ready) {
    return <p className="px-1 text-[11px] text-onpanel-faint">Cargando tu cuenta…</p>;
  }

  if (!user) {
    return (
      <div className="space-y-3">
        <Header title="Tu cuenta" hint="Lo único que se guarda en el servidor." />

        {view === "menu" ? (
          <div className="space-y-3">
            <p className="text-[11px] leading-relaxed text-onpanel/70">
              Para publicar vas a necesitar una cuenta. Se guarda lo mínimo: un handle, tu nombre
              visible y una contraseña. El email es opcional y solo sirve para recuperarla.
            </p>
            <div className="flex flex-wrap gap-2">
              <button className={primaryClass} type="button" onClick={() => openView("register")}>
                Crear cuenta
              </button>
              <button className={quietClass} type="button" onClick={() => openView("login")}>
                Entrar
              </button>
              <button
                className="text-[11px] text-onpanel-faint underline underline-offset-2 transition-colors hover:text-onpanel"
                type="button"
                onClick={() => openView("recover")}
              >
                Perdí el acceso
              </button>
            </div>
          </div>
        ) : null}

        {view === "register" ? (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const result = await register({
                  handle,
                  display_name: displayName,
                  password,
                  email,
                });
                if (!result.ok) return result.error;
                setUser(result.value.user);
                setCodes(result.value.recovery_codes);
                openView("codes");
              });
            }}
          >
            <input
              autoComplete="username"
              className={fieldClass}
              placeholder="handle (como te van a ver)"
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
            />
            <input
              autoComplete="name"
              className={fieldClass}
              placeholder="nombre visible"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <input
              autoComplete="new-password"
              className={fieldClass}
              placeholder="contraseña"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <input
              autoComplete="email"
              className={fieldClass}
              placeholder="email (opcional, para recuperar)"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <p className="flex gap-2 rounded-xl bg-onpanel-wash px-3 py-2 text-[11px] leading-relaxed text-onpanel/70">
              <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-sky" />
              <span>
                Sin email <strong>no hay forma de recuperar la cuenta</strong>: los códigos de
                respaldo que te vamos a mostrar son la única salida. Si los perdés, perdés la
                cuenta.
              </span>
            </p>

            <FormButtons busy={busy} onCancel={() => openView("menu")} submit="Crear cuenta" />
          </form>
        ) : null}

        {view === "login" ? (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const result = await login(handle, password);
                if (!result.ok) return result.error;
                if (result.value.status === "totp_required") {
                  openView("totp");
                  return;
                }
                setUser(result.value.user);
                openView("menu");
              });
            }}
          >
            <input
              autoComplete="username"
              className={fieldClass}
              placeholder="handle"
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
            />
            <input
              autoComplete="current-password"
              className={fieldClass}
              placeholder="contraseña"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <FormButtons busy={busy} onCancel={() => openView("menu")} submit="Entrar" />
          </form>
        ) : null}

        {view === "totp" ? (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const result = await submitTotp(code);
                if (!result.ok) return result.error;
                setUser(result.value.user);
                openView("menu");
              });
            }}
          >
            <p className="text-[11px] text-onpanel/70">
              Poné el código de seis dígitos de tu app de autenticación.
            </p>
            <input
              autoComplete="one-time-code"
              className={fieldClass}
              inputMode="numeric"
              placeholder="000000"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <FormButtons busy={busy} onCancel={() => openView("menu")} submit="Confirmar" />
          </form>
        ) : null}

        {view === "recover" ? (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const result = await recover(handle, code);
                if (!result.ok) return result.error;
                setUser(result.value.user);
                openView("menu");
              });
            }}
          >
            <p className="text-[11px] text-onpanel/70">
              Con tu handle y uno de los códigos de respaldo.
            </p>
            <input
              autoComplete="username"
              className={fieldClass}
              placeholder="handle"
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
            />
            <input
              className={fieldClass}
              placeholder="código de respaldo"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <FormButtons busy={busy} onCancel={() => openView("menu")} submit="Recuperar" />
          </form>
        ) : null}

        <ErrorLine error={error} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Header title="Tu cuenta" hint={`@${user.handle}`} />

      <div className="flex items-center gap-2.5 rounded-xl bg-onpanel-wash px-3 py-2.5">
        <UserRound aria-hidden className="size-4 shrink-0 text-onpanel/60" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-onpanel">{user.display_name}</p>
          <p className="text-[11px] text-onpanel-faint">
            @{user.handle} · {user.recovery_codes_left} códigos de respaldo sin usar
          </p>
        </div>
      </div>

      {view === "codes" ? (
        <div className="space-y-2 rounded-xl border border-sky/60 bg-onpanel-wash p-3">
          <p className="text-[11px] leading-relaxed text-onpanel/70">
            Guardá estos códigos en un lugar seguro. <strong>Se muestran una sola vez</strong>: cada
            uno sirve para entrar una vez si perdés la contraseña.
          </p>
          <ul className="grid grid-cols-2 gap-1.5">
            {codes.map((value) => (
              <li
                key={value}
                className="rounded-lg bg-onpanel/10 px-2 py-1 font-mono text-xs tracking-wide text-onpanel"
              >
                {value}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              className={quietClass}
              type="button"
              onClick={() => void navigator.clipboard.writeText(codes.join("\n"))}
            >
              Copiar
            </button>
            <button className={primaryClass} type="button" onClick={() => setCodes([])}>
              Ya los guardé
            </button>
          </div>
        </div>
      ) : null}

      <TwoFactor user={user} busy={busy} onRefresh={refresh} onError={setError} />
      <PasswordChange onRefresh={refresh} onError={setError} />
      <EmailChange user={user} onRefresh={refresh} onError={setError} />

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          className={quietClass}
          type="button"
          onClick={() =>
            void run(async () => {
              await logout();
              setUser(null);
              setCodes([]);
              openView("menu");
            })
          }
        >
          <LogOut aria-hidden className="size-3.5" />
          Cerrar sesión
        </button>
      </div>

      <DeleteAccount
        onDeleted={() => {
          setUser(null);
          openView("menu");
        }}
        onError={setError}
      />

      <ErrorLine error={error} />
    </div>
  );
}

function Header({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <p className="text-[11px] font-semibold tracking-wide text-onpanel-muted uppercase">
        {title}
      </p>
      <span className="truncate text-[11px] text-onpanel-faint">{hint}</span>
    </div>
  );
}

function ErrorLine({ error }: { error: string }) {
  if (!error) return null;
  return <p className="text-[11px] leading-relaxed text-red-400">{error}</p>;
}

function FormButtons({
  busy,
  submit,
  onCancel,
}: {
  busy: boolean;
  submit: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button className={primaryClass} disabled={busy} type="submit">
        {busy ? "Un momento…" : submit}
      </button>
      <button className={quietClass} disabled={busy} type="button" onClick={onCancel}>
        Volver
      </button>
    </div>
  );
}

/** Activar y desactivar el segundo paso. El secreto se muestra una vez. */
function TwoFactor({
  user,
  busy,
  onRefresh,
  onError,
}: {
  user: SessionUser;
  busy: boolean;
  onRefresh: () => Promise<void>;
  onError: (error: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; otpauth: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [localBusy, setLocalBusy] = useState(false);

  const guard = async (action: () => Promise<string | void>): Promise<void> => {
    setLocalBusy(true);
    onError("");
    try {
      const problem = await action();
      if (problem) onError(problem);
    } finally {
      setLocalBusy(false);
    }
  };

  const disabled = busy || localBusy;

  return (
    <div className="rounded-xl border border-onpanel/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-onpanel/80">
          <ShieldCheck aria-hidden className="size-3.5 text-sky" />
          Segundo paso (TOTP)
        </span>
        <span className="text-[11px] text-onpanel-faint">
          {user.totp_enabled ? "Activado" : "Apagado"}
        </span>
      </div>

      {user.totp_enabled ? (
        open ? (
          <div className="mt-2 space-y-2">
            <p className="text-[11px] text-onpanel/70">
              Desactivarlo pide tu contraseña. Después vas a poder entrar solo con ella.
            </p>
            <input
              className={fieldClass}
              placeholder="contraseña"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <div className="flex gap-2">
              <button
                className={primaryClass}
                disabled={disabled}
                type="button"
                onClick={() =>
                  void guard(async () => {
                    const result = await disableTotp(password);
                    if (!result.ok) return result.error;
                    setOpen(false);
                    setPassword("");
                    await onRefresh();
                  })
                }
              >
                Desactivar
              </button>
              <button className={quietClass} type="button" onClick={() => setOpen(false)}>
                Volver
              </button>
            </div>
          </div>
        ) : (
          <button
            className="mt-2 text-[11px] text-onpanel-faint underline underline-offset-2 transition-colors hover:text-onpanel"
            type="button"
            onClick={() => setOpen(true)}
          >
            Desactivar
          </button>
        )
      ) : setup ? (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] leading-relaxed text-onpanel/70">
            Cargá esta clave en tu app de autenticación (<span className="font-mono">{setup.secret}</span>)
            y después poné el código que te muestre.
          </p>
          <p className="break-all rounded-lg bg-onpanel-wash px-2 py-1.5 font-mono text-[10px] text-onpanel/60">
            {setup.otpauth}
          </p>
          <input
            autoComplete="one-time-code"
            className={fieldClass}
            inputMode="numeric"
            placeholder="000000"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <div className="flex gap-2">
            <button
              className={primaryClass}
              disabled={disabled}
              type="button"
              onClick={() =>
                void guard(async () => {
                  const result = await confirmTotp(code);
                  if (!result.ok) return result.error;
                  setSetup(null);
                  setCode("");
                  await onRefresh();
                })
              }
            >
              Activar
            </button>
            <button className={quietClass} type="button" onClick={() => setSetup(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-onpanel/60 transition-colors hover:text-onpanel"
          type="button"
          onClick={() =>
            void guard(async () => {
              const result = await startTotp();
              if (!result.ok) return result.error;
              setSetup(result.value);
            })
          }
        >
          <KeyRound aria-hidden className="size-3" />
          Activar segundo paso
        </button>
      )}
    </div>
  );
}

function PasswordChange({
  onRefresh,
  onError,
}: {
  onRefresh: () => Promise<void>;
  onError: (error: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!open) {
    return (
      <button
        className="text-[11px] text-onpanel-faint underline underline-offset-2 transition-colors hover:text-onpanel"
        type="button"
        onClick={() => setOpen(true)}
      >
        Cambiar contraseña
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-onpanel/10 p-3">
      <input
        autoComplete="current-password"
        className={fieldClass}
        placeholder="contraseña actual"
        type="password"
        value={current}
        onChange={(event) => setCurrent(event.target.value)}
      />
      <input
        autoComplete="new-password"
        className={fieldClass}
        placeholder="contraseña nueva"
        type="password"
        value={next}
        onChange={(event) => setNext(event.target.value)}
      />
      <div className="flex gap-2">
        <button
          className={primaryClass}
          disabled={busy}
          type="button"
          onClick={() => {
            setBusy(true);
            onError("");
            void patchMe({ current_password: current, new_password: next })
              .then(async (result) => {
                if (!result.ok) {
                  onError(result.error);
                  return;
                }
                setCurrent("");
                setNext("");
                setDone(true);
                await onRefresh();
              })
              .finally(() => setBusy(false));
          }}
        >
          Guardar
        </button>
        <button className={quietClass} type="button" onClick={() => setOpen(false)}>
          Volver
        </button>
      </div>
      {done ? <p className="text-[11px] text-onpanel/70">Contraseña cambiada.</p> : null}
    </div>
  );
}

function EmailChange({
  user,
  onRefresh,
  onError,
}: {
  user: SessionUser;
  onRefresh: () => Promise<void>;
  onError: (error: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-xl border border-onpanel/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-onpanel/80">Email de recuperación</span>
        <span className="text-[11px] text-onpanel-faint">{user.has_email ? "Cargado" : "Sin cargar"}</span>
      </div>

      {open ? (
        <div className="mt-2 space-y-2">
          <input
            autoComplete="email"
            className={fieldClass}
            placeholder="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <div className="flex gap-2">
            <button
              className={primaryClass}
              disabled={busy}
              type="button"
              onClick={() => {
                setBusy(true);
                onError("");
                void patchMe({ email })
                  .then(async (result) => {
                    if (!result.ok) {
                      onError(result.error);
                      return;
                    }
                    setEmail("");
                    setOpen(false);
                    await onRefresh();
                  })
                  .finally(() => setBusy(false));
              }}
            >
              Guardar
            </button>
            <button className={quietClass} type="button" onClick={() => setOpen(false)}>
              Volver
            </button>
          </div>
        </div>
      ) : (
        <button
          className="mt-2 text-[11px] text-onpanel-faint underline underline-offset-2 transition-colors hover:text-onpanel"
          type="button"
          onClick={() => setOpen(true)}
        >
          {user.has_email ? "Cambiar email" : "Cargar email"}
        </button>
      )}
    </div>
  );
}

function DeleteAccount({
  onDeleted,
  onError,
}: {
  onDeleted: () => void;
  onError: (error: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button
        className="inline-flex items-center gap-1.5 text-[11px] text-onpanel-faint underline underline-offset-2 transition-colors hover:text-red-400"
        type="button"
        onClick={() => setOpen(true)}
      >
        <TriangleAlert aria-hidden className="size-3" />
        Borrar mi cuenta
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-red-400/40 p-3">
      <p className="text-[11px] leading-relaxed text-onpanel/70">
        Se borra de verdad: tu cuenta, tus sesiones, tus códigos y todo lo que hayas publicado. No
        se puede deshacer.
      </p>
      <input
        className={fieldClass}
        placeholder="tu contraseña"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <label className="flex items-center gap-2 text-[11px] text-onpanel/70">
        <input
          checked={wrong}
          className="size-3.5 accent-red-400"
          type="checkbox"
          onChange={(event) => setWrong(event.target.checked)}
        />
        Entiendo que no se puede deshacer
      </label>
      <div className="flex gap-2">
        <button
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:brightness-105 disabled:opacity-60"
          disabled={busy || !wrong || password === ""}
          type="button"
          onClick={() => {
            setBusy(true);
            onError("");
            void deleteMe(password).then((result) => {
              setBusy(false);
              if (!result.ok) {
                onError(result.error);
                return;
              }
              onDeleted();
            });
          }}
        >
          Borrar todo
        </button>
        <button className={quietClass} type="button" onClick={() => setOpen(false)}>
          Volver
        </button>
      </div>
    </div>
  );
}
