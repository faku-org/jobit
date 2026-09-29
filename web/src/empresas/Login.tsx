import { ArrowLeft, ArrowRight, Building2, Check, Loader2 } from "lucide-react";
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
import { DEFAULT_COUNTRY_ISO, composePhone } from "../lib/countries.ts";
import { MIN_PASSWORD, passwordOk, passwordRules } from "../lib/password.ts";
import { PhoneField } from "./PhoneField.tsx";
import { TotpQr } from "./TotpQr.tsx";

const field =
  "mt-1.5 w-full rounded-xl border border-sky/70 bg-mist px-3 py-2.5 text-sm text-ink outline-none focus:border-brand";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

type Step =
  | "login"
  | "register"
  | "totp"
  | "setup"
  | "codes"
  | "recover"
  | "recover-sent";

/** El alta se divide en secciones: se completa de a una y cada una valida lo suyo. */
type RegisterSectionId = "empresa" | "contacto" | "seguridad";

type RegisterField = "name" | "website" | "email" | "phone" | "recovery" | "password" | "repeat";

const REGISTER_SECTIONS: { id: RegisterSectionId; label: string; hint: string }[] = [
  {
    id: "empresa",
    label: "Empresa",
    hint: "Cómo se llama tu empresa y dónde encontrarla.",
  },
  {
    id: "contacto",
    label: "Contacto",
    hint: "Por dónde te escribimos para avisarte cuando aprobemos el alta.",
  },
  {
    id: "seguridad",
    label: "Seguridad",
    hint: "La contraseña con la que vas a entrar al panel.",
  },
];

/** Qué campos valida cada sección, en el orden en que se muestran. */
const SECTION_FIELDS: Record<RegisterSectionId, RegisterField[]> = {
  empresa: ["name", "website"],
  contacto: ["email", "phone", "recovery"],
  seguridad: ["password", "repeat"],
};

/** El id del control en el DOM, para poder llevar el foco al primer error. */
const FIELD_DOM_ID: Record<RegisterField, string> = {
  name: "name",
  website: "website",
  email: "email",
  phone: "phone-national",
  recovery: "recovery-email",
  password: "password",
  repeat: "repeat",
};

