import type { ReactNode } from "react";

/** El estilo de los campos, uno solo para que todas las áreas se vean igual. */
export const inputClass =
  "mt-1.5 w-full rounded-xl border border-sky/70 bg-mist px-3 py-2.5 text-sm text-ink outline-none focus:border-brand";

export const labelClass = "block text-xs font-medium text-soft";

export const primaryButton =
  "inline-flex items-center gap-2 rounded-xl bg-panel px-3.5 py-2 text-sm font-medium text-onpanel disabled:opacity-60";

export const quietButton =
  "inline-flex items-center gap-2 rounded-xl border border-sky/70 px-3.5 py-2 text-sm font-medium text-ink hover:bg-mist disabled:opacity-60";

/** Cada área es una tarjeta con su título, su explicación y su propio guardado:
 * así se puede cerrar una sin tocar las demás. */
export function AreaCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-sky/60 bg-surface p-4 sm:p-5">
      <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** El aviso de "guardado" con el que termina cada área. */
export function Saved({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-xs text-emerald-700">Guardado.</span>;
}
