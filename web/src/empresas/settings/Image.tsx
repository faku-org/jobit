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

/** Los tamaños a los que el logo se dibuja en el tablero, para verlo antes de
 * quedarse con una versión que a 24 px no se lee. */
const LOGO_SIZES = [24, 32, 48, 64];

/** El logo va arriba y el banner abajo, cada uno a lo ancho de la tarjeta: el
 * banner es apaisado y en dos columnas se desbordaba. Se guardan al subirlos,
 * no hay botón de guardar. */
export function AreaImage({ company, onUpdated, onFail }: AreaProps) {
  return (
    <AreaCard
      title="Imagen"
      description="El logo y el banner de la empresa. Se guardan solos al subirlos. PNG, JPG, WEBP o GIF."
    >
      <div className="space-y-6">
        <LogoPicker company={company} onUpdated={onUpdated} onFail={onFail} />
        <BannerPicker company={company} onUpdated={onUpdated} onFail={onFail} />
      </div>
    </AreaCard>
  );
}

function useImage(
  company: Company,
  kind: "logo" | "banner",
  onUpdated: (company: Company) => void,
  onFail: (cause: unknown) => void,
) {
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

  const input = (
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
  );

  const actions = (
    <div className="mt-3 flex items-center gap-2">
      <button
        className={quietButton}
        disabled={busy}
        type="button"
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <ImagePlus aria-hidden className="size-3.5" />}
        {url ? "Cambiar" : "Subir"}
      </button>
      {url ? (
        <button
          aria-label={`Quitar ${kind === "logo" ? "el logo" : "el banner"}`}
          className="rounded-lg p-2 text-muted hover:bg-mist hover:text-red-600 disabled:opacity-60"
          disabled={busy}
          type="button"
          onClick={() => run(() => removeMedia(kind))}
        >
          <Trash2 aria-hidden className="size-3.5" />
        </button>
      ) : null}
    </div>
  );

  return { url, busy, input, actions, imageSrc: url ? `${url}?v=${encodeURIComponent(company.updated_at)}` : "" };
}

function LogoPicker({ company, onUpdated, onFail }: AreaProps) {
  const { input, actions, imageSrc } = useImage(company, "logo", onUpdated, onFail);

  return (
    <div>
      <p className="text-xs font-medium text-soft">Logo</p>
      <div className="mt-1.5 flex flex-wrap items-start gap-5">
        <div className="shrink-0">
          <div className="grid size-24 place-items-center overflow-hidden rounded-2xl border border-dashed border-sky/70 bg-mist">
            {imageSrc ? (
              <img alt="Logo" className="size-full object-cover" src={imageSrc} />
            ) : (
              <ImagePlus aria-hidden className="size-5 text-faint" />
            )}
          </div>
          {actions}
        </div>

        {imageSrc ? (
          <div className="min-w-0">
            <p className="text-[11px] text-faint">Así se ve a cada tamaño:</p>
            <div className="mt-2 flex items-end gap-3">
              {LOGO_SIZES.map((size) => (
                <span key={size} className="flex flex-col items-center gap-1.5">
                  <span
                    className="grid overflow-hidden rounded-lg border border-sky/50 bg-mist"
                    style={{ width: size, height: size }}
                  >
                    <img alt={`Logo a ${size} píxeles`} className="size-full object-cover" src={imageSrc} />
                  </span>
                  <span className="text-[10px] tabular-nums text-faint">{size}px</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {input}
    </div>
  );
}

function BannerPicker({ company, onUpdated, onFail }: AreaProps) {
  const { input, actions, imageSrc } = useImage(company, "banner", onUpdated, onFail);

  return (
    <div>
      <p className="text-xs font-medium text-soft">Banner</p>
      <div className="mt-1.5 grid aspect-[16/5] w-full place-items-center overflow-hidden rounded-xl border border-dashed border-sky/70 bg-mist">
        {imageSrc ? (
          <img alt="Banner" className="size-full object-cover" src={imageSrc} />
        ) : (
          <ImagePlus aria-hidden className="size-5 text-faint" />
        )}
      </div>
      {actions}
      {input}
    </div>
  );
}
