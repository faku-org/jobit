import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import type { Company } from "../api.ts";
import { removeMedia, uploadMedia } from "../api.ts";
import { AreaCard, quietButton } from "./shared.tsx";

interface AreaProps {
  company: Company;
  onUpdated: (company: Company) => void;
  onFail: (cause: unknown) => void;
}

/** El logo y el banner: se guardan al subirlos, no hay botón de guardar. */
export function AreaImage({ company, onUpdated, onFail }: AreaProps) {
  return (
    <AreaCard
      title="Imagen"
      description="El logo y el banner de la empresa. Se guardan solos al subirlos. PNG, JPG, WEBP o GIF."
    >
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
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
    </AreaCard>
  );
}

function ImagePicker({
  company,
  kind,
  label,
  shape,
  onUpdated,
  onFail,
}: AreaProps & { kind: "logo" | "banner"; label: string; shape: "square" | "wide" }) {
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

  return (
    <div>
      <p className="text-xs font-medium text-soft">{label}</p>
      <div
        className={`mt-1.5 grid place-items-center overflow-hidden rounded-xl border border-dashed border-sky/70 bg-mist ${
          shape === "square" ? "aspect-square" : "h-24 sm:h-full sm:min-h-24"
        }`}
      >
        {url ? (
          <img
            alt={label}
            className="size-full object-cover"
            src={`${url}?v=${encodeURIComponent(company.updated_at)}`}
          />
        ) : (
          <ImagePlus aria-hidden className="size-5 text-faint" />
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          className={quietButton}
          disabled={busy}
          type="button"
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : null}
          {url ? "Cambiar" : "Subir"}
        </button>
        {url ? (
          <button
            aria-label={`Quitar ${label}`}
            className="rounded-lg p-2 text-muted hover:bg-mist hover:text-red-600 disabled:opacity-60"
            disabled={busy}
            type="button"
            onClick={() => run(() => removeMedia(kind))}
          >
            <Trash2 aria-hidden className="size-3.5" />
          </button>
        ) : null}
      </div>
      <input
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        ref={inputRef}
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) run(() => uploadMedia(kind, file));
          event.target.value = "";
        }}
      />
    </div>
  );
}
