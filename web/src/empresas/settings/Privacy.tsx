import { Loader2 } from "lucide-react";
import { useState } from "react";
import { PRIVACY_LABEL, type Privacy, updateCompany } from "../api.ts";
import type { Company } from "../api.ts";
import { AreaCard, Saved, primaryButton } from "./shared.tsx";

interface AreaProps {
  company: Company;
  onUpdated: (company: Company) => void;
  onFail: (cause: unknown) => void;
}

const KEYS = Object.keys(PRIVACY_LABEL) as (keyof Privacy)[];

export function AreaPrivacy({ company, onUpdated, onFail }: AreaProps) {
  const [privacy, setPrivacy] = useState<Privacy>(company.privacy);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setSaved(false);
    updateCompany({ privacy })
      .then((result) => {
        onUpdated(result.company);
        setSaved(true);
      })
      .catch(onFail)
      .finally(() => setSaving(false));
  };

  return (
    <AreaCard
      title="Privacidad"
      description="Qué se muestra en la ficha pública de la empresa. Lo que apagues no se publica, aunque esté cargado."
    >
      <form onSubmit={save}>
        <ul className="space-y-3">
          {KEYS.map((key) => (
            <li key={key}>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  checked={privacy[key]}
                  className="mt-0.5 size-4 shrink-0 accent-brand"
                  type="checkbox"
                  onChange={(event) =>
                    setPrivacy((current) => ({ ...current, [key]: event.target.checked }))
                  }
                />
                <span>
                  <span className="block text-sm font-medium text-ink">{PRIVACY_LABEL[key].label}</span>
                  <span className="block text-[11px] leading-relaxed text-muted">
                    {PRIVACY_LABEL[key].hint}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center gap-3">
          <button className={primaryButton} disabled={saving} type="submit">
            {saving ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            Guardar
          </button>
          <Saved show={saved} />
        </div>
      </form>
    </AreaCard>
  );
}
