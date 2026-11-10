import { Megaphone } from 'lucide-react'
import { FEATURED_HINT, FEATURED_LABEL } from '../../lib/services.ts'
import { chipClass } from '../../lib/styles.ts'

/**
 * La marca de un destacado. Va con texto y con ícono, nunca solo con color, y
 * el ícono no es una estrella: una estrella se lee como calificación y esto es
 * lo contrario, algo que no tiene que ver con cómo le fue a nadie.
 */
export function FeaturedBadge() {
  return (
    <span className={`${chipClass} bg-mist text-brand`} title={FEATURED_HINT}>
      <Megaphone aria-hidden className="size-3.5" />
      {FEATURED_LABEL}
      <span className="sr-only">. {FEATURED_HINT}</span>
    </span>
  )
}
