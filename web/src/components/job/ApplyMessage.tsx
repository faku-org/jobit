import { ArrowUpRight, Check, Copy, Mail, RotateCcw, Save } from 'lucide-react'
import { useId, useState } from 'react'
import {
  DEFAULT_TEMPLATES,
  MESSAGE_LABEL,
  buildMailto,
  fillTemplate,
  findContactEmail,
  mailSubject,
  messageValues,
  templateFor,
} from '../../lib/message.ts'
import {
  MAX_MESSAGE_CHARS,
  MESSAGE_KINDS,
  type MessageKind,
  type Resume,
} from '../../lib/resume.ts'
import type { Job } from '../../lib/types.ts'

interface ApplyMessageProps {
  job: Job
  resume: Resume
  onChangeResume: (resume: Resume) => void
  /** La persona salió a mandarlo: el footer registra la postulación y le
   * pregunta al volver si la mandó. */
  onSend: () => void
}

const fieldClass =
  'w-full rounded-xl border border-sky/60 bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:ring-4 focus:ring-brand/25 focus:outline-none'

const actionClass =
  'inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors'

const primaryClass = `${actionClass} bg-panel text-onpanel hover:bg-brand focus:ring-4 focus:ring-brand/25 focus:outline-none disabled:opacity-50 disabled:hover:bg-panel`

const quietClass = `${actionClass} border border-sky/70 bg-surface text-ink hover:border-brand hover:bg-mist disabled:opacity-50`

const smallClass =
  'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:text-ink disabled:opacity-40 disabled:hover:text-muted'

/**
 * El mensaje de postulación, armado con el perfil y la oferta y editable antes
 * de mandarlo. Si el aviso trae un mail sale por `mailto:`; si no, se copia y se
 * abre el aviso. Todo vive en este navegador: nada de esto llega a la API.
 */
