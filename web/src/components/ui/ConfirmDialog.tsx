import { TriangleAlert } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { type ReactNode, type RefObject, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { islandTransition } from '../../lib/motion.ts'

interface ConfirmDialogProps {
  open: boolean
  title: string
  /** Qué se pierde, dicho antes del segundo clic. */
  children: ReactNode
  confirmLabel: string
  cancelLabel?: string
  onCancel: () => void
  onConfirm: () => void
  /** A dónde vuelve el foco al cerrar. Safari no enfoca un botón al hacerle
   * clic, así que el elemento activo al abrir no siempre es el botón. */
  returnFocusTo?: RefObject<HTMLElement | null>
}

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea'

/**
 * Confirmación en el medio de la pantalla para lo que borra de verdad.
 *
 * `alertdialog` con el foco atrapado, Esc y clic afuera que cancelan, y el foco
 * vuelve a lo que lo tenía al abrir. Arranca en "Cancelar": darle Enter sin
 * mirar no borra nada.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  return createPortal(
    <AnimatePresence>
      {props.open ? <Dialog key="dialog" {...props} /> : null}
    </AnimatePresence>,
    document.body,
  )
}

function Dialog({
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancelar',
  onCancel,
  onConfirm,
  returnFocusTo,
}: ConfirmDialogProps) {
  const titleId = useId()
  const bodyId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  /* Quien llama puede cambiar `onCancel` en cada render; el listener no. */
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel
  /* Devuelve el elemento al que vuelve el foco; se lee recién al cerrar. */
  const returnTarget = useRef<() => HTMLElement | null | undefined>(() => null)
  returnTarget.current = () => returnFocusTo?.current

  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancel.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancelRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const items = Array.from(
        panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      )
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) return
      const active = document.activeElement
      if (!panel.current?.contains(active)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      ;(returnTarget.current() ?? opener)?.focus()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-80 grid place-items-center p-4">
      <m.div
        animate={{ opacity: 1 }}
        aria-hidden
        className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        onClick={onCancel}
      />
      <m.div
        ref={panel}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        aria-describedby={bodyId}
        aria-labelledby={titleId}
        aria-modal
        className="relative w-full max-w-sm rounded-2xl border border-sky/50 bg-surface p-5 shadow-[var(--shadow-panel)]"
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        role="alertdialog"
        transition={islandTransition}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-danger/12 text-danger"
          >
            <TriangleAlert className="size-5" />
          </span>
          <div className="min-w-0">
            <h2
              className="text-base font-semibold tracking-tight text-ink"
              id={titleId}
            >
              {title}
            </h2>
            <div
              className="mt-1.5 text-sm leading-relaxed text-muted"
              id={bodyId}
            >
              {children}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancel}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-sky/60 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            type="button"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-danger-solid px-4 py-2 text-sm font-semibold text-ondanger transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </m.div>
    </div>
  )
}
