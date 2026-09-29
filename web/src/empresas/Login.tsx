import { Building2, Loader2 } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  type Company,
  type Challenge,
  type TotpSetup,
  confirmTotpSetup,
  login,
  recover,
  recoverByEmail,
  register,
  resetPassword,
  startTotpSetup,
  submitTotp,
} from "./api.ts";
import { MIN_PASSWORD, passwordOk, passwordRules } from "../lib/password.ts";
import { TotpQr } from "./TotpQr.tsx";

const field =
  "mt-1.5 w-full rounded-xl border border-sky/70 bg-mist px-3 py-2.5 text-sm text-ink outline-none focus:border-brand";

type Step =
  | "login"
  | "register"
  | "totp"
  | "setup"
  | "codes"
  | "recover"
  | "recover-sent";

export function Login({ onEntered, notice }: { onEntered: (company: Company) => void; notice?: string }) {
  const [step, setStep] = useState<Step>("login");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");

  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [code, setCode] = useState("");

  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [recoverIdentifier, setRecoverIdentifier] = useState("");
  const [recoverCode, setRecoverCode] = useState("");

  /** El desafío no abre sesión: la cookie queda puesta pero se pide el código. */
  const challenge = (result: Challenge) => {
    setCompany(result.company);
    setCode("");
    if (result.status === "totp_required") {
      setStep("totp");
      return;
    }
    setSetup(null);
    setStep("setup");
  };

  /** La clave del QR se pide al entrar al paso, una sola vez. */
  const started = useRef(false);
  useEffect(() => {
    if (step !== "setup" || started.current) return;
    started.current = true;
    setSending(true);
    startTotpSetup()
      .then(setSetup)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "no se pudo"))
      .finally(() => setSending(false));
  }, [step]);

  const run = (task: () => Promise<void>) => {
    setSending(true);
    setError("");
    task()
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "no se pudo"))
      .finally(() => setSending(false));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (sending) return;

    if (step === "login") {
      run(async () => challenge(await login(identifier.trim(), password)));
      return;
    }
    if (step === "register") {
      run(async () =>
        challenge(
          await register({
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
            website: website.trim() || undefined,
            password,
            recovery_email: recoveryEmail.trim() || undefined,
          }),
        ),
      );
      return;
    }
    if (step === "setup") {
      if (!setup) return;
      run(async () => {
        const done = await confirmTotpSetup(code);
        setCompany(done.company);
        if (done.recovery_codes && done.recovery_codes.length > 0) {
          setCodes(done.recovery_codes);
          setStep("codes");
          return;
        }
        onEntered(done.company);
      });
      return;
    }
    if (step === "totp") {
      run(async () => {
        const done = await submitTotp(code);
        onEntered(done.company);
      });
      return;
    }
    if (step === "recover") {
      run(async () => {
        const done = await recover(recoverIdentifier.trim(), recoverCode);
        onEntered(done.company);
      });
    }
  };

  const sendRecoveryLink = () =>
    run(async () => {
      await recoverByEmail(recoverIdentifier.trim());
      setStep("recover-sent");
    });

  const registerReady =
    name.trim() !== "" &&
    email.trim() !== "" &&
    passwordOk(password) &&
    repeat === password;

  const ready =
    step === "login"
      ? identifier.trim() !== "" && password !== ""
      : step === "register"
        ? registerReady
        : step === "setup"
          ? setup !== null && code !== ""
          : step === "totp"
            ? code !== ""
            : step === "recover"
              ? recoverIdentifier.trim() !== "" && recoverCode !== ""
              : true;

  return (
    <div className="grid min-h-svh place-items-center px-5 py-10">
      <div className="w-full max-w-sm">
        {notice ? (
          <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs leading-relaxed text-emerald-800">
            {notice}
          </p>
        ) : null}

        <form
          className="rounded-2xl border border-sky/60 bg-surface p-6 shadow-[var(--shadow-card)]"
          onSubmit={submit}
        >
          <span className="grid size-10 place-items-center rounded-full bg-brand text-white">
            <Building2 aria-hidden className="size-5" />
          </span>

          <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">Panel de empresa</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{HINT[step]}</p>

          {step === "login" ? (
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
              <label className="mt-4 block text-xs font-medium text-soft" htmlFor="password">
                Contraseña
              </label>
              <input
                autoComplete="current-password"
                className={field}
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                className="mt-3 text-xs font-medium text-brand underline underline-offset-2 hover:text-ink"
                type="button"
                onClick={() => {
                  setRecoverIdentifier(identifier);
                  setError("");
                  setStep("recover");
                }}
              >
                Olvidé la contraseña o perdí el segundo paso
              </button>
            </>
          ) : null}

          {step === "register" ? (
            <>
              <Field id="name" label="Nombre de la empresa" value={name} onChange={setName} autoFocus />
              <Field
                id="email"
                label="Correo de contacto"
                type="email"
                value={email}
                onChange={setEmail}
              />
              <Field
                id="phone"
                label="Teléfono (opcional)"
                value={phone}
                onChange={setPhone}
              />
              <Field
                id="website"
                label="Sitio web (opcional)"
                placeholder="https://…"
                value={website}
                onChange={setWebsite}
              />
              <Field
                id="recovery-email"
                label="Correo de recuperación (opcional)"
                type="email"
                value={recoveryEmail}
                onChange={setRecoveryEmail}
                hint="Alterno al de contacto. Te mandamos un enlace para confirmarlo."
              />
              <PasswordFields
                password={password}
                repeat={repeat}
                onPassword={setPassword}
                onRepeat={setRepeat}
              />
            </>
          ) : null}

          {step === "setup" || step === "totp" ? (
            <>
              {step === "setup" ? (
                setup ? (
                  <>
                    <p className="mt-4 text-xs leading-relaxed text-muted">
                      El segundo paso es obligatorio. Escaneá el código con tu app de autenticación.
                    </p>
                    <div className="mt-3">
                      <TotpQr
                        expanded={false}
                        value={setup.otpauth}
                        onCollapse={() => {}}
                        onExpand={() => {}}
                      />
                    </div>
                    <p className="mt-3 text-[11px] leading-relaxed text-muted">
                      ¿No podés escanear? Cargá esta clave a mano:
                    </p>
                    <p className="rounded-lg bg-mist px-2 py-1.5 font-mono text-xs tracking-wide text-ink">
                      {setup.secret}
                    </p>
                  </>
                ) : (
                  <p className="mt-4 text-xs text-muted">Generando tu clave…</p>
                )
              ) : (
                <p className="mt-4 text-xs leading-relaxed text-muted">
                  Poné el código de seis dígitos de tu app de autenticación.
                </p>
              )}

              <label className="mt-4 block text-xs font-medium text-soft" htmlFor="code">
                Código
              </label>
              <input
                autoComplete="one-time-code"
                autoFocus
                className={field}
                id="code"
                inputMode="numeric"
                placeholder="000000"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </>
          ) : null}

          {step === "codes" ? (
            <>
              <p className="mt-4 text-xs leading-relaxed text-muted">
                Guardá estos códigos de respaldo: sirven para entrar una vez si perdés el teléfono.
                No se vuelven a mostrar.
              </p>
              <ul className="mt-3 grid grid-cols-2 gap-1.5">
                {codes.map((value) => (
                  <li
                    key={value}
                    className="rounded-lg bg-mist px-2 py-1 font-mono text-xs tracking-wide text-ink"
                  >
                    {value}
                  </li>
                ))}
              </ul>
              <button
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-panel px-4 py-2.5 text-sm font-medium text-onpanel disabled:opacity-60"
                type="button"
                onClick={() => company && onEntered(company)}
              >
                Ya los guardé, entrar
              </button>
            </>
          ) : null}

          {step === "recover" ? (
            <>
              <Field
                id="recover-identifier"
                label="Correo o nombre en la URL"
                value={recoverIdentifier}
                onChange={setRecoverIdentifier}
              />
              <label className="mt-4 block text-xs font-medium text-soft" htmlFor="recover-code">
                Código de respaldo
              </label>
              <input
                className={field}
                id="recover-code"
                value={recoverCode}
                onChange={(event) => setRecoverCode(event.target.value)}
              />
              <button
                className="mt-3 text-xs font-medium text-brand underline underline-offset-2 hover:text-ink disabled:opacity-60"
                disabled={sending || recoverIdentifier.trim() === ""}
                type="button"
                onClick={sendRecoveryLink}
              >
                Mandarme un enlace al correo de recuperación
              </button>
            </>
          ) : null}

          {step === "recover-sent" ? (
            <p className="mt-4 text-xs leading-relaxed text-muted">
              Si esa empresa tiene un correo de recuperación verificado, te va a llegar un enlace
              para elegir una contraseña nueva. Vence en 30 minutos.
            </p>
          ) : null}

          {error ? <p className="mt-3 text-xs leading-relaxed text-red-600">{error}</p> : null}

          {step !== "codes" && step !== "recover-sent" ? (
            <button
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-panel px-4 py-2.5 text-sm font-medium text-onpanel transition-opacity hover:opacity-90 disabled:opacity-60"
              disabled={sending || !ready}
              type="submit"
            >
              {sending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              {SUBMIT[step]}
            </button>
          ) : null}

          {step === "login" || step === "register" ? (
            <button
              className="mt-3 w-full text-center text-xs text-muted hover:text-ink"
              type="button"
              onClick={() => {
                setStep(step === "login" ? "register" : "login");
                setError("");
              }}
            >
              {step === "login"
                ? "¿Todavía no tenés cuenta? Registrate"
                : "Ya tengo cuenta"}
            </button>
          ) : step === "recover" ? (
            <button
              className="mt-3 w-full text-center text-xs text-muted hover:text-ink"
              type="button"
              onClick={() => {
                setStep("login");
                setError("");
              }}
            >
              Volver
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}

const HINT: Record<Step, string> = {
  login: "Entrá para administrar tus publicaciones y ver cómo rinden.",
  register: "Creá la cuenta de tu empresa. El alta queda pendiente hasta que la aprobemos.",
  totp: "Tu cuenta tiene segundo paso: además de la contraseña hace falta este código.",
  setup: "Activá el segundo paso. Es obligatorio para las cuentas de empresa.",
  codes: "Tus códigos de respaldo.",
  recover: "Con un código de respaldo, o te mandamos un enlace al correo de recuperación.",
  "recover-sent": "Revisá tu correo.",
};

const SUBMIT: Record<Step, string> = {
  login: "Entrar",
  register: "Crear la cuenta",
  totp: "Confirmar",
  setup: "Activar y entrar",
  codes: "Entrar",
  recover: "Recuperar con el código",
  "recover-sent": "Cerrar",
};

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  autoFocus?: boolean;
}) {
  return (
    <>
      <label className="mt-4 block text-xs font-medium text-soft" htmlFor={id}>
        {label}
      </label>
      <input
        autoFocus={autoFocus}
        className={field}
        id={id}
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <p className="mt-1 text-[11px] leading-relaxed text-faint">{hint}</p> : null}
    </>
  );
}

