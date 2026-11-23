import { ArrowUpRight, Check, Copy, Mail } from 'lucide-react'
import type { Ref } from 'react'
import type { Job } from '../../lib/types.ts'

const actionClass =
  'inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors sm:flex-none sm:py-2'

const primaryClass = `${actionClass} bg-panel text-onpanel hover:bg-brand focus:ring-4 focus:ring-brand/25 focus:outline-none`

const quietClass = `${actionClass} border border-sky/70 bg-surface text-ink hover:border-brand hover:bg-mist focus:ring-4 focus:ring-brand/25 focus:outline-none`

interface SendBarProps {
  job: Job
  /** El mail del aviso y el `mailto:` ya armado; null si no entra o no hay. */
  email: string | null
  mailto: string | null
  /** Hay nombre: sin él los botones piden el nombre en vez de mandar. */
  ready: boolean
  /** Lo que dice el pie (aviso en vivo), o null si lo que falta es el nombre. */
  status: string | null
  copied: boolean
  onAskName: () => void
  onCopy: () => void
  onSend: () => void
  pillRef: Ref<HTMLDivElement>
}

/** El botón principal: mail si el aviso trae uno, si no copiar y abrir el aviso. */
function SendAction({
  job,
  email,
  mailto,
  ready,
  onAskName,
  onCopy,
  onSend,
}: Omit<SendBarProps, 'status' | 'copied' | 'pillRef'>) {
  const byMail = email !== null && mailto !== null
  const content = byMail ? (
    <>
      <Mail aria-hidden className="size-4" />
      Abrir en mi correo
    </>
  ) : (
    <>
      Copiar y abrir el aviso
      <ArrowUpRight aria-hidden className="size-4" />
    </>
  )

  if (!ready) {
    return (
      <button className={primaryClass} type="button" onClick={onAskName}>
        {content}
      </button>
    )
  }
  if (byMail) {
    return (
      <a className={primaryClass} href={mailto} onClick={onSend}>
        {content}
      </a>
    )
  }
  return (
    <a
      className={primaryClass}
      href={job.apply_url}
      rel="noreferrer noopener"
      target="_blank"
      onClick={() => {
        onCopy()
        onSend()
      }}
    >
      {content}
    </a>
  )
}

/**
 * Las acciones de la página de armar: flotan como el pie de la ficha, a la vista
 * en las dos columnas y en el teléfono, sin tapar el final del contenido.
 */
export function SendBar({
  job,
  email,
  mailto,
  ready,
  status,
  copied,
  onAskName,
  onCopy,
  onSend,
  pillRef,
}: SendBarProps) {
  return (
    <div
      ref={pillRef}
      className="absolute inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-10 flex flex-col gap-2 rounded-2xl border border-sky/50 bg-surface/90 px-3 py-2.5 shadow-[var(--shadow-panel)] backdrop-blur-md sm:inset-x-4 sm:bottom-4 sm:flex-row sm:items-center sm:gap-3 sm:px-4"
    >
      <p
        aria-live="polite"
        className="min-w-0 flex-1 text-xs break-words text-soft"
      >
        {status ?? (
          <button
            className="font-medium text-red-600 underline underline-offset-2 dark:text-red-400"
            type="button"
            onClick={onAskName}
          >
            Falta tu nombre para poder mandarlo.
          </button>
        )}
      </p>

      <div className="flex items-center gap-2">
        <SendAction
          email={email}
          job={job}
          mailto={mailto}
          ready={ready}
          onAskName={onAskName}
          onCopy={onCopy}
          onSend={onSend}
        />

        <button
          className={quietClass}
          type="button"
          onClick={ready ? onCopy : onAskName}
        >
          {copied ? (
            <Check aria-hidden className="size-4" />
          ) : (
            <Copy aria-hidden className="size-4" />
          )}
          Copiar
          <span className="sr-only"> mensaje</span>
        </button>
      </div>
    </div>
  )
}
