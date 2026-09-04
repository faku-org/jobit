import { Loader2, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { login } from "./api.ts";

export function Login({ onEntered }: { onEntered: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (sending || !password) return;

    setSending(true);
    setError("");
    login(password)
      .then(onEntered)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "no se pudo entrar");
        setPassword("");
      })
      .finally(() => setSending(false));
  };

  return (
    <div className="grid min-h-svh place-items-center px-5">
      <form
        className="w-full max-w-sm rounded-2xl border border-sky/60 bg-surface p-6 shadow-[var(--shadow-card)]"
        onSubmit={submit}
      >
        <span className="grid size-10 place-items-center rounded-full bg-brand text-white">
          <LockKeyhole aria-hidden className="size-5" />
        </span>

        <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">Panel de JobIt</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Administración de empresas. Nada de acá es público.
        </p>

        <label className="mt-5 block text-xs font-medium text-soft" htmlFor="password">
          Clave
        </label>
        <input
          autoComplete="current-password"
          autoFocus
          className="mt-1.5 w-full rounded-xl border border-sky/70 bg-mist px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {error ? <p className="mt-3 text-xs leading-relaxed text-red-600">{error}</p> : null}

        <button
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-panel px-4 py-2.5 text-sm font-medium text-onpanel transition-opacity hover:opacity-90 disabled:opacity-60"
          disabled={sending || password.length === 0}
          type="submit"
        >
          {sending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          Entrar
        </button>
      </form>
    </div>
  );
}