export function ApplyMessage({
  job,
  resume,
  onChangeResume,
  onSend,
}: ApplyMessageProps) {
  const id = useId()
  const [kind, setKind] = useState<MessageKind>('formal')
  /* Lo que se está escribiendo y todavía no se guardó, por variante: cambiar
     de pestaña no lo pierde. */
  const [edits, setEdits] = useState<Partial<Record<MessageKind, string>>>({})
  const [note, setNote] = useState('')

  const saved = templateFor(resume, kind)
  const template = edits[kind] ?? saved
  const dirty = template !== saved
  const customized = resume.messages[kind] !== undefined

  const message = fillTemplate(template, messageValues(job, resume))
  const email = findContactEmail(job)
  const mailto =
    email === null
      ? null
      : buildMailto(email, mailSubject(job, resume.name), message)
  const ready = resume.name.trim() !== ''

  const edit = (text: string) =>
    setEdits((current) => ({ ...current, [kind]: text }))

  const keepEdit = () => {
    const next = { ...resume.messages }
    if (template.trim() === '') delete next[kind]
    else next[kind] = template
    onChangeResume({ ...resume, messages: next })
    setEdits((current) => {
      const { [kind]: _done, ...rest } = current
      return rest
    })
    setNote('Guardada en este dispositivo.')
  }

  const restore = () => {
    const { [kind]: _gone, ...next } = resume.messages
    onChangeResume({ ...resume, messages: next })
    setEdits((current) => {
      const { [kind]: _done, ...rest } = current
      return rest
    })
    setNote('')
  }

  const copy = async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(message)
      setNote('Mensaje copiado.')
      return true
    } catch {
      setNote('No pude copiarlo: seleccioná el texto y copialo a mano.')
      return false
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-sky/60 bg-mist p-3">
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label="Variante"
      >
        {MESSAGE_KINDS.map((option) => (
          <button
            key={option}
            aria-pressed={kind === option}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              kind === option
                ? 'bg-panel text-onpanel'
                : 'bg-surface text-soft hover:text-ink'
            }`}
            type="button"
            onClick={() => {
              setKind(option)
              setNote('')
            }}
          >
            {MESSAGE_LABEL[option]}
            {resume.messages[option] !== undefined ? ' *' : ''}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block space-y-1" htmlFor={`${id}-name`}>
          <span className="text-xs font-medium text-soft">Tu nombre</span>
          <input
            autoComplete="name"
            className={fieldClass}
            id={`${id}-name`}
            maxLength={80}
            placeholder="Como querés firmar"
            type="text"
            value={resume.name}
            onChange={(event) =>
              onChangeResume({ ...resume, name: event.target.value })
            }
          />
        </label>
        <label className="block space-y-1" htmlFor={`${id}-attachments`}>
          <span className="text-xs font-medium text-soft">Qué adjuntás</span>
          <input
            autoComplete="off"
            className={fieldClass}
            id={`${id}-attachments`}
            maxLength={120}
            placeholder="mi CV"
            type="text"
            value={resume.attachments}
            onChange={(event) =>
              onChangeResume({ ...resume, attachments: event.target.value })
            }
          />
        </label>
      </div>

      <label className="block space-y-1" htmlFor={`${id}-template`}>
        <span className="text-xs font-medium text-soft">
          Plantilla (se completa sola; podés usar {'{nombre}'} {'{puesto}'}{' '}
          {'{empresa}'} {'{adjuntos}'} {'{idiomas}'} {'{links}'})
        </span>
        <textarea
          className={`${fieldClass} min-h-32 resize-y leading-relaxed`}
          id={`${id}-template`}
          maxLength={MAX_MESSAGE_CHARS}
          rows={7}
          value={template}
          onChange={(event) => {
            edit(event.target.value)
            setNote('')
          }}
        />
      </label>

      <div className="flex flex-wrap items-center gap-1">
        <button
          className={smallClass}
          disabled={!dirty}
          type="button"
          onClick={keepEdit}
        >
          <Save aria-hidden className="size-3.5" />
          Guardar como mi versión
        </button>
        <button
          className={smallClass}
          disabled={!customized && template === DEFAULT_TEMPLATES[kind]}
          type="button"
          onClick={restore}
        >
          <RotateCcw aria-hidden className="size-3.5" />
          Volver al original
        </button>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-soft">Así sale</p>
        <pre className="max-h-48 overflow-y-auto rounded-xl bg-surface px-3 py-2 font-sans text-sm leading-relaxed whitespace-pre-wrap text-ink">
          {message}
        </pre>
      </div>

      {ready ? null : (
        <p className="text-xs text-soft">Poné tu nombre para poder mandarlo.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {email !== null && mailto !== null ? (
          ready ? (
            <a className={primaryClass} href={mailto} onClick={onSend}>
              <Mail aria-hidden className="size-4" />
              Abrir en mi correo
            </a>
          ) : (
            <button className={primaryClass} disabled type="button">
              <Mail aria-hidden className="size-4" />
              Abrir en mi correo
            </button>
          )
        ) : ready ? (
          <a
            className={primaryClass}
            href={job.apply_url}
            rel="noreferrer noopener"
            target="_blank"
            onClick={() => {
              void copy()
              onSend()
            }}
          >
            Copiar y abrir el aviso
            <ArrowUpRight aria-hidden className="size-4" />
          </a>
        ) : (
          <button className={primaryClass} disabled type="button">
            Copiar y abrir el aviso
            <ArrowUpRight aria-hidden className="size-4" />
          </button>
        )}

        <button
          className={quietClass}
          disabled={!ready}
          type="button"
          onClick={() => void copy()}
        >
          {note === 'Mensaje copiado.' ? (
            <Check aria-hidden className="size-4" />
          ) : (
            <Copy aria-hidden className="size-4" />
          )}
          Copiar mensaje
        </button>
      </div>

      {email !== null && mailto !== null ? (
        <p className="text-xs text-muted">
          Va a {email}. Los adjuntos los sumás vos en tu correo: un enlace de
          mail no puede llevarlos.
        </p>
      ) : email !== null ? (
        <p className="text-xs text-muted">
          Es demasiado largo para abrirlo en el correo. Copialo y pegalo en un
          mail a {email}.
        </p>
      ) : (
        <p className="text-xs text-muted">
          Este aviso no trae un mail: se copia el mensaje y se abre el aviso,
          donde lo pegás.
        </p>
      )}

      <p aria-live="polite" className="min-h-4 text-xs text-soft">
        {note}
      </p>
    </div>
  )
}
