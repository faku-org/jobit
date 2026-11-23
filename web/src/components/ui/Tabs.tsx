import type { LucideIcon } from 'lucide-react'
import { m } from 'motion/react'
import { type KeyboardEvent, useRef } from 'react'
import { islandTransition } from '../../lib/motion.ts'

export interface TabOption<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
  /** Se muestra entre paréntesis cuando es mayor que cero. */
  count?: number
  /** Apuntar una pestaña ya es intención de abrirla: lo que hay detrás puede
   * empezar a venir antes del clic. */
  onPrefetch?: () => void
}

interface TabsProps<T extends string> {
  options: readonly TabOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Nombre del grupo para el lector de pantalla. */
  label: string
  /** Único por grupo en pantalla: es lo que desliza la píldora de una pestaña
   * a otra. */
  layoutId: string
  /** True reparte el ancho entero entre las pestañas; false las deja de su
   * tamaño, alineadas a la izquierda. */
  fill?: boolean
  className?: string
}

/**
 * Las pestañas de dentro de una sección (Mercado, Guardadas, Preferencias):
 * una barra clara con la elegida en el color del panel. Es el mismo componente
 * en todas, para que se vean y se manejen igual. Las flechas recorren las
 * pestañas, como pide el patrón de ARIA.
 */
export function Tabs<T extends string>({
  options,
  value,
  onChange,
  label,
  layoutId,
  fill = true,
  className = '',
}: TabsProps<T>) {
  const list = useRef<HTMLDivElement>(null)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    const edge =
      event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : -1
    if (step === 0 && edge === -1) return

    event.preventDefault()
    const current = options.findIndex((option) => option.value === value)
    const next =
      edge >= 0 ? edge : (current + step + options.length) % options.length
    const target = options[next]
    if (!target) return
    onChange(target.value)
    list.current
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus()
  }

  return (
    <div
      ref={list}
      aria-label={label}
      className={`gap-1 rounded-2xl border border-sky/50 bg-surface p-1 shadow-[var(--shadow-hairline)] ${
        fill
          ? 'flex flex-wrap sm:flex-nowrap'
          : 'inline-flex max-w-full flex-wrap'
      } ${className}`.trim()}
      role="tablist"
      onKeyDown={onKeyDown}
    >
      {options.map((option) => {
        const active = option.value === value
        const Icon = option.icon

        return (
          <button
            key={option.value}
            aria-selected={active}
            className={`relative flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-h-0 sm:py-2 ${
              fill ? 'grow basis-auto sm:basis-0' : ''
            } ${active ? 'text-onpanel' : 'text-muted hover:text-ink'}`}
            role="tab"
            tabIndex={active ? 0 : -1}
            type="button"
            onClick={() => onChange(option.value)}
            onFocus={option.onPrefetch}
            onMouseEnter={option.onPrefetch}
            onPointerDown={option.onPrefetch}
          >
            {active ? (
              <m.span
                className="absolute inset-0 rounded-xl bg-panel"
                layoutId={layoutId}
                transition={islandTransition}
              />
            ) : null}
            <span className="relative inline-flex items-center gap-1.5">
              {Icon ? <Icon aria-hidden className="size-3.5 shrink-0" /> : null}
              {option.label}
              {option.count ? (
                <span className="tabular-nums">({option.count})</span>
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
