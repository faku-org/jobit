import { ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { SOCIAL_LABEL, SOCIAL_NETWORKS, type SocialNetwork, updateCompany } from "../api.ts";
import type { Company } from "../api.ts";
import { SocialIcon } from "../SocialIcons.tsx";
import { AreaCard, Saved, primaryButton } from "./shared.tsx";

interface AreaProps {
  company: Company;
  onUpdated: (company: Company) => void;
  onFail: (cause: unknown) => void;
}

const field =
  "w-full rounded-xl border border-sky/70 bg-mist px-3 py-2.5 text-sm text-ink outline-none focus:border-brand";

export function AreaSocials({ company, onUpdated, onFail }: AreaProps) {
  const [values, setValues] = useState<Record<SocialNetwork, string>>(() => {
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
    updateCompany({ socials: values })
      .then((result) => {
        onUpdated(result.company);
        setSaved(true);
      })
      .catch(onFail)
      .finally(() => setSaving(false));
  };

  return (
    <AreaCard
      title="Redes sociales"
      description="Poné el usuario o el enlace completo, da igual: nos fijamos cuál es y armamos la dirección."
    >
      <form onSubmit={save}>
        <div className="space-y-3">
          {SOCIAL_NETWORKS.map((network) => {
            const resolved = company.socials[network];
            return (
              <div key={network}>
                <div className="flex items-center gap-2">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-mist text-muted">
                    <SocialIcon className="size-4" network={network} />
                  </span>
                  <input
                    aria-label={SOCIAL_LABEL[network]}
                    className={field}
                    placeholder={`${SOCIAL_LABEL[network]}: usuario o enlace`}
                    value={values[network]}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [network]: event.target.value }))
                    }
                  />
                </div>
                {resolved ? (
                  <a
                    className="mt-1 ml-11 inline-flex items-center gap-1 text-[11px] text-brand underline underline-offset-2 hover:text-ink"
                    href={resolved}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <ExternalLink aria-hidden className="size-3" />
                    {resolved}
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>

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