export function Login({ onEntered, notice }: { onEntered: (company: Company) => void; notice?: string }) {
  const [step, setStep] = useState<Step>("login");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneIso, setPhoneIso] = useState(DEFAULT_COUNTRY_ISO);
  const [phoneNational, setPhoneNational] = useState("");
  const [website, setWebsite] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  /** Los errores se muestran una vez que el campo se tocó, no antes. */
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (field: string) => setTouched((current) => ({ ...current, [field]: true }));

  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [code, setCode] = useState("");

  /** El paso visible del alta. */
  const [registerIndex, setRegisterIndex] = useState(0);
  /** Campo al que hay que llevar el foco tras validar una sección. */
  const [focusField, setFocusField] = useState<RegisterField | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** Última sección que se mostró, para recién ahí mover el foco. */
  const lastRegisterIndex = useRef(-1);

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

  /** Al cambiar de sección el foco va al campo con error o al título del paso. */
  useEffect(() => {
    if (step !== "register") return;
    const changed = lastRegisterIndex.current !== registerIndex;
    lastRegisterIndex.current = registerIndex;
    if (focusField) {
      document.getElementById(FIELD_DOM_ID[focusField])?.focus();
      setFocusField(null);
      return;
    }
    if (changed) panelRef.current?.focus();
  }, [step, registerIndex, focusField]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (sending) return;

    if (step === "login") {
      run(async () => challenge(await login(identifier.trim(), password)));
      return;
    }
    if (step === "register") {
      if (registerIndex < REGISTER_SECTIONS.length - 1) advanceRegister();
      else submitRegister();
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

  const errors = {
    name: name.trim().length < 2 ? "Poné el nombre de la empresa." : "",
    email: !EMAIL_RE.test(email.trim()) ? "El correo no parece válido." : "",
    website:
      website.trim() !== "" && !isHttpUrl(website.trim())
        ? "Tiene que ser una dirección completa, con https://."
        : "",
    recovery:
      recoveryEmail.trim() !== "" && !EMAIL_RE.test(recoveryEmail.trim())
        ? "El correo no parece válido."
        : "",
    phone:
      phoneNational.trim() !== "" && !/^[\d\s()+-]+$/.test(phoneNational)
        ? "El número solo lleva dígitos y separadores."
        : "",
    password: passwordOk(password) ? "" : "La contraseña no cumple los mínimos.",
    repeat: repeat !== password ? "Las contraseñas no coinciden." : "",
  };

  /** El primer error de una sección, en el orden en que se muestra. */
  const firstErrorOf = (
    id: RegisterSectionId,
  ): { field: RegisterField; message: string } | null => {
    for (const field of SECTION_FIELDS[id]) {
      const message = errors[field];
      if (message) return { field, message };
    }
    return null;
  };

  const sectionDone = (id: RegisterSectionId) => firstErrorOf(id) === null;

  /** Muestra el error del campo y lo enfoca: la validación corta en el primero. */
  const reveal = (field: RegisterField) => {
    setTouched((current) => ({ ...current, [field]: true }));
    setFocusField(field);
  };

  const goToSection = (index: number) => {
    setRegisterIndex(index);
    setError("");
  };

  /** Avanza un paso validando la sección actual. Si falla, no avanza. */
  const advanceRegister = () => {
    const current = REGISTER_SECTIONS[registerIndex];
    if (!current) return;
    const problem = firstErrorOf(current.id);
    if (problem) {
      reveal(problem.field);
      return;
    }
    goToSection(registerIndex + 1);
  };

  /** Ir a un paso: hacia atrás siempre; hacia adelante valida las previas. */
  const goToRegisterStep = (index: number) => {
    if (index <= registerIndex) {
      goToSection(index);
      return;
    }
    for (let i = registerIndex; i < index; i += 1) {
      const section = REGISTER_SECTIONS[i];
      if (!section) continue;
      const problem = firstErrorOf(section.id);
      if (problem) {
        if (i !== registerIndex) goToSection(i);
        reveal(problem.field);
        return;
      }
    }
    goToSection(index);
  };

  /** Última sección: valida todo y salta a la primera que falle. */
  const submitRegister = () => {
    for (let i = 0; i < REGISTER_SECTIONS.length; i += 1) {
      const section = REGISTER_SECTIONS[i];
      if (!section) continue;
      const problem = firstErrorOf(section.id);
      if (problem) {
        if (i !== registerIndex) goToSection(i);
        reveal(problem.field);
        return;
      }
    }
    run(async () =>
      challenge(
        await register({
          name: name.trim(),
          email: email.trim(),
          phone: composePhone(phoneIso, phoneNational) || undefined,
          phone_country: phoneIso,
          website: website.trim() || undefined,
          password,
          recovery_email: recoveryEmail.trim() || undefined,
        }),
      ),
    );
  };

  const ready =
    step === "login"
      ? identifier.trim() !== "" && password !== ""
      : step === "setup"
        ? setup !== null && code !== ""
        : step === "totp"
          ? code !== ""
          : step === "recover"
            ? recoverIdentifier.trim() !== "" && recoverCode !== ""
            : true;

  const registerSection = REGISTER_SECTIONS[registerIndex] ?? REGISTER_SECTIONS[0]!;

  return (
    <div className="grid min-h-svh place-items-center px-5 py-10">
      <div className={`w-full ${step === "register" ? "max-w-sm sm:max-w-2xl" : "max-w-sm"}`}>
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
              <nav aria-label="Pasos del alta" className="mt-5">
                <ol className="flex items-stretch gap-1 rounded-xl bg-mist p-1">
                  {REGISTER_SECTIONS.map((item, index) => {
                    const active = index === registerIndex;
                    const done = !active && sectionDone(item.id);
                    return (
                      <li className="min-w-0 flex-1" key={item.id}>
                        <button
                          aria-current={active ? "step" : undefined}
                          className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                            active ? "bg-panel text-onpanel" : "text-soft hover:text-ink"
                          }`}
                          type="button"
                          onClick={() => goToRegisterStep(index)}
                        >
                          <span
                            aria-hidden
                            className={`grid size-4 shrink-0 place-items-center rounded-full text-[10px] ${
                              done
                                ? "bg-emerald-100 text-emerald-700"
                                : active
                                  ? "bg-onpanel/20 text-onpanel"
                                  : "bg-sky/40 text-ink"
                            }`}
                          >
                            {done ? <Check className="size-3" /> : index + 1}
                          </span>
                          <span className="truncate">{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>

              <p aria-live="polite" className="sr-only">
                Paso {registerIndex + 1} de {REGISTER_SECTIONS.length}: {registerSection.label}
              </p>

              <div
                aria-labelledby={`register-${registerSection.id}`}
                className="mt-5 focus:outline-none"
                ref={panelRef}
                role="group"
                tabIndex={-1}
              >
                <h2
                  className="text-sm font-semibold tracking-tight text-ink"
                  id={`register-${registerSection.id}`}
                >
                  {registerSection.label}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">{registerSection.hint}</p>

                {registerSection.id === "empresa" ? (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Field
                      className=""
                      error={touched.name ? errors.name : ""}
                      id="name"
                      label="Nombre de la empresa"
                      value={name}
                      onBlur={() => touch("name")}
                      onChange={setName}
                    />
                    <Field
                      className=""
                      error={touched.website ? errors.website : ""}
                      id="website"
                      label="Sitio web (opcional)"
                      placeholder="https://…"
                      value={website}
                      onBlur={() => touch("website")}
                      onChange={setWebsite}
                    />
                  </div>
                ) : null}

                {registerSection.id === "contacto" ? (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Field
                      className=""
                      error={touched.email ? errors.email : ""}
                      id="email"
                      label="Correo de contacto"
                      type="email"
                      value={email}
                      onBlur={() => touch("email")}
                      onChange={setEmail}
                    />
                    <Field
                      className=""
                      error={touched.recovery ? errors.recovery : ""}
                      hint="Alterno al de contacto. Te mandamos un enlace para confirmarlo."
                      id="recovery-email"
                      label="Correo de recuperación (opcional)"
                      type="email"
                      value={recoveryEmail}
                      onBlur={() => touch("recovery")}
                      onChange={setRecoveryEmail}
                    />
                    <div className="sm:col-span-2">
                      <p className="text-xs font-medium text-soft">Teléfono (opcional)</p>
                      <PhoneField
                        error={touched.phone ? errors.phone : ""}
                        id="phone-national"
                        iso={phoneIso}
                        national={phoneNational}
                        onIso={setPhoneIso}
                        onNational={(value) => {
                          setPhoneNational(value);
                          touch("phone");
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                {registerSection.id === "seguridad" ? (
                  <PasswordFields
                    password={password}
                    repeat={repeat}
                    passwordError={touched.password ? errors.password : ""}
                    repeatError={touched.repeat ? errors.repeat : ""}
                    onPassword={setPassword}
                    onRepeat={setRepeat}
                  />
                ) : null}
              </div>
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

          {step === "register" ? (
            <div className="mt-5 flex items-center gap-2">
              {registerIndex > 0 ? (
                <button
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky/70 px-3.5 py-2.5 text-sm font-medium text-ink hover:bg-mist disabled:opacity-60"
                  disabled={sending}
                  type="button"
                  onClick={() => goToSection(registerIndex - 1)}
                >
                  <ArrowLeft aria-hidden className="size-4" />
                  Atrás
                </button>
              ) : null}
              {registerIndex < REGISTER_SECTIONS.length - 1 ? (
                <button
                  className="ml-auto inline-flex items-center gap-2 rounded-xl bg-panel px-4 py-2.5 text-sm font-medium text-onpanel transition-opacity hover:opacity-90 disabled:opacity-60"
                  disabled={sending}
                  type="submit"
                >
                  Siguiente
                  <ArrowRight aria-hidden className="size-4" />
                </button>
              ) : (
                <button
                  className="ml-auto inline-flex items-center justify-center gap-2 rounded-xl bg-panel px-4 py-2.5 text-sm font-medium text-onpanel transition-opacity hover:opacity-90 disabled:opacity-60"
                  disabled={sending}
                  type="submit"
                >
                  {sending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                  Crear la cuenta
                </button>
              )}
            </div>
          ) : step !== "codes" && step !== "recover-sent" ? (
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
                if (step === "login") setRegisterIndex(0);
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
  error,
  onBlur,
  autoFocus,
  className = "mt-4",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  onBlur?: () => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-soft" htmlFor={id}>
        {label}
      </label>
      <input
        aria-describedby={messageId}
        aria-invalid={error ? true : undefined}
        autoFocus={autoFocus}
        className={field}
        id={id}
        placeholder={placeholder}
        type={type}
        value={value}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <p className="mt-1 text-[11px] leading-relaxed text-red-600" id={messageId}>
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-[11px] leading-relaxed text-faint" id={messageId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function PasswordFields({
  password,
  repeat,
  onPassword,
  onRepeat,
  passwordError,
  repeatError,
}: {
  password: string;
  repeat: string;
  onPassword: (value: string) => void;
  onRepeat: (value: string) => void;
  passwordError?: string;
  repeatError?: string;
}) {
  const rules = passwordRules(password);
  /** Sin `repeatError` (reset), se avisa apenas las contraseñas ya no coinciden. */
  const shownRepeatError =
    repeatError ?? (repeat !== "" && repeat !== password ? "Las contraseñas no coinciden." : "");
  return (
    <>
      <label className="mt-4 block text-xs font-medium text-soft" htmlFor="password">
        Contraseña
      </label>
      <input
        aria-describedby="password-rules"
        aria-invalid={passwordError ? true : undefined}
        autoComplete="new-password"
        className={field}
        id="password"
        type="password"
        value={password}
        onChange={(event) => onPassword(event.target.value)}
      />
      <ul className="mt-2 space-y-1" id="password-rules">
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
        aria-describedby={shownRepeatError ? "repeat-error" : undefined}
        aria-invalid={shownRepeatError ? true : undefined}
        autoComplete="new-password"
        className={field}
        id="repeat"
        type="password"
        value={repeat}
        onChange={(event) => onRepeat(event.target.value)}
      />
      {shownRepeatError ? (
        <p className="mt-1 text-[11px] text-red-600" id="repeat-error">
          {shownRepeatError}
        </p>
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
