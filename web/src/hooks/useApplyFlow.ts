import { useCallback, useState } from 'react'
import { applyEvent, offerApply, offerClick } from '../lib/events.ts'
import { track } from '../lib/track.ts'
import type { Job } from '../lib/types.ts'

export interface ApplyFlow {
  /** Falta preguntar si mandó la postulación. */
  asking: boolean
  /** La persona sale a postular, por el enlace del aviso o por el mensaje
   * armado: se cuenta igual y al volver sigue la pregunta. */
  begin: () => void
  /** "Sí, seguir esta": la oferta pasa a la lista de seguimiento. */
  confirm: () => void
  dismiss: () => void
}

/**
 * Salir a postular y, al volver a la pestaña, preguntar si de verdad se mandó:
 * solo un sí pone la oferta en seguimiento. Vive fuera del pie para que la
 * página de armar mensaje y la de la ficha compartan la misma pregunta.
 */
export function useApplyFlow(
  job: Job,
  isApplied: boolean,
  onApplied: (job: Job) => void,
): ApplyFlow {
  const [asked, setAsked] = useState(false)

  const begin = useCallback(() => {
    track(applyEvent(job))
    /* Salir al aviso es el clic: el interés, no la postulación. */
    const click = offerClick(job)
    if (click) track(click)
    setAsked(!isApplied)
  }, [job, isApplied])

  const confirm = useCallback(() => {
    /* La postulación cuenta solo cuando la persona confirma que la mandó. */
    const own = offerApply(job)
    if (own) track(own)
    onApplied(job)
    setAsked(false)
  }, [job, onApplied])

  const dismiss = useCallback(() => setAsked(false), [])

  return { asking: asked && !isApplied, begin, confirm, dismiss }
}
