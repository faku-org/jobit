import { m, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { islandTransition } from '../../lib/motion.ts'
import type { Resume } from '../../lib/resume.ts'
import { sharedJobId } from '../../lib/share.ts'
import { readApplyOpen, writeApplyOpen } from '../../lib/url.ts'
import { offerView } from '../../lib/events.ts'
import { track } from '../../lib/track.ts'
import { type Application, type Job, type Tag } from '../../lib/types.ts'
import { useApplyFlow } from '../../hooks/useApplyFlow.ts'
import type { TagActions } from './JobChips.tsx'
import { JobComposePage } from './JobComposePage.tsx'
import { JobOfferPage } from './JobOfferPage.tsx'

/** Las dos páginas de la ficha: la oferta y el armado del mensaje. */
type Page = 'offer' | 'compose'

/** Lo ancho que es la ficha en cada página: la de componer lleva el formulario
 * y la vista previa lado a lado. */
const WIDTH: Record<Page, number> = { offer: 672, compose: 1040 }

interface JobModalProps {
  job: Job
  isSaved: boolean
  isDismissed: boolean
  isMatch: boolean
  isApplied: boolean
  /** La empresa es una que la persona cargó como suya; solo una marca. */
  worked?: boolean
  applications: Application[]
  /** What the chips of the sheet can do to the list behind it. */
  tagActions: TagActions
  onToggleSaved: (id: string) => void
  onToggleDismissed: (id: string) => void
  onApplied: (job: Job) => void
  /** El currículum del dispositivo: de ahí sale el mensaje de postulación. */
  resume: Resume
  onChangeResume: (resume: Resume) => void
  /** Abrir directo en la página de armar el mensaje (viene de la tarjeta). */
  startComposing?: boolean
  onClose: () => void
  /** Abre el stand de la empresa de esta oferta. */
  onOpenEmployer?: () => void
}

/**
 * The whole offer on one sheet: description, tips written for this offer, and
 * what the person already did with the offers around it. Armar el mensaje es la
 * segunda página de esta misma hoja, no un diálogo aparte.
 */
export function JobModal({
  job,
  isSaved,
  isDismissed,
  isMatch,
  isApplied,
  worked = false,
  applications,
  tagActions,
  onToggleSaved,
  onToggleDismissed,
  onApplied,
  resume,
  onChangeResume,
  startComposing = false,
  onClose,
  onOpenEmployer,
}: JobModalProps) {
  /** The sheet plays its own exit and then asks to be unmounted. */
  const [closing, setClosing] = useState(false)
  const close = useCallback(() => setClosing(true), [])
  /** Filtering by a chip is a jump back to the list, so the sheet steps aside. */
  const chipActions: TagActions = {
    ...tagActions,
    onFilter: (tag: Tag) => {
      tagActions.onFilter(tag)
      close()
    },
  }

  const flow = useApplyFlow(job, isApplied, onApplied)
  const reduceMotion = useReducedMotion() ?? false

  /* La ficha es un solo diálogo con dos páginas. Arranca en la de componer si
     viene de "Armar mensaje" de la tarjeta o de un enlace con `apply=1` a esta
     misma oferta; una oferta ya postulada no tiene mensaje que armar. */
  const [page, setPage] = useState<Page>(() =>
    !isApplied &&
    (startComposing || (sharedJobId() === job.id && readApplyOpen()))
      ? 'compose'
      : 'offer',
  )
  const composing = page === 'compose'
  /** La página de componer se carga la primera vez que se pide y después queda
   * montada: volver y entrar de nuevo no pierde lo que se estaba escribiendo. */
  const [composeSeen, setComposeSeen] = useState(composing)
  const [openedComposing] = useState(composing)

  const goCompose = useCallback(() => {
    setComposeSeen(true)
    setPage('compose')
  }, [])
  const goOffer = useCallback(() => setPage('offer'), [])

  /* La página de componer tiene su dirección (`apply=1`) y se escribe sin sumar
     un paso al historial, igual que `job`. Al irse la ficha, se saca. */
  useEffect(() => {
    writeApplyOpen(composing)
  }, [composing])
  useEffect(() => () => writeApplyOpen(false), [])

  /* El foco acompaña a la página: al cambiar, va a su título. */
  const changed = useRef(false)
  useEffect(() => {
    if (!changed.current) {
      changed.current = true
      return
    }
    document
      .getElementById(composing ? 'apply-title' : 'job-modal-title')
      ?.focus()
  }, [composing])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      /* Escape sale de a una página: del mensaje a la oferta, y de ahí cierra. */
      if (composing) goOffer()
      else close()
    }

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [close, composing, goOffer])

  /** Abrir la ficha de una oferta publicada acá cuenta como una vista para su
   * empresa; las scrapeadas no tienen a nadie del otro lado. */
  useEffect(() => {
    const own = offerView(job)
    if (own) track(own)
  }, [job])

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center sm:items-center sm:p-6">
      <m.div
        animate={{ opacity: closing ? 0 : 1 }}
        aria-hidden
        className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        onClick={close}
      />

      {/* Un solo diálogo con dos páginas: al armar el mensaje no se abre otro
          encima, la ficha se ensancha y la página de la oferta se desliza a un
          lado. Con movimiento reducido solo cambia la opacidad. */}
      <m.div
        animate={
          closing
            ? { opacity: 0, y: 24, scale: 0.98, maxWidth: WIDTH[page] }
            : { opacity: 1, y: 0, scale: 1, maxWidth: WIDTH[page] }
        }
        aria-labelledby={composing ? 'apply-title' : 'job-modal-title'}
        aria-modal
        className="relative flex h-[92svh] w-full flex-col overflow-hidden rounded-t-3xl border border-sky/50 bg-surface shadow-[var(--shadow-panel)] supports-[height:1dvh]:h-[92dvh] sm:h-[min(85svh,52rem)] sm:rounded-3xl"
        initial={{
          opacity: 0,
          y: 24,
          scale: 0.98,
          maxWidth: WIDTH[page],
        }}
        role="dialog"
        transition={{
          ...islandTransition,
          maxWidth: reduceMotion ? { duration: 0 } : islandTransition,
        }}
        onAnimationComplete={() => {
          if (closing) onClose()
        }}
      >
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <JobOfferPage
            applications={applications}
            composing={composing}
            flow={flow}
            isApplied={isApplied}
            isDismissed={isDismissed}
            isMatch={isMatch}
            isSaved={isSaved}
            job={job}
            reduceMotion={reduceMotion}
            tagActions={chipActions}
            worked={worked}
            onClose={close}
            onCompose={goCompose}
            onOpenEmployer={onOpenEmployer}
            onToggleDismissed={onToggleDismissed}
            onToggleSaved={onToggleSaved}
          />

          {composeSeen ? (
            <JobComposePage
              composing={composing}
              job={job}
              openedHere={openedComposing}
              reduceMotion={reduceMotion}
              resume={resume}
              onBack={goOffer}
              onChangeResume={onChangeResume}
              onClose={close}
              onSend={() => {
                /* Salió a postular: la ficha vuelve a la oferta, donde espera la
                   pregunta de si lo mandó. */
                flow.begin()
                goOffer()
              }}
            />
          ) : null}
        </div>
      </m.div>
    </div>
  )
}
