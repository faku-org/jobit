import { KeyRound, Loader2, Lock, Mail, ShieldCheck, Smartphone, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { passwordOk, passwordRules } from "../../lib/password.ts";
import type { Company } from "../api.ts";
import {
  type TotpDone,
  type TotpSetup,
  changeTotp,
  deactivateAccount,
  lockdown,
  requestPasswordEmail,
  updateCompany,
} from "../api.ts";
import { TotpQr } from "../TotpQr.tsx";
import { AreaCard, Saved, inputClass, labelClass, primaryButton, quietButton } from "./shared.tsx";

interface AreaProps {
  company: Company;
  onUpdated: (company: Company) => void;
  onFail: (cause: unknown) => void;
  onLeft: () => void;
}

const dangerButton =
  "inline-flex items-center gap-2 rounded-xl border border-red-300 px-3.5 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60";

const errorOf = (cause: unknown): string => (cause instanceof Error ? cause.message : "");

/** Los códigos de respaldo se muestran una sola vez, así que cuando aparecen
 * vienen con su aviso. */
function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <p className="text-xs font-medium text-emerald-900">
        Guardá estos códigos de respaldo. No se vuelven a mostrar.
      </p>
      <ul className="mt-2 grid grid-cols-2 gap-1.5">
        {codes.map((value) => (
          <li
            key={value}
            className="rounded-lg bg-white px-2 py-1 font-mono text-xs tracking-wide text-ink"
          >
            {value}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * La seguridad, en acciones separadas y cada una con su tarjeta: cambiar el
 * segundo paso, cambiar la contraseña, hacer un lockdown para emergencias y
 * desactivar la cuenta. Cada acción pide lo suyo y no se mezcla con las demás,
 * que era lo que volvía la sección un formulario largo e ilegible.
 */
export function AreaSecurity({ company, onUpdated, onFail, onLeft }: AreaProps) {
  return (
    <div className="space-y-4">
      <TotpCard company={company} onFail={onFail} onUpdated={onUpdated} />
      <PasswordCard onFail={onFail} onUpdated={onUpdated} />
      <LockdownCard onFail={onFail} onLeft={onLeft} />
      <DeactivateCard company={company} onFail={onFail} onLeft={onLeft} />
    </div>
  );
}

/** Cambiar el segundo paso: se pide la contraseña, se muestra el QR nuevo y el
 * código lo confirma. El 2FA viejo sigue valiendo hasta ese momento. */
function TotpCard({ company, onUpdated, onFail }: Omit<AreaProps, "onLeft">) {
  const [phase, setPhase] = useState<"idle" | "password" | "scan" | "done">("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(false);

  const fail = (cause: unknown) => {
    const message = errorOf(cause);
    setError(message);
    if (!message) onFail(cause);
  };

  const start = (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || password === "") return;
    setBusy(true);
    setError("");
    changeTotp(password)
      .then((result) => {
        if (result.status === "setup") {
          setSetup(result);
          setPhase("scan");
        }
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };

  const confirm = (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || code.trim() === "") return;
    setBusy(true);
    setError("");
    changeTotp(password, code.trim())
      .then((result) => {
        if (result.status === "ok") {
          setCodes((result as TotpDone).recovery_codes ?? []);
          onUpdated(result.company);
          setPhase("done");
        }
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };

  const reset = () => {
    setPhase("idle");
    setPassword("");
    setCode("");
    setSetup(null);
    setCodes([]);
    setError("");
    setZoom(false);
  };

  return (
    <AreaCard
      title="Segundo paso (2FA)"
      description="El código de tu app de autenticación. Cambialo si querés pasarlo a otro teléfono o si creés que alguien más lo tiene."
    >
      <div className="flex items-start gap-2.5 rounded-xl bg-mist px-3 py-2.5">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-700" />
        <p className="text-[11px] leading-relaxed text-soft">
          {company.totp_enabled ? (
            <>
              El <strong className="font-medium">segundo paso está activo</strong> y es obligatorio. Te
              quedan {company.recovery_codes_left} códigos de respaldo sin usar.
            </>
          ) : (
            <>El segundo paso todavía no está activo en esta cuenta.</>
          )}
        </p>
      </div>

      {phase === "idle" ? (
        <button className={`${quietButton} mt-3`} type="button" onClick={() => setPhase("password")}>
          <Smartphone aria-hidden className="size-3.5" />
          Cambiar 2FA
        </button>
      ) : null}

      {phase === "password" ? (
        <form className="mt-4" onSubmit={start}>
          <label className={labelClass} htmlFor="totp-password">
            Confirmá con tu contraseña
          </label>
          <input
            autoComplete="current-password"
            className={inputClass}
            id="totp-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <p className="mt-2 text-xs leading-relaxed text-red-600">{error}</p> : null}
          <div className="mt-3 flex items-center gap-2">
            <button className={primaryButton} disabled={busy || password === ""} type="submit">
              {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Continuar
            </button>
            <button className={quietButton} type="button" onClick={reset}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {phase === "scan" && setup ? (
        <form className="mt-4" onSubmit={confirm}>
          <p className="text-xs leading-relaxed text-muted">
            Escaneá el código con la app de autenticación y poné el de seis dígitos para confirmar el
            cambio. El código viejo sigue andando hasta que confirmes.
          </p>
          <div className="mt-3">
            <TotpQr
              expanded={zoom}
              value={setup.otpauth}
              onCollapse={() => setZoom(false)}
              onExpand={() => setZoom(true)}
            />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            ¿No podés escanear? Cargá esta clave a mano:
          </p>
          <p className="rounded-lg bg-mist px-2 py-1.5 font-mono text-xs tracking-wide text-ink">
            {setup.secret}
          </p>

          <label className={`${labelClass} mt-4`} htmlFor="totp-new-code">
            Código de la app nueva
          </label>
          <input
            autoComplete="one-time-code"
            className={inputClass}
            id="totp-new-code"
            inputMode="numeric"
            placeholder="000000"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />

          {error ? <p className="mt-2 text-xs leading-relaxed text-red-600">{error}</p> : null}
          <div className="mt-3 flex items-center gap-2">
            <button className={primaryButton} disabled={busy || code.trim() === ""} type="submit">
              {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Confirmar cambio
            </button>
            <button className={quietButton} type="button" onClick={reset}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {phase === "done" ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs leading-relaxed text-emerald-700">
            Segundo paso cambiado. Se cerró la sesión en los demás dispositivos y se renovaron tus
            códigos de respaldo.
          </p>
          <RecoveryCodes codes={codes} />
          <button className={quietButton} type="button" onClick={reset}>
            Listo
          </button>
        </div>
      ) : null}
    </AreaCard>
  );
}

/** Cambiar la contraseña: pide la actual, el código del segundo paso y un código
 * que llega al correo verificado. */
function PasswordCard({ onUpdated, onFail }: Pick<AreaProps, "onUpdated" | "onFail">) {
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
      .catch((cause: unknown) => setError(errorOf(cause)))
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
        const message = errorOf(cause);
        setError(message);
        if (!message) onFail(cause);
      })
      .finally(() => setSending(false));
  };

  return (
    <AreaCard
      title="Contraseña"
      description="Para cambiarla hacen falta tu contraseña actual, el código de tu app de autenticación y un código que mandamos al correo verificado."
    >
      <form onSubmit={change}>
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
            {sending ? (
              <Loader2 aria-hidden className="size-3.5 animate-spin" />
            ) : (
              <Mail aria-hidden className="size-3.5" />
            )}
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

/** Lockdown: cuando sospechás que alguien más entró. Cierra todas las sesiones
 * y renueva los códigos de respaldo de una vez. */
function LockdownCard({ onFail, onLeft }: Pick<AreaProps, "onFail" | "onLeft">) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || password === "" || totpCode.trim() === "") return;
    setBusy(true);
    setError("");
    lockdown(password, totpCode.trim())
      .then((result) => setCodes(result.recovery_codes))
      .catch((cause: unknown) => {
        const message = errorOf(cause);
        setError(message);
        if (!message) onFail(cause);
      })
      .finally(() => setBusy(false));
  };

  return (
    <AreaCard
      title="Sesiones y emergencia (lockdown)"
      description="Si creés que alguien más tiene acceso, cerrá la sesión en todos los dispositivos y renová tus códigos de respaldo."
    >
      {codes ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
            <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-red-700" />
            <p className="text-[11px] leading-relaxed text-red-800">
              Se cerró la sesión en todos los dispositivos, incluida esta. Volvé a entrar con tu
              contraseña y tu segundo paso.
            </p>
          </div>
          <RecoveryCodes codes={codes} />
          <button className={primaryButton} type="button" onClick={onLeft}>
            Volver a entrar
          </button>
        </div>
      ) : open ? (
        <form onSubmit={submit}>
          <label className={labelClass} htmlFor="lockdown-password">
            Contraseña
          </label>
          <input
            autoComplete="current-password"
            className={inputClass}
            id="lockdown-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <label className={`${labelClass} mt-4`} htmlFor="lockdown-totp">
            Código de la app (2FA)
          </label>
          <input
            autoComplete="one-time-code"
            className={inputClass}
            id="lockdown-totp"
            inputMode="numeric"
            placeholder="000000"
            value={totpCode}
            onChange={(event) => setTotpCode(event.target.value)}
          />

          {error ? <p className="mt-3 text-xs leading-relaxed text-red-600">{error}</p> : null}
          <div className="mt-4 flex items-center gap-2">
            <button
              className={dangerButton}
              disabled={busy || password === "" || totpCode.trim() === ""}
              type="submit"
            >
              {busy ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <Lock aria-hidden className="size-4" />
              )}
              Cerrar todo y renovar códigos
            </button>
            <button className={quietButton} type="button" onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button className={`${quietButton} mt-1`} type="button" onClick={() => setOpen(true)}>
          <Lock aria-hidden className="size-3.5" />
          Cerrar sesión en todos los dispositivos
        </button>
      )}
    </AreaCard>
  );
}

/** Desactivar la cuenta: deja de entrar hasta recuperarla por el correo alterno.
 * Por eso el correo de recuperación tiene que estar verificado antes. */
function DeactivateCard({ company, onFail, onLeft }: Omit<AreaProps, "onUpdated">) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");

  const recovery = company.emails.find((entry) => entry.kind === "recovery");
  const canDeactivate = Boolean(recovery?.verified);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || password === "" || totpCode.trim() === "") return;
    setBusy(true);
    setError("");
    deactivateAccount(password, totpCode.trim())
      .then((result) => setSentTo(result.email))
      .catch((cause: unknown) => {
        const message = errorOf(cause);
        setError(message);
        if (!message) onFail(cause);
      })
      .finally(() => setBusy(false));
  };

  return (
    <AreaCard
      title="Desactivar cuenta"
      description="Apaga la cuenta y sus publicaciones hasta que la recuperes por el correo alterno. No borra nada: podés volver cuando quieras."
    >
      {sentTo ? (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-soft">
            La cuenta quedó desactivada. Te mandamos un enlace a{" "}
            <strong className="font-medium">{sentTo}</strong> para elegir una contraseña nueva y
            volver a entrar. Vence en 30 minutos.
          </p>
          <button className={primaryButton} type="button" onClick={onLeft}>
            Volver a entrar
          </button>
        </div>
      ) : !canDeactivate ? (
        <p className="text-xs leading-relaxed text-muted">
          Para desactivar la cuenta primero cargá y verificá un correo de recuperación en la sección{" "}
          <strong className="font-medium">Correos</strong>: es la única puerta para volver.
        </p>
      ) : open ? (
        <form onSubmit={submit}>
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-700" />
            <p className="text-[11px] leading-relaxed text-amber-800">
              Tus publicaciones dejan de verse y no vas a poder entrar hasta recuperar la cuenta.
            </p>
          </div>

          <label className={`${labelClass} mt-4`} htmlFor="deactivate-password">
            Contraseña
          </label>
          <input
            autoComplete="current-password"
            className={inputClass}
            id="deactivate-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <label className={`${labelClass} mt-4`} htmlFor="deactivate-totp">
            Código de la app (2FA)
          </label>
          <input
            autoComplete="one-time-code"
            className={inputClass}
            id="deactivate-totp"
            inputMode="numeric"
            placeholder="000000"
            value={totpCode}
            onChange={(event) => setTotpCode(event.target.value)}
          />

          {error ? <p className="mt-3 text-xs leading-relaxed text-red-600">{error}</p> : null}
          <div className="mt-4 flex items-center gap-2">
            <button
              className={dangerButton}
              disabled={busy || password === "" || totpCode.trim() === ""}
              type="submit"
            >
              {busy ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <TriangleAlert aria-hidden className="size-4" />
              )}
              Desactivar la cuenta
            </button>
            <button className={quietButton} type="button" onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button className={`${dangerButton} mt-1`} type="button" onClick={() => setOpen(true)}>
          <KeyRound aria-hidden className="size-3.5" />
          Desactivar la cuenta
        </button>
      )}
    </AreaCard>
  );
}
