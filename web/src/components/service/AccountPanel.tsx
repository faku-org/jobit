import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import {
  type Account,
  login as sendLogin,
  recover as sendRecover,
  register as sendRegister,
  submitTotp,
} from "../../lib/account.ts";
import { fieldClass } from "../../lib/styles.ts";

interface AccountPanelProps {
  /** Qué se va a hacer apenas haya sesión, dicho antes de pedir nada. */
  reason: string;
  onReady: (account: Account) => void;
  onCancel: () => void;
}

type Mode = "login" | "register" | "totp" | "recover" | "codes";

function Field({
  label,
  hint,
  type = "text",
  value,
  autoComplete,
  onChange,
}: {
  label: string;
  hint?: string;
  type?: string;
  value: string;
  autoComplete?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-soft">{label}</span>
      <input
        aria-label={label}
        autoComplete={autoComplete}
        className={`${fieldClass} mt-1 px-3.5 py-2.5`}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

/**
 * La cuenta, como paso del alta de un servicio y no como sección aparte. Pide
 * lo mínimo: un nombre de usuario, un nombre para mostrar y una contraseña. El
 * correo es opcional y se dice con todas las letras qué implica no ponerlo.
 */
export function AccountPanel({ reason, onReady, onCancel }: AccountPanelProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [pending, setPending] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    work()
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "No se pudo, probá de nuevo");
      })
      .finally(() => setBusy(false));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    if (mode === "login") {
      return run(async () => {
        const result = await sendLogin(handle, password);
        if (result.status === "totp") setMode("totp");
        else onReady(result.user);
      });
    }

    if (mode === "register") {
      return run(async () => {
        const created = await sendRegister({
          handle,
          display_name: displayName,
          password,
          ...(email.trim() ? { email: email.trim() } : {}),
        });
        setCodes(created.recovery_codes);
        setPending(created.user);
        setMode("codes");
      });
    }

    if (mode === "totp") {
      return run(async () => {
        const confirmed = await submitTotp(code);
        onReady(confirmed.user);
      });
    }

    if (mode === "recover") {
      return run(async () => {
        const recovered = await sendRecover(handle, code, password);
        setCodes(recovered.recovery_codes);
        setPending(recovered.user);
        setMode("codes");
      });
    }
  };

  if (mode === "codes") {
    return (
      <div className="rounded-2xl border border-sky/50 bg-surface p-5 shadow-[var(--shadow-hairline)]">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <KeyRound aria-hidden className="size-4 text-brand" />
          Guardá estos códigos
        </h2>
        <p className="mt-1 text-sm text-soft">
          Son la única forma de volver a entrar si perdés la contraseña. Se muestran una sola vez:
          de acá en adelante solo queda su huella.
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-sky/50 bg-mist px-3 py-3 font-mono text-sm text-ink">
          {codes.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
        <button
          className="mt-4 w-full rounded-xl bg-panel px-4 py-2.5 text-sm font-medium text-onpanel transition-colors hover:bg-brand"
          type="button"
          onClick={() => {
            if (pending) onReady(pending);
          }}
        >
          Ya los guardé
        </button>
      </div>
    );
  }

  return (
    <form
      className="rounded-2xl border border-sky/50 bg-surface p-5 shadow-[var(--shadow-hairline)]"
      onSubmit={submit}
    >
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <ShieldCheck aria-hidden className="size-4 text-brand" />
        {mode === "register"
          ? "Creá tu cuenta"
          : mode === "totp"
            ? "Segundo paso"
            : mode === "recover"
              ? "Recuperar la cuenta"
              : "Entrá a tu cuenta"}
      </h2>
      <p className="mt-1 text-sm text-soft">{reason}</p>

      <div className="mt-4 space-y-3">
        {mode === "totp" ? (
          <Field
            autoComplete="one-time-code"
            hint="Los seis dígitos de tu app de autenticación."
            label="Código"
            value={code}
            onChange={setCode}
          />
        ) : (
          <>
            <Field
              autoComplete="username"
              hint={
                mode === "register"
                  ? "De 3 a 24 letras, números o guiones. Es lo que se ve junto a tu servicio."
                  : undefined
              }
              label="Usuario"
              value={handle}
              onChange={setHandle}
            />

            {mode === "register" ? (
              <Field
                autoComplete="name"
                label="Nombre para mostrar"
                value={displayName}
                onChange={setDisplayName}
              />
            ) : null}

            {mode === "recover" ? (
              <Field label="Código de respaldo" value={code} onChange={setCode} />
            ) : null}

            <Field
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              label={mode === "recover" ? "Contraseña nueva" : "Contraseña"}
              type="password"
              value={password}
              onChange={setPassword}
            />

            {mode === "register" ? (
              <Field
                autoComplete="email"
                hint="Opcional, y solo para recuperar la cuenta. Sin correo, los códigos de respaldo son la única vuelta: si los perdés, la cuenta no se recupera."
                label="Correo"
                type="email"
                value={email}
                onChange={setEmail}
              />
            ) : null}
          </>
        )}
      </div>

      {error ? <p className="mt-3 text-xs text-brand">{error}</p> : null}

      <div className="mt-4 flex items-center gap-2">
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-panel px-4 py-2.5 text-sm font-medium text-onpanel transition-colors hover:bg-brand disabled:opacity-60"
          disabled={busy}
          type="submit"
        >
          {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          {mode === "register" ? "Crear cuenta" : mode === "totp" ? "Confirmar" : "Entrar"}
        </button>
        <button
          className="rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:text-ink"
          type="button"
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>

      {mode === "totp" ? null : (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <button
            className="transition-colors hover:text-ink"
            type="button"
            onClick={() => {
              setError("");
              setMode(mode === "register" ? "login" : "register");
            }}
          >
            {mode === "register" ? "Ya tengo cuenta" : "No tengo cuenta"}
          </button>
          <button
            className="transition-colors hover:text-ink"
            type="button"
            onClick={() => {
              setError("");
              setMode(mode === "recover" ? "login" : "recover");
            }}
          >
            {mode === "recover" ? "Volver a entrar" : "Perdí la contraseña"}
          </button>
        </div>
      )}
    </form>
  );
}
