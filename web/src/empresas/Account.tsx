import { Loader2 } from "lucide-react";
import { useState } from "react";
import { COMPANY_STATUS_LABEL, type Company, resendVerification, updateCompany } from "./api.ts";

const field =
  "mt-1.5 w-full rounded-xl border border-sky/70 bg-mist px-3 py-2.5 text-sm text-ink outline-none focus:border-brand";

export function Account({
  company,
  onUpdated,
  onFail,
}: {
  company: Company;
  onUpdated: (company: Company) => void;
  onFail: (cause: unknown) => void;
}) {
  const [name, setName] = useState(company.name);
  const [email, setEmail] = useState(company.email);
  const [website, setWebsite] = useState(company.website);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [changing, setChanging] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordDone, setPasswordDone] = useState(false);
  const [resent, setResent] = useState("");

  const resend = () => {
    resendVerification()
      .then((result) =>
        setResent(
          result.verified
            ? "Ya estaba confirmado."
            : "Te mandamos el enlace. Si no llega, fijate en spam o esperá diez minutos para pedir otro.",
        ),
      )
      .catch((cause: unknown) =>
        setResent(cause instanceof Error ? cause.message : "no se pudo mandar"),
      );
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setSaved(false);
    updateCompany({ name: name.trim(), email: email.trim(), website: website.trim() })
      .then((result) => {
        onUpdated(result.company);
        setSaved(true);
      })
      .catch(onFail)
      .finally(() => setSaving(false));
  };

  const changePassword = (event: React.FormEvent) => {
    event.preventDefault();
    if (changing || next.length < 8) return;

    setChanging(true);
    setPasswordError("");
    setPasswordDone(false);
    updateCompany({ current_password: current, new_password: next })
      .then(() => {
        setPasswordDone(true);
        setCurrent("");
        setNext("");
      })
      .catch((cause: unknown) =>
        setPasswordError(cause instanceof Error ? cause.message : "no se pudo cambiar"),
      )
      .finally(() => setChanging(false));
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Datos</h2>
        <p className="mt-1.5 text-xs text-faint">
          Estado: {COMPANY_STATUS_LABEL[company.status]} · URL pública: /empresa/{company.slug}
        </p>

        <form className="mt-3" onSubmit={save}>
          <label className="block text-xs font-medium text-soft" htmlFor="name">
            Nombre
          </label>
          <input
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
            className={field}
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {company.email_verified ? (
            <p className="mt-1.5 text-[11px] text-emerald-700">Confirmado.</p>
          ) : (
            <p className="mt-1.5 text-[11px] text-faint">
              Sin confirmar: por acá llegan el soporte y el cambio de contraseña.{" "}
              <button
                className="underline underline-offset-2 hover:text-ink"
                type="button"
                onClick={resend}
              >
                Mandarme el enlace
              </button>
              {resent ? <span className="block">{resent}</span> : null}
            </p>
          )}

          <label className="mt-4 block text-xs font-medium text-soft" htmlFor="website">
            Sitio web
          </label>
          <input
            className={field}
            id="website"
            placeholder="https://…"
            type="url"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />

          <div className="mt-4 flex items-center gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-panel px-3.5 py-2 text-sm font-medium text-onpanel disabled:opacity-60"
              disabled={saving}
              type="submit"
            >
              {saving ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Guardar
            </button>
            {saved ? <span className="text-xs text-emerald-700">Guardado.</span> : null}
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Contraseña</h2>
        <form className="mt-3" onSubmit={changePassword}>
          <label className="block text-xs font-medium text-soft" htmlFor="current">
            Contraseña actual
          </label>
          <input
            autoComplete="current-password"
            className={field}
            id="current"
            type="password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />

          <label className="mt-4 block text-xs font-medium text-soft" htmlFor="next">
            Nueva contraseña
          </label>
          <input
            autoComplete="new-password"
            className={field}
            id="next"
            type="password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
          />
          <p className="mt-1.5 text-[11px] text-faint">Al menos 8 caracteres.</p>

          {passwordError ? (
            <p className="mt-3 text-xs leading-relaxed text-red-600">{passwordError}</p>
          ) : null}
          {passwordDone ? (
            <p className="mt-3 text-xs text-emerald-700">Contraseña cambiada.</p>
          ) : null}

          <button
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-sky/70 px-3.5 py-2 text-sm font-medium text-ink hover:bg-mist disabled:opacity-60"
            disabled={changing || current === "" || next.length < 8}
            type="submit"
          >
            {changing ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            Cambiar contraseña
          </button>
        </form>
      </section>
    </div>
  );
}
