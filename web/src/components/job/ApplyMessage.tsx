import { ArrowUpRight, Check, Copy, Mail, RotateCcw, Save } from 'lucide-react'
import { type CSSProperties, useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { usePillHeight } from '../../hooks/usePillHeight.ts'
import {
  DEFAULT_TEMPLATES,
  MESSAGE_LABEL,
  attachmentList,
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
import { MessagePreview } from './MessagePreview.tsx'

interface ApplyMessageProps {
  job: Job
  resume: Resume
  onChangeResume: (resume: Resume) => void
  /** La persona salió a mandarlo: la ficha registra la postulación y le
   * pregunta al volver si la mandó. */
  onSend: () => void
}

type Panel = 'edit' | 'preview'

const fieldClass =
  'w-full rounded-xl border border-sky/60 bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:ring-4 focus:ring-brand/25 focus:outline-none'

const actionClass =
  'inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors sm:flex-none sm:py-2'

const primaryClass = `${actionClass} bg-panel text-onpanel hover:bg-brand focus:ring-4 focus:ring-brand/25 focus:outline-none`

const quietClass = `${actionClass} border border-sky/70 bg-surface text-ink hover:border-brand hover:bg-mist focus:ring-4 focus:ring-brand/25 focus:outline-none`

const smallClass =
  'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:text-ink disabled:opacity-40 disabled:hover:text-muted'

const COPIED = 'Mensaje copiado.'

/**
 * La página de armar el mensaje de postulación: a la izquierda lo que se edita
 * (variante, nombre, adjuntos, plantilla) y a la derecha cómo queda el mensaje
 * completo. En el teléfono son dos paneles que se alternan. Las acciones van en
 * un pill que flota abajo. Todo vive en este navegador: nada llega a la API.
 */
export function ApplyMessage({
  job,
  resume,
  onChangeResume,
  onSend,
}: ApplyMessageProps) {
  const id = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const [pillRef, pillHeight] = usePillHeight()
  const [kind, setKind] = useState<MessageKind>('formal')
  const [panel, setPanel] = useState<Panel>('edit')
  /* Lo que se está escribiendo y todavía no se guardó, por variante: cambiar
     de pestaña no lo pierde. */
  const [edits, setEdits] = useState<Partial<Record<MessageKind, string>>>({})
  const [note, setNote] = useState('')
  /** El nombre se marca como faltante al salir del campo o al querer mandar. */
  const [nameTouched, setNameTouched] = useState(false)

  const saved = templateFor(resume, kind)
  const template = edits[kind] ?? saved
  const dirty = template !== saved
  const customized = resume.messages[kind] !== undefined

  const message = fillTemplate(template, messageValues(job, resume))
  const email = findContactEmail(job)
  const subject = mailSubject(job, resume.name)
  const mailto = email === null ? null : buildMailto(email, subject, message)
  const ready = resume.name.trim() !== ''
  const missingName = nameTouched && !ready

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
      setNote(COPIED)
      return true
    } catch {
      setNote('No pude copiarlo: seleccioná el texto y copialo a mano.')
      return false
    }
  }

  /* Un botón que no se puede apretar no dice qué falta: se aprieta igual y lleva
     el foco al campo. En el teléfono primero hay que volver al panel de edición. */
  const askForName = () => {
    setNameTouched(true)
    flushSync(() => setPanel('edit'))
    nameRef.current?.focus()
  }

  const status = note
    ? note
    : !ready
      ? null
      : email !== null && mailto !== null
        ? `Va a ${email}.`
        : email !== null
          ? 'Es largo para el correo: copialo y pegalo en un mail.'
          : 'Sin mail en el aviso: se copia y se abre el aviso.'

  const hint =
    email !== null && mailto !== null
      ? `Los adjuntos los sumás vos en tu correo: un enlace de mail no puede llevarlos.`
      : email !== null
        ? `Es demasiado largo para abrirlo en el correo. Copialo y pegalo en un mail a ${email}.`
        : 'Este aviso no trae un mail: se copia el mensaje y se abre el aviso, donde lo pegás.'

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      style={{ '--apply-pill': `${pillHeight}px` } as CSSProperties}
    >
      <div
        aria-label="Qué ver"
        className="flex gap-1.5 border-b border-sky/40 px-4 py-2 lg:hidden"
        role="group"
      >
        {(
          [
            ['edit', 'Editar'],
            ['preview', 'Vista previa'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            aria-pressed={panel === value}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              panel === value
                ? 'bg-panel text-onpanel'
                : 'bg-mist text-soft hover:text-ink'
            }`}
            type="button"
            onClick={() => setPanel(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:grid lg:grid-cols-2 lg:overflow-hidden">
        <section
          aria-label="Armar el mensaje"
          className={`${panel === 'edit' ? 'block' : 'hidden'} space-y-4 px-4 pt-4 pb-[calc(var(--apply-pill,5rem)+1.5rem+env(safe-area-inset-bottom))] lg:block lg:overflow-y-auto lg:overscroll-contain lg:px-5 lg:pt-5`}
        >
          <div
            aria-label="Variante"
            className="flex flex-wrap gap-1.5"
            role="group"
          >
            {MESSAGE_KINDS.map((option) => (
              <button
                key={option}
                aria-pressed={kind === option}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  kind === option
                    ? 'bg-panel text-onpanel'
                    : 'bg-mist text-soft hover:text-ink'
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                className="block text-xs font-medium text-soft"
                htmlFor={`${id}-name`}
              >
                Tu nombre
              </label>
              <input
                ref={nameRef}
                aria-describedby={missingName ? `${id}-name-error` : undefined}
                aria-invalid={missingName}
                autoComplete="name"
                className={`${fieldClass} ${missingName ? 'border-red-600 dark:border-red-400' : ''}`}
                id={`${id}-name`}
                maxLength={80}
                placeholder="Como querés firmar"
                type="text"
                value={resume.name}
                onBlur={() => setNameTouched(true)}
                onChange={(event) =>
                  onChangeResume({ ...resume, name: event.target.value })
                }
              />
              {missingName ? (
                <p
                  className="text-xs text-red-600 dark:text-red-400"
                  id={`${id}-name-error`}
                >
                  Poné tu nombre: es con el que firmás.
                </p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label
                className="block text-xs font-medium text-soft"
                htmlFor={`${id}-attachments`}
              >
                Qué adjuntás
              </label>
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
              <p className="text-xs text-muted">
                Separalos con coma: aparecen como adjuntos a la derecha.
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <label
              className="block text-xs font-medium text-soft"
              htmlFor={`${id}-template`}
            >
              Plantilla
            </label>
            <textarea
              className={`${fieldClass} min-h-40 resize-y leading-relaxed lg:min-h-56`}
              id={`${id}-template`}
              maxLength={MAX_MESSAGE_CHARS}
              rows={8}
              value={template}
              onChange={(event) => {
                edit(event.target.value)
                setNote('')
              }}
            />
            <p className="text-xs text-muted">
              Se completa sola: podés usar {'{nombre}'} {'{puesto}'}{' '}
              {'{empresa}'} {'{adjuntos}'} {'{idiomas}'} {'{links}'}.
            </p>
          </div>

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
        </section>

        <section
          aria-label="Vista previa del mensaje"
          className={`${panel === 'preview' ? 'block' : 'hidden'} bg-mist/50 px-4 pt-4 pb-[calc(var(--apply-pill,5rem)+1.5rem+env(safe-area-inset-bottom))] lg:block lg:overflow-y-auto lg:overscroll-contain lg:border-l lg:border-sky/40 lg:px-5 lg:pt-5`}
        >
          <MessagePreview
            attachments={attachmentList(resume.attachments)}
            body={message}
            subject={subject}
            to={email}
          >
            {hint}
          </MessagePreview>
        </section>
      </div>

      {/* Las acciones flotan como el pie de la ficha: a la vista en las dos
          columnas y en el teléfono, sin tapar el final del contenido. */}
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
              onClick={askForName}
            >
              Falta tu nombre para poder mandarlo.
            </button>
          )}
        </p>

        <div className="flex items-center gap-2">
          {!ready ? (
            <button className={primaryClass} type="button" onClick={askForName}>
              {email !== null && mailto !== null ? (
                <Mail aria-hidden className="size-4" />
              ) : null}
              {email !== null && mailto !== null
                ? 'Abrir en mi correo'
                : 'Copiar y abrir el aviso'}
              {email !== null && mailto !== null ? null : (
                <ArrowUpRight aria-hidden className="size-4" />
              )}
            </button>
          ) : email !== null && mailto !== null ? (
            <a className={primaryClass} href={mailto} onClick={onSend}>
              <Mail aria-hidden className="size-4" />
              Abrir en mi correo
            </a>
          ) : (
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
          )}

          <button
            className={quietClass}
            type="button"
            onClick={ready ? () => void copy() : askForName}
          >
            {note === COPIED ? (
              <Check aria-hidden className="size-4" />
            ) : (
              <Copy aria-hidden className="size-4" />
            )}
            Copiar
            <span className="sr-only"> mensaje</span>
          </button>
        </div>
      </div>
    </div>
  )
}
