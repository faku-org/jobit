import { Paperclip } from 'lucide-react'
import type { ReactNode } from 'react'

interface MessagePreviewProps {
  /** El mail al que va, o null si el aviso no trae uno y se pega en el aviso. */
  to: string | null
  subject: string
  body: string
  attachments: string[]
  /** Lo que la persona tiene que saber de cómo sale (mail, copia, adjuntos). */
  children?: ReactNode
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 px-4 py-2.5">
      <dt className="w-14 shrink-0 text-xs font-medium text-muted">{label}</dt>
      <dd className="min-w-0 text-sm break-words text-ink">{children}</dd>
    </div>
  )
}

/**
 * El mensaje completo como lo vería quien lo recibe: a quién va, con qué asunto,
 * el cuerpo ya completado y los adjuntos. Es solo lectura; se arma a la izquierda.
 */
export function MessagePreview({
  to,
  subject,
  body,
  attachments,
  children,
}: MessagePreviewProps) {
  return (
    <div>
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
        Vista previa
      </h3>
      <p className="mt-1 text-xs text-muted">
        Así lo ve quien recibe tu postulación.
      </p>

      <article className="mt-3 overflow-hidden rounded-2xl border border-sky/50 bg-surface shadow-[var(--shadow-card)]">
        <dl className="divide-y divide-sky/30 border-b border-sky/40">
          <Row label="Para">
            {to ?? (
              <span className="text-muted">
                El aviso original: lo pegás ahí
              </span>
            )}
          </Row>
          {to === null ? null : <Row label="Asunto">{subject}</Row>}
        </dl>

        {body.trim() === '' ? (
          <p className="px-4 py-4 text-sm text-muted">
            El mensaje está vacío: escribilo a la izquierda.
          </p>
        ) : (
          <pre className="px-4 py-4 font-sans text-sm leading-relaxed whitespace-pre-wrap text-ink">
            {body}
          </pre>
        )}

        <div className="flex flex-wrap items-center gap-1.5 border-t border-sky/40 bg-mist/60 px-4 py-2.5">
          <Paperclip aria-hidden className="size-3.5 shrink-0 text-muted" />
          <span className="sr-only">Adjuntos:</span>
          {attachments.map((name) => (
            <span
              key={name}
              className="max-w-full truncate rounded-lg border border-sky/50 bg-surface px-2 py-0.5 text-xs text-ink"
            >
              {name}
            </span>
          ))}
        </div>
      </article>

      {children ? (
        <p className="mt-3 text-xs leading-relaxed text-muted">{children}</p>
      ) : null}
    </div>
  )
}
