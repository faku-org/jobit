import { ArrowLeft } from 'lucide-react'
import { type ReactNode, useEffect, useRef } from 'react'

interface PageHeaderProps {
  title: string
  /** Una o dos líneas que dicen qué hay en la página. */
  lead?: ReactNode
  /** Lo que sigue al título (ícono de la página). */
  icon?: ReactNode
  onBack: () => void
}

/**
 * El encabezado común de las páginas propias (perfil, novedades, ayuda, test):
 * sin pestañas, con el botón para volver a las ofertas arriba y el título como
 * primer foco, así quien entra con el teclado o con un lector de pantalla cae
 * en lo que se abrió y no en el menú.
 */
export function PageHeader({ title, lead, icon, onBack }: PageHeaderProps) {
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    /* Un enlace con ancla (#cv) lleva a su sección: no hay que robarle el foco. */
    if (window.location.hash) return
    heading.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div className="space-y-4">
      <button
        className="inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        type="button"
        onClick={onBack}
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        Volver a las ofertas
      </button>

      <div className="flex items-start gap-3">
        {icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-brand shadow-[var(--shadow-hairline)]">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h1
            ref={heading}
            className="text-xl font-semibold tracking-tight text-ink outline-none sm:text-2xl"
            tabIndex={-1}
          >
            {title}
          </h1>
          {lead ? (
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{lead}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
