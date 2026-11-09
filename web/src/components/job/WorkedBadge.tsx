import { Check } from 'lucide-react'
import { chipClass } from '../../lib/styles.ts'

/**
 * "Ya trabajaste acá": la oferta es de una empresa que la persona cargó en su
 * perfil. Solo marca, no filtra. Va con texto además del ícono, así no depende
 * del color, y el chip corta en dos líneas antes de desbordar la tarjeta.
 */
export function WorkedBadge() {
  return (
    <span className={`${chipClass} max-w-full bg-brand/15 text-ink`}>
      <Check aria-hidden className="size-3.5 shrink-0 text-brand" />
      Ya trabajaste acá
    </span>
  )
}
