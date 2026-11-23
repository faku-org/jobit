import { Check, EyeOff, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Facet, Stance, StanceLists } from '../../lib/types.ts'
import { nextStance, setStance, stanceOf } from '../../lib/types.ts'

/** The chip and group used by both sheets inside the island. */
export function PanelChip({
  active,
  children,
  disabled = false,
  onClick,
}: {
  active: boolean
  children: ReactNode
  /** Se ve pero no se puede elegir (un idioma que todavía no está). */
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      aria-pressed={active}
      disabled={disabled}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-xs ${
        active
          ? 'bg-sky text-ink'
          : 'bg-onpanel-wash text-onpanel/75 hover:bg-onpanel/20 hover:text-onpanel'
      } disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-onpanel-wash disabled:hover:text-onpanel/75`}
      type="button"
      onClick={onClick}
    >
      {active ? <Check aria-hidden className="size-3" /> : null}
      {children}
    </button>
  )
}

/** Campo de texto dentro de la isla: 44 px de alto en el celular, el mismo
 * borde que las fuentes propias. */
export const panelInputClass =
  'w-full min-h-11 rounded-lg border border-onpanel/20 bg-onpanel/5 px-3 py-2 text-sm text-onpanel outline-none transition-colors placeholder:text-onpanel-faint focus:border-sky aria-[invalid=true]:border-onpanel sm:min-h-9'

/** Botón chico de acción (agregar, descargar), con el mismo peso que el resto. */
export const panelButtonClass =
  'inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-onpanel-wash px-3 text-xs font-medium text-onpanel/80 transition-colors hover:bg-onpanel/20 hover:text-onpanel sm:min-h-9'

/** El botón de quitar una fila: sólo ícono, así que lleva nombre accesible. */
export const panelRemoveClass =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-onpanel/60 transition-colors hover:bg-onpanel-wash hover:text-onpanel sm:size-9'

/** Etiqueta de un campo, con el mismo título chico que los grupos. */
export function PanelField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div>
      <label
        className="text-[0.6875rem] font-semibold tracking-wide text-onpanel-muted uppercase"
        htmlFor={htmlFor}
      >
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {hint ? (
        <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-onpanel-faint">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function PanelGroup({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div>
      <p className="text-[0.6875rem] font-semibold tracking-wide text-onpanel-muted uppercase">
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

const STANCE_STYLE: Record<Stance, string> = {
  wanted: 'bg-sky text-ink',
  hidden:
    'bg-onpanel-wash text-onpanel-faint line-through decoration-onpanel-faint',
  neutral:
    'bg-onpanel-wash text-onpanel/75 hover:bg-onpanel/20 hover:text-onpanel',
}

const STANCE_HINT: Record<Stance, string> = {
  wanted: 'Lo querés: tocá para ocultarlo',
  hidden: 'Está oculto: tocá para volver a verlo',
  neutral: 'Tocá para priorizarlo',
}

/**
 * One chip per rubro or departamento, cycling through the three things a
 * person can mean: lo quiero, me da igual, no me lo muestres. Two separate
 * controls for "preferir" and "ocultar" would let both be set at once, which
 * cannot mean anything.
 */
export function StanceChips({
  title,
  hint,
  facets,
  lists,
  onChange,
}: {
  title: string
  hint: string
  facets: Facet[]
  lists: StanceLists
  onChange: (lists: StanceLists) => void
}) {
  return (
    <div>
      <p className="text-[0.6875rem] font-semibold tracking-wide text-onpanel-muted uppercase">
        {title}
      </p>
      <p className="mt-0.5 text-[0.6875rem] leading-snug text-onpanel-faint">
        {hint}
      </p>

      <div className="mt-1.5 flex flex-wrap gap-1">
        {facets.map((facet) => {
          const stance = stanceOf(lists, facet.value)
          return (
            <button
              key={facet.value}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors sm:min-h-0 sm:px-2.5 sm:py-1 sm:text-xs ${STANCE_STYLE[stance]}`}
              title={STANCE_HINT[stance]}
              type="button"
              onClick={() =>
                onChange(setStance(lists, facet.value, nextStance(stance)))
              }
            >
              {stance === 'wanted' ? (
                <Star aria-hidden className="size-3 fill-current" />
              ) : null}
              {stance === 'hidden' ? (
                <EyeOff aria-hidden className="size-3" />
              ) : null}
              {facet.label}
              <span className="text-[0.625rem] opacity-60 tabular-nums">
                {facet.count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
