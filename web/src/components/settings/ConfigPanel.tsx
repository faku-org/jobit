import type { ReactNode } from 'react'

/**
 * Una sección de Configuración. Ocupa el alto que le queda a la página y no
 * crece hacia abajo: lo que adentro no entra en una columna sigue en la de al
 * lado (columnas CSS de `--config-col` de ancho, llenadas de arriba abajo). El
 * texto en nuestro alfabeto corre en horizontal, así que una sección larga se
 * lee mejor en dos o tres columnas que en un scroll.
 *
 * Cada hijo directo de `children` es un bloque que no se parte entre columnas.
 * Un componente que devuelve todo dentro de un solo `div` tiene que devolver
 * sus grupos como fragmento (o con `contents`) para que puedan repartirse.
 *
 * En el teléfono no hay ancho para columnas: ahí la sección va de corrido.
 */
export function ConfigPanel({
  id,
  title,
  hint,
  children,
}: {
  /** El ancla que un enlace puede nombrar (`?view=settings#cv`). */
  id: string
  title: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex min-h-0 flex-1 flex-col rounded-3xl bg-panel p-5 text-onpanel shadow-[var(--shadow-panel)] sm:p-6"
      id={id}
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2
          className="text-base font-semibold tracking-tight text-onpanel"
          id={`${id}-title`}
        >
          {title}
        </h2>
        {hint ? (
          <p className="text-xs leading-relaxed text-onpanel-muted">{hint}</p>
        ) : null}
      </header>
      <div className="config-columns mt-4 min-h-0 flex-1" data-config-body={id}>
        {children}
      </div>
    </section>
  )
}