function PasswordFields({
  password,
  repeat,
  onPassword,
  onRepeat,
}: {
  password: string;
  repeat: string;
  onPassword: (value: string) => void;
  onRepeat: (value: string) => void;
}) {
  const rules = passwordRules(password);
  return (
    <>
      <label className="mt-4 block text-xs font-medium text-soft" htmlFor="password">
        Contraseña
      </label>
      <input
        autoComplete="new-password"
        className={field}
        id="password"
        type="password"
        value={password}
        onChange={(event) => onPassword(event.target.value)}
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

      <label className="mt-4 block text-xs font-medium text-soft" htmlFor="repeat">
        Repetí la contraseña
      </label>
      <input
        autoComplete="new-password"
        className={field}
        id="repeat"
        type="password"
        value={repeat}
        onChange={(event) => onRepeat(event.target.value)}
      />
      {repeat !== "" && repeat !== password ? (
        <p className="mt-1 text-[11px] text-red-600">Las contraseñas no coinciden.</p>
      ) : null}
      <p className="mt-1 text-[11px] text-faint">Mínimo {MIN_PASSWORD} caracteres.</p>
    </>
  );
}

/** La pantalla a la que llega el enlace del correo de recuperación. */
export function ResetAccess({
  companyId,
  token,
  onDone,
}: {
  companyId: string;
  token: string;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (sending || !passwordOk(password) || repeat !== password) return;

    setSending(true);
    setError("");
    resetPassword(companyId, token, password)
      .then(onDone)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "no se pudo cambiar"),
      )
      .finally(() => setSending(false));
  };

  return (
    <div className="grid min-h-svh place-items-center px-5 py-10">
      <form
        className="w-full max-w-sm rounded-2xl border border-sky/60 bg-surface p-6 shadow-[var(--shadow-card)]"
        onSubmit={submit}
      >
        <h1 className="text-xl font-semibold tracking-tight text-ink">Elegí una contraseña nueva</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Con la contraseña nueva vas a tener que activar el segundo paso otra vez.
        </p>
        <PasswordFields
          password={password}
          repeat={repeat}
          onPassword={setPassword}
          onRepeat={setRepeat}
        />
        {error ? <p className="mt-3 text-xs leading-relaxed text-red-600">{error}</p> : null}
        <button
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-panel px-4 py-2.5 text-sm font-medium text-onpanel disabled:opacity-60"
          disabled={sending || !passwordOk(password) || repeat !== password}
          type="submit"
        >
          {sending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          Guardar y entrar
        </button>
      </form>
    </div>
  );
}
