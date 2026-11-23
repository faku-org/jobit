import type { ReactNode } from 'react'

/**
 * Una sección de una página propia. Es un panel como el de la isla —los
 * controles de cada bloque están hechos para ese fondo—, así que cada tarjeta lo
 * conserva y la página se lee de corrido, sin acordeones ni pestañas adentro.
 */
export function PanelSection({
  id,
  title,
  hint,
  children,
}: {
  /** El ancla que un enlace puede nombrar (`/?view=profile#cv`). */
  id: string
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 rounded-3xl bg-panel p-5 text-onpanel shadow-[var(--shadow-panel)] sm:p-6"
      id={id}
    >
      <h2
        className="text-base font-semibold tracking-tight text-onpanel"
        id={`${id}-title`}
      >
        {title}
      </h2>
      {hint ? (
        <p className="mt-1 text-xs leading-relaxed text-onpanel-muted">
          {hint}
        </p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  )
}
