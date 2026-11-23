import type { ReactNode } from 'react'

interface PanelSectionProps {
  title: string
  children: ReactNode
}

/**
 * Un tema dentro de la página de perfil: título y contenido a la vista, sin
 * nada que abrir. Cuando era un acordeón dentro de la isla cada grupo cerrado
 * escondía lo que había cargado; ahora que hay una página entera, ver todo de
 * corrido es lo más simple y se llega a cada parte con su ancla.
 */
export function PanelSection({ title, children }: PanelSectionProps) {
  return (
    <section className="space-y-5 border-t border-onpanel/10 pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold tracking-tight text-onpanel">
        {title}
      </h3>
      {children}
    </section>
  )
}
