import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { passwordOk, passwordRules } from "../../lib/password.ts";
import type { Company } from "../api.ts";
import { requestPasswordEmail, updateCompany } from "../api.ts";
import { AreaCard, Saved, inputClass, labelClass, primaryButton, quietButton } from "./shared.tsx";

interface AreaProps {
  company: Company;
  onUpdated: (company: Company) => void;
  onFail: (cause: unknown) => void;
}

/**
 * Cambiar la contraseña pide las dos cosas que la API exige: el código del
 * segundo paso y un código de seis dígitos que llega al correo verificado.
 */
export function AreaSecurity({ company, onUpdated, onFail }: AreaProps) {
  const [current, setCurrent] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [sending, setSending] = useState(false);
  const [mailSent, setMailSent] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const rules = passwordRules(next);
  const ready =
    current !== "" &&
    totpCode.trim() !== "" &&
    emailCode.trim() !== "" &&
    passwordOk(next) &&
    repeat === next;

  const requestCode = () => {
    setSending(true);
    setError("");
    requestPasswordEmail()
      .then((result) => setMailSent(result.to))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : ""))
      .finally(() => setSending(false));
  };

  const change = (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready || sending) return;

    setSending(true);
    setError("");
    setDone(false);
    updateCompany({
      current_password: current,
      new_password: next,
      totp_code: totpCode.trim(),
      email_code: emailCode.trim(),
    })
      .then((result) => {
        onUpdated(result.company);
        setDone(true);
        setCurrent("");
        setTotpCode("");
        setEmailCode("");
        setNext("");
        setRepeat("");
        setMailSent("");
      })
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : "";
        setError(message);
        if (!message) onFail(cause);
      })
      .finally(() => setSending(false));
  };

  return (
    <AreaCard
      title="Seguridad"
      description="Para cambiar la contraseña hacen falta tu contraseña actual, el código de tu app de autenticación y un código que mandamos al correo verificado."
    >
      <div className="flex items-start gap-2.5 rounded-xl bg-mist px-3 py-2.5">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-700" />
        <p className="text-[11px] leading-relaxed text-soft">
          El <strong className="font-medium">segundo paso está activo</strong> y es obligatorio. Te
          quedan {company.recovery_codes_left} códigos de respaldo sin usar.
        </p>
      </div>

      <form className="mt-4" onSubmit={change}>
        <label className={labelClass} htmlFor="current">
          Contraseña actual
        </label>
        <input
          autoComplete="current-password"
          className={inputClass}
          id="current"
          type="password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />

        <label className={`${labelClass} mt-4`} htmlFor="totp-code">
          Código de la app (2FA)
        </label>
        <input
          autoComplete="one-time-code"
          className={inputClass}
          id="totp-code"
          inputMode="numeric"
          placeholder="000000"
          value={totpCode}
          onChange={(event) => setTotpCode(event.target.value)}
        />

        <label className={`${labelClass} mt-4`} htmlFor="email-code">
          Código del correo
        </label>
        <div className="flex items-center gap-2">
          <input
            className={`${inputClass} mt-0`}
            id="email-code"
            inputMode="numeric"
            placeholder="000000"
            value={emailCode}
            onChange={(event) => setEmailCode(event.target.value)}
          />
          <button
            className={`${quietButton} shrink-0`}
            disabled={sending}
            type="button"
            onClick={requestCode}
          >
            {sending ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Mail aria-hidden className="size-3.5" />}
            {mailSent ? "Reenviar" : "Mandar código"}
          </button>
        </div>
        {mailSent ? (
          <p className="mt-1 text-[11px] text-emerald-700">Código enviado a {mailSent}.</p>
        ) : (
          <p className="mt-1 text-[11px] text-faint">
            Se manda al primer correo verificado de la empresa.
          </p>
        )}

        <label className={`${labelClass} mt-4`} htmlFor="next">
          Contraseña nueva
        </label>
        <input
          autoComplete="new-password"
          className={inputClass}
          id="next"
          type="password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
        <ul className="mt-2 space-y-1">
          {rules.map((rule) => (
            <li
              key={rule.label}
              className={`flex items-center gap-1.5 text-[11px] ${rule.ok ? "text-emerald-700" : "text-faint"}`}
            >
              <span aria-hidden>{rule.ok ? "✓" : "•"}</span>
              {rule.label}
            </li>
          ))}
        </ul>

        <label className={`${labelClass} mt-4`} htmlFor="repeat">
          Repetí la contraseña nueva
        </label>
        <input
          autoComplete="new-password"
          className={inputClass}
          id="repeat"
          type="password"
          value={repeat}
          onChange={(event) => setRepeat(event.target.value)}
        />
        {repeat !== "" && repeat !== next ? (
          <p className="mt-1 text-[11px] text-red-600">Las contraseñas no coinciden.</p>
        ) : null}

        {error ? <p className="mt-3 text-xs leading-relaxed text-red-600">{error}</p> : null}
        {done ? <p className="mt-3 text-xs text-emerald-700">Contraseña cambiada.</p> : null}

        <div className="mt-4 flex items-center gap-3">
          <button className={primaryButton} disabled={!ready || sending} type="submit">
            {sending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            Cambiar contraseña
          </button>
          <Saved show={done} />
        </div>
      </form>
    </AreaCard>
  );
}
