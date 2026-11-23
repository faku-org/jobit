import { ArrowLeft, X } from 'lucide-react'
import { m } from 'motion/react'
import { Suspense, lazy } from 'react'
import { islandTransition } from '../../lib/motion.ts'
import type { Resume } from '../../lib/resume.ts'
import { iconButtonClass } from '../../lib/styles.ts'
import type { Job } from '../../lib/types.ts'

const ApplyMessage = lazy(() =>
  import('./ApplyMessage.tsx').then((module) => ({
    default: module.ApplyMessage,
  })),
)

interface JobComposePageProps {
  job: Job
  resume: Resume
  onChangeResume: (resume: Resume) => void
  /** La ficha está en esta página: si no, queda a la derecha, inerte. */
  composing: boolean
  /** Se abrió ya en esta página: no hace falta deslizarla desde la derecha. */
  openedHere: boolean
  reduceMotion: boolean
  onBack: () => void
  onClose: () => void
  /** Salió a postular: la ficha vuelve a la oferta y registra la postulación. */
  onSend: () => void
}

/**
 * La segunda página de la ficha: armar el mensaje con su vista previa. Es parte
 * del mismo diálogo, no otro encima: entra deslizándose desde la derecha.
 */
export function JobComposePage({
  job,
  resume,
  onChangeResume,
  composing,
  openedHere,
  reduceMotion,
  onBack,
  onClose,
  onSend,
}: JobComposePageProps) {
  return (
    <m.div
      animate={{
        opacity: composing ? 1 : 0,
        x: composing || reduceMotion ? '0%' : '100%',
      }}
      className="absolute inset-0 flex flex-col"
      initial={
        openedHere ? false : { opacity: 0, x: reduceMotion ? '0%' : '100%' }
      }
      inert={!composing}
      transition={islandTransition}
    >
      <header className="flex items-start gap-2 border-b border-sky/40 px-4 py-3 sm:gap-3 sm:px-5 sm:py-4">
        <button
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-sky/60 px-3 py-2 text-xs font-medium text-soft transition-colors hover:border-brand hover:text-ink"
          type="button"
          onClick={onBack}
        >
          <ArrowLeft aria-hidden className="size-4" />
          <span className="hidden sm:inline">Volver a la ficha</span>
          <span className="sm:hidden">Volver</span>
        </button>
        <div className="min-w-0 flex-1">
          <h2
            className="text-[19px] leading-snug font-semibold tracking-tight text-ink focus:outline-none"
            id="apply-title"
            tabIndex={-1}
          >
            Armar mensaje
          </h2>
          <p className="mt-0.5 truncate text-sm text-soft">
            {job.title}
            {job.company ? ` · ${job.company}` : ''}
          </p>
        </div>
        <m.button
          aria-label="Cerrar"
          className={iconButtonClass}
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
        >
          <X aria-hidden className="size-4" />
        </m.button>
      </header>

      <Suspense fallback={null}>
        <ApplyMessage
          job={job}
          resume={resume}
          onChangeResume={onChangeResume}
          onSend={onSend}
        />
      </Suspense>
    </m.div>
  )
}
