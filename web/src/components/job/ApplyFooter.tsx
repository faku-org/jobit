import { ArrowUpRight, CheckCheck, MessageSquareText } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import type { ReactNode } from 'react'
import type { ApplyFlow } from '../../hooks/useApplyFlow.ts'
import { fadeUpTransition } from '../../lib/motion.ts'
import { chipClass } from '../../lib/styles.ts'
import type { Job } from '../../lib/types.ts'

interface ApplyFooterProps {
  job: Job
  isApplied: boolean
  /** La pregunta de "¿te postulaste?" y lo que cuenta salir a postular. */
  flow: ApplyFlow
  /** "Armar mensaje": abre la página de componer de la ficha. */
  onCompose: () => void
  /** Slot for whatever the host wants on the left of the row. */
  left?: ReactNode
}

const answerClass =
  'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors'

/**
 * Opens the offer on the job board and, back in the tab, asks whether the
 * application was actually sent: only a yes puts it on the follow-up list.
 * Armar el mensaje no pasa acá: es otra página de la ficha, no algo que se
 * abre dentro del pie.
 */
export function ApplyFooter({
  job,
  isApplied,
  flow,
  onCompose,
  left,
}: ApplyFooterProps) {
  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {flow.asking ? (
          <m.div
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            initial={{ opacity: 0, y: -4 }}
            transition={fadeUpTransition}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/50 bg-mist px-3 py-2.5">
              <p className="text-xs text-soft">¿Te postulaste finalmente?</p>
              <div className="flex gap-1.5">
                <button
                  className={`${answerClass} bg-panel text-onpanel hover:bg-brand`}
                  type="button"
                  onClick={flow.confirm}
                >
                  Sí, seguir esta
                </button>
                <button
                  className={`${answerClass} text-muted hover:bg-sky/25 hover:text-ink`}
                  type="button"
                  onClick={flow.dismiss}
                >
                  Todavía no
                </button>
              </div>
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {left ?? <span />}

        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          {isApplied ? (
            <span className={`${chipClass} bg-brand/15 text-ink`}>
              <CheckCheck aria-hidden className="size-3.5" />
              En seguimiento
            </span>
          ) : null}

          {isApplied ? null : (
            <button
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-sky/70 bg-surface px-3.5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-mist sm:py-2 focus:ring-4 focus:ring-brand/25 focus:outline-none"
              type="button"
              onClick={onCompose}
            >
              <MessageSquareText aria-hidden className="size-4" />
              Armar mensaje
            </button>
          )}

          <m.a
            className="inline-flex flex-1 shrink-0 items-center justify-center gap-1 rounded-xl bg-panel px-3.5 py-2.5 text-sm font-medium text-onpanel transition-colors hover:bg-brand sm:flex-none sm:py-2 focus:ring-4 focus:ring-brand/25 focus:outline-none"
            href={job.apply_url}
            rel="noreferrer noopener"
            target="_blank"
            whileTap={{ scale: 0.97 }}
            onClick={flow.begin}
          >
            {isApplied ? 'Ver el aviso' : 'Postularme'}
            <ArrowUpRight aria-hidden className="size-4" />
          </m.a>
        </div>
      </div>
    </div>
  )
}
