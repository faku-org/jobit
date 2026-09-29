import { ImagePlus, Loader2, Lock, ShieldCheck, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import {
  type Company,
  COMPANY_STATUS_LABEL,
  SOCIAL_LABEL,
  SOCIAL_NETWORKS,
  type SocialNetwork,
  removeMedia,
  updateCompany,
  uploadMedia,
} from "./api.ts";
import { CompanyEmails } from "./CompanyEmails.tsx";
import { Members } from "./Members.tsx";
import { MIN_PASSWORD, passwordOk, passwordRules } from "../lib/password.ts";
import { SocialIcon } from "./SocialIcons.tsx";

const field =
  "mt-1.5 w-full rounded-xl border border-sky/70 bg-mist px-3 py-2.5 text-sm text-ink outline-none focus:border-brand";

interface SectionProps {
  company: Company;
  onUpdated: (company: Company) => void;
  onFail: (cause: unknown) => void;
}

export function Account({ company, onUpdated, onFail }: SectionProps) {
  return (
    <div className="space-y-8">
      <ProfileSection company={company} onUpdated={onUpdated} onFail={onFail} />
      <CompanyEmails company={company} onUpdated={onUpdated} onFail={onFail} />
      <Members company={company} onUpdated={onUpdated} onFail={onFail} />
      <SecuritySection company={company} onUpdated={onUpdated} onFail={onFail} />
    </div>
  );
}

/* --- Perfil ---------------------------------------------------------------- */

function ProfileSection({ company, onUpdated, onFail }: SectionProps) {
  const [name, setName] = useState(company.name);
  const [phone, setPhone] = useState(company.phone);
  const [website, setWebsite] = useState(company.website);
  const [socials, setSocials] = useState<Record<SocialNetwork, string>>(() => {
    const out = {} as Record<SocialNetwork, string>;
    for (const network of SOCIAL_NETWORKS) out[network] = company.socials[network] ?? "";
    return out;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setSaved(false);
    updateCompany({ name: name.trim(), phone: phone.trim(), website: website.trim(), socials })
      .then((result) => {
        onUpdated(result.company);
        setSaved(true);
      })
      .catch(onFail)
      .finally(() => setSaving(false));
  };

  return (
    <section>
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Perfil</h2>
      <p className="mt-1.5 text-xs text-faint">
        {COMPANY_STATUS_LABEL[company.status]} · URL pública: /empresa/{company.slug}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_1fr]">
        <ImagePicker
          company={company}
          kind="logo"
          label="Logo"
          shape="square"
          onUpdated={onUpdated}
          onFail={onFail}
        />
        <ImagePicker
          company={company}
          kind="banner"
          label="Banner"
          shape="wide"
          onUpdated={onUpdated}
          onFail={onFail}
        />
      </div>

      <form className="mt-4" onSubmit={save}>
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

        <label className="mt-4 block text-xs font-medium text-soft" htmlFor="phone">
          Teléfono
        </label>
        <input
          className={field}
          id="phone"
          placeholder="+598 99 123 456"
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />

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

        <p className="mt-5 text-xs font-semibold tracking-wide text-muted uppercase">Redes</p>
        <div className="mt-2 space-y-2">
          {SOCIAL_NETWORKS.map((network) => (
            <div className="flex items-center gap-2" key={network}>
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-mist text-muted">
                <SocialIcon className="size-4" network={network} />
              </span>
              <input
                aria-label={SOCIAL_LABEL[network]}
                className="w-full rounded-lg border border-sky/70 bg-mist px-2.5 py-2 text-sm text-ink outline-none focus:border-brand"
                placeholder={`Enlace de ${SOCIAL_LABEL[network]}`}
                type="url"
                value={socials[network]}
                onChange={(event) =>
                  setSocials((current) => ({ ...current, [network]: event.target.value }))
                }
              />
            </div>
          ))}
        </div>

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
  );
}

function ImagePicker({
  company,
  kind,
  label,
  shape,
  onUpdated,
  onFail,
}: SectionProps & { kind: "logo" | "banner"; label: string; shape: "square" | "wide" }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const url = kind === "logo" ? company.logo : company.banner;

  const run = (task: () => Promise<{ company: Company }>) => {
    setBusy(true);
    task()
      .then((result) => onUpdated(result.company))
      .catch(onFail)
      .finally(() => setBusy(false));
  };

  const choose = (file: File | undefined) => {
    if (!file) return;
    run(() => uploadMedia(kind, file));
  };

  return (
    <div>
      <p className="text-xs font-medium text-soft">{label}</p>
      <div
        className={`mt-1.5 grid place-items-center overflow-hidden rounded-xl border border-dashed border-sky/70 bg-mist ${
          shape === "square" ? "aspect-square" : "aspect-[3/1] sm:aspect-auto sm:h-full sm:min-h-24"
        }`}
      >
        {url ? (
          <img
            alt={label}
            className={shape === "square" ? "size-full object-cover" : "h-full w-full object-cover"}
            src={`${url}?v=${encodeURIComponent(company.updated_at)}`}
          />
        ) : (
          <ImagePlus aria-hidden className="size-5 text-faint" />
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          className="rounded-lg border border-sky/70 px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-mist disabled:opacity-60"
          disabled={busy}
          type="button"
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : url ? "Cambiar" : "Subir"}
        </button>
        {url ? (
          <button
            aria-label={`Quitar ${label}`}
            className="rounded-lg p-1.5 text-muted hover:bg-mist hover:text-red-600 disabled:opacity-60"
            disabled={busy}
            type="button"
            onClick={() => run(() => removeMedia(kind))}
          >
            <Trash2 aria-hidden className="size-3.5" />
          </button>
        ) : null}
        <span className="text-[10px] text-faint">PNG, JPG, WEBP o GIF</span>
      </div>
      <input
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        ref={inputRef}
        type="file"
        onChange={(event) => {
          choose(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}

/* --- Seguridad ------------------------------------------------------------- */

function SecuritySection({ company, onUpdated, onFail }: SectionProps) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [changing, setChanging] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const rules = passwordRules(next);
  const ready = current !== "" && passwordOk(next) && repeat === next;

  const change = (event: React.FormEvent) => {
    event.preventDefault();
    if (changing || !ready) return;

    setChanging(true);
    setError("");
    setDone(false);
    updateCompany({ current_password: current, new_password: next })
      .then((result) => {
        onUpdated(result.company);
        setDone(true);
        setCurrent("");
        setNext("");
        setRepeat("");
      })
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : "";
        setError(message);
        if (!message) onFail(cause);
      })
      .finally(() => setChanging(false));
  };

  return (
    <section>
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Seguridad</h2>

      <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-mist px-3 py-2.5">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-700" />
        <p className="text-[11px] leading-relaxed text-soft">
          El <strong className="font-medium">segundo paso está activo</strong> y es obligatorio: sin
          el código de tu app de autenticación no se entra. Te quedan{" "}
          {company.recovery_codes_left} códigos de respaldo sin usar.
        </p>
      </div>

      <form className="mt-4" onSubmit={change}>
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
          Repetí la contraseña nueva
        </label>
        <input
          autoComplete="new-password"
          className={field}
          id="repeat"
          type="password"
          value={repeat}
          onChange={(event) => setRepeat(event.target.value)}
        />
        {repeat !== "" && repeat !== next ? (
          <p className="mt-1 text-[11px] text-red-600">Las contraseñas no coinciden.</p>
        ) : null}
        <p className="mt-1 text-[11px] text-faint">Mínimo {MIN_PASSWORD} caracteres.</p>

        {error ? <p className="mt-3 text-xs leading-relaxed text-red-600">{error}</p> : null}
        {done ? <p className="mt-3 text-xs text-emerald-700">Contraseña cambiada.</p> : null}

        <button
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-sky/70 px-3.5 py-2 text-sm font-medium text-ink hover:bg-mist disabled:opacity-60"
          disabled={changing || !ready}
          type="submit"
        >
          {changing ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Lock aria-hidden className="size-3.5" />}
          Cambiar contraseña
        </button>
      </form>
    </section>
  );
}
