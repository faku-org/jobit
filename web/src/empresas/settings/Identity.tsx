import { BadgeCheck, Check, Copy, Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { splitPhone, composePhone } from "../../lib/countries.ts";
import type { Company } from "../api.ts";
import { updateCompany, verifyWebsite } from "../api.ts";
import { PhoneField } from "../PhoneField.tsx";
import { AreaCard, Saved, inputClass, labelClass, primaryButton, quietButton } from "./shared.tsx";

interface AreaProps {
  company: Company;
  onUpdated: (company: Company) => void;
  onFail: (cause: unknown) => void;
}

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export function AreaIdentity({ company, onUpdated, onFail }: AreaProps) {
  const seed = splitPhone(company.phone, company.phone_country);
  const [name, setName] = useState(company.name);
  const [iso, setIso] = useState(seed.iso);
  const [national, setNational] = useState(seed.national);
  const [website, setWebsite] = useState(company.website);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const nameError = name.trim().length < 2 ? "Poné el nombre de la empresa." : "";
  const websiteError =
    website.trim() !== "" && !isHttpUrl(website.trim())
      ? "Tiene que ser una dirección completa, con https://."
      : "";
  const phoneError =
    national.trim() !== "" && !/^[\d\s()+-]+$/.test(national)
      ? "El número solo lleva dígitos y separadores."
      : "";
  const ready = !nameError && !websiteError && !phoneError && !saving;

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready) {
      setTouched({ name: true, website: true, phone: true });
      return;
    }

    setSaving(true);
    setSaved(false);
    updateCompany({
      name: name.trim(),
      phone: composePhone(iso, national),
      phone_country: iso,
      website: website.trim(),
    })
      .then((result) => {
        onUpdated(result.company);
        setSaved(true);
      })
      .catch(onFail)
      .finally(() => setSaving(false));
  };

  return (
    <AreaCard
      title="Identidad"
      description="El nombre, el teléfono con su país y el sitio. El sitio se verifica por DNS para que sea de verdad tuyo."
    >
      <form onSubmit={save}>
        <label className={labelClass} htmlFor="name">
          Nombre
        </label>
        <input
          aria-invalid={touched.name && nameError ? true : undefined}
          className={inputClass}
          id="name"
          type="text"
          value={name}
          onBlur={() => setTouched((current) => ({ ...current, name: true }))}
          onChange={(event) => setName(event.target.value)}
        />
        {touched.name && nameError ? (
          <p className="mt-1 text-[11px] text-red-600">{nameError}</p>
        ) : null}

        <span className={`${labelClass} mt-4 block`}>Teléfono</span>
        <PhoneField
          error={touched.phone ? phoneError : ""}
          iso={iso}
          national={national}
          onIso={setIso}
          onNational={(value) => {
            setNational(value);
            setTouched((current) => ({ ...current, phone: true }));
          }}
        />

        <label className={`${labelClass} mt-4`} htmlFor="website">
          Sitio web
        </label>
        <input
          aria-invalid={touched.website && websiteError ? true : undefined}
          className={inputClass}
          id="website"
          placeholder="https://…"
          type="url"
          value={website}
          onBlur={() => setTouched((current) => ({ ...current, website: true }))}
          onChange={(event) => {
            setWebsite(event.target.value);
            setTouched((current) => ({ ...current, website: true }));
          }}
        />
        {touched.website && websiteError ? (
          <p className="mt-1 text-[11px] text-red-600">{websiteError}</p>
        ) : null}

        <div className="mt-4 flex items-center gap-3">
          <button className={primaryButton} disabled={!ready} type="submit">
            {saving ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            Guardar
          </button>
          <Saved show={saved} />
        </div>
      </form>

      {company.website ? (
        <WebsiteVerification company={company} onUpdated={onUpdated} onFail={onFail} />
      ) : null}
    </AreaCard>
  );
}

function WebsiteVerification({ company, onUpdated, onFail }: AreaProps) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const verification = company.website_verification;

  if (!verification) return null;

  const check = () => {
    setBusy(true);
    setMessage("");
    verifyWebsite()
      .then((result) => {
        onUpdated(result.company);
        setMessage(
          result.verified
            ? "Listo: el dominio quedó verificado."
            : (result.error ?? "No encontramos el registro."),
        );
      })
      .catch(onFail)
      .finally(() => setBusy(false));
  };

  const copy = () => {
    void navigator.clipboard.writeText(verification.record_value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="mt-5 rounded-xl border border-sky/60 bg-mist p-3.5">
      <div className="flex items-center gap-2">
        {verification.verified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
            <BadgeCheck aria-hidden className="size-3" />
            Dominio verificado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
            <ShieldAlert aria-hidden className="size-3" />
            Sin verificar
          </span>
        )}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-soft">
        Cargá este registro TXT en el DNS de <strong className="font-medium">{verification.host}</strong>.
        El sitio queda verificado mientras el registro exista; se vuelve a comprobar cada 24 horas.
      </p>

      <dl className="mt-2 space-y-1.5">
        <div>
          <dt className="text-[10px] font-semibold tracking-wide text-faint uppercase">Nombre</dt>
          <dd className="font-mono text-[11px] break-all text-ink">{verification.record_name}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold tracking-wide text-faint uppercase">Valor</dt>
          <dd className="flex items-start gap-2">
            <code className="min-w-0 flex-1 font-mono text-[11px] break-all text-ink">
              {verification.record_value}
            </code>
            <button
              className="shrink-0 rounded-lg border border-sky/70 p-1.5 text-muted hover:bg-surface hover:text-ink"
              type="button"
              onClick={copy}
            >
              {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
            </button>
          </dd>
        </div>
      </dl>

      {message ? <p className="mt-2 text-[11px] leading-relaxed text-soft">{message}</p> : null}

      <button className={`${quietButton} mt-3`} disabled={busy} type="button" onClick={check}>
        {busy ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : null}
        Verificar ahora
      </button>
    </div>
  );
}
