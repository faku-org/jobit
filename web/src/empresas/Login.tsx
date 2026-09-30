import { Building2, Loader2 } from "lucide-react";
import { useState } from "react";
import { type Company, login, register, requestReset, resetPassword } from "./api.ts";

type Mode = "login" | "register" | "forgot" | "sent" | "reset";

const field =
  "mt-1.5 w-full rounded-xl border border-sky/70 bg-mist px-3 py-2.5 text-sm text-ink outline-none focus:border-brand";

export function Login({
  onEntered,
  resetToken,
}: {
  onEntered: (company: Company) => void;
  /** Si se llegó desde el enlace de reset, el token que traía. */
  resetToken?: string;
}) {
  const [mode, setMode] = useState<Mode>(resetToken ? "reset" : "login");
  const [notice, setNotice] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const ready =
    mode === "login"
      ? identifier.trim() !== "" && password !== ""
      : mode === "forgot"
        ? identifier.trim() !== ""
        : mode === "reset"
          ? password.length >= 8
          : mode === "sent"
            ? true
            : name.trim() !== "" && email.trim() !== "" && password.length >= 8;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (sending || !ready) return;

    if (mode === "sent") {
      setMode("login");
      return;
    }

    setSending(true);
    setError("");

    if (mode === "forgot" || mode === "reset") {
      const pending =
        mode === "forgot"
          ? requestReset(identifier.trim()).then(() => setMode("sent"))
          : resetPassword(resetToken ?? "", password).then(() => {
              setPassword("");
              setNotice("Listo. Entrá con la contraseña nueva.");
              setMode("login");
            });
      pending
        .catch((cause: unknown) =>
          setError(cause instanceof Error ? cause.message : "no se pudo completar"),
        )
        .finally(() => setSending(false));
      return;
    }

    const request =
      mode === "login"
        ? login(identifier.trim(), password)
        : register({
            name: name.trim(),
            email: email.trim(),
            website: website.trim() || undefined,
            password,
          });

    request
      .then((session) => onEntered(session.company))
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "no se pudo entrar");
      })
      .finally(() => setSending(false));
  };

  return (
    <div className="grid min-h-svh place-items-center px-5 py-10">
      <form
        className="w-full max-w-sm rounded-2xl border border-sky/60 bg-surface p-6 shadow-[var(--shadow-card)]"
        onSubmit={submit}
      >
        <span className="grid size-10 place-items-center rounded-full bg-brand text-white">
          <Building2 aria-hidden className="size-5" />
        </span>

        <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">Panel de empresa</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          {mode === "login"
            ? "Entrá para administrar tus publicaciones y ver cómo rinden."
            : mode === "forgot"
              ? "Te mandamos un enlace al correo de contacto de la empresa para cambiar la contraseña."
              : mode === "sent"
                ? "Si hay una empresa con ese correo o esa URL, le llega un enlace en un rato. Vence en 30 minutos. La respuesta es la misma exista o no."
                : mode === "reset"
                  ? "Elegí la contraseña nueva. Al guardarla se cierran todas las sesiones abiertas de la empresa."
                  : "Creá la cuenta de tu empresa. El alta queda pendiente hasta que la aprobemos."}
        </p>

        {notice ? <p className="mt-3 text-xs leading-relaxed text-emerald-700">{notice}</p> : null}

        {mode === "sent" || mode === "reset" ? null : mode === "login" || mode === "forgot" ? (
          <>
            <label className="mt-5 block text-xs font-medium text-soft" htmlFor="identifier">
              Correo o nombre en la URL
            </label>
            <input
              autoComplete="username"
              autoFocus
              className={field}
              id="identifier"
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          </>
        ) : (
          <>
            <label className="mt-5 block text-xs font-medium text-soft" htmlFor="name">
              Nombre de la empresa
            </label>
            <input
              autoFocus
              className={field}
              id="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />

            <label className="mt-4 block text-xs font-medium text-soft" htmlFor="email">
              Correo de contacto
            </label>
            <input
              autoComplete="email"
              className={field}
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <label className="mt-4 block text-xs font-medium text-soft" htmlFor="website">
              Sitio web (opcional)
            </label>
            <input
              className={field}
              id="website"
              placeholder="https://…"
              type="url"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </>
        )}

        {mode === "login" || mode === "register" || mode === "reset" ? (
          <>
            <label className="mt-4 block text-xs font-medium text-soft" htmlFor="password">
              {mode === "reset" ? "Contraseña nueva" : "Contraseña"}
            </label>
            <input
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className={field}
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {mode === "register" || mode === "reset" ? (
              <p className="mt-1.5 text-[11px] text-faint">Al menos 8 caracteres.</p>
            ) : null}
          </>
        ) : null}

        {mode === "login" ? (
          <button
            className="mt-2 text-xs text-muted underline underline-offset-2 hover:text-ink"
            type="button"
            onClick={() => {
              setMode("forgot");
              setError("");
              setNotice("");
            }}
          >
            Olvidé la contraseña
          </button>
        ) : null}

        {error ? <p className="mt-3 text-xs leading-relaxed text-red-600">{error}</p> : null}

        <button
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-panel px-4 py-2.5 text-sm font-medium text-onpanel transition-opacity hover:opacity-90 disabled:opacity-60"
          disabled={sending || !ready}
          type="submit"
        >
          {sending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          {mode === "login"
            ? "Entrar"
            : mode === "forgot"
              ? "Mandar el enlace"
              : mode === "sent"
                ? "Volver a entrar"
                : mode === "reset"
                  ? "Guardar la contraseña"
                  : "Crear la cuenta"}
        </button>

        {mode === "login" || mode === "register" ? (
          <button
            className="mt-3 w-full text-center text-xs text-muted hover:text-ink"
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
              setNotice("");
            }}
          >
            {mode === "login" ? "¿Todavía no tenés cuenta? Registrate" : "Ya tengo cuenta"}
          </button>
        ) : mode === "forgot" ? (
          <button
            className="mt-3 w-full text-center text-xs text-muted hover:text-ink"
            type="button"
            onClick={() => setMode("login")}
          >
            Volver
          </button>
        ) : null}
      </form>
    </div>
  );
}
