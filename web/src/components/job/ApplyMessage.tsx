import { type CSSProperties, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { usePillHeight } from '../../hooks/usePillHeight.ts'
import {
  attachmentList,
  buildMailto,
  fillTemplate,
  findContactEmail,
  mailSubject,
  messageValues,
  sendHint,
  sendStatus,
  templateFor,
} from '../../lib/message.ts'
import type { MessageKind, Resume } from '../../lib/resume.ts'
import type { Job } from '../../lib/types.ts'
import { ComposeForm } from './ComposeForm.tsx'
import { MessagePreview } from './MessagePreview.tsx'
import { SendBar } from './SendBar.tsx'

interface ApplyMessageProps {
  job: Job
  resume: Resume
  onChangeResume: (resume: Resume) => void
  /** La persona salió a mandarlo: la ficha registra la postulación y le
   * pregunta al volver si la mandó. */
  onSend: () => void
}

type Panel = 'edit' | 'preview'

const PANELS = [
  ['edit', 'Editar'],
  ['preview', 'Vista previa'],
] as const

const COPIED = 'Mensaje copiado.'

/** Deja `kind` afuera de lo que se está escribiendo sin guardar. */
const without = (
  edits: Partial<Record<MessageKind, string>>,
  kind: MessageKind,
): Partial<Record<MessageKind, string>> => {
  const { [kind]: _done, ...rest } = edits
  return rest
}

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

  const message = fillTemplate(template, messageValues(job, resume))
  const email = findContactEmail(job)
  const mailto =
    email === null
      ? null
      : buildMailto(email, mailSubject(job, resume.name), message)
  const ready = resume.name.trim() !== ''

  const keepEdit = () => {
    const next = { ...resume.messages }
    if (template.trim() === '') delete next[kind]
    else next[kind] = template
    onChangeResume({ ...resume, messages: next })
    setEdits((current) => without(current, kind))
    setNote('Guardada en este dispositivo.')
  }

  const restore = () => {
    const { [kind]: _gone, ...next } = resume.messages
    onChangeResume({ ...resume, messages: next })
    setEdits((current) => without(current, kind))
    setNote('')
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setNote(COPIED)
    } catch {
      setNote('No pude copiarlo: seleccioná el texto y copialo a mano.')
    }
  }

  /* Un botón que no se puede apretar no dice qué falta: se aprieta igual y lleva
     el foco al campo. En el teléfono primero hay que volver al panel de edición. */
  const askForName = () => {
    setNameTouched(true)
    flushSync(() => setPanel('edit'))
    nameRef.current?.focus()
  }

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
        {PANELS.map(([value, label]) => (
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
          <ComposeForm
            customized={resume.messages[kind] !== undefined}
            dirty={template !== saved}
            kind={kind}
            missingName={nameTouched && !ready}
            nameRef={nameRef}
            resume={resume}
            template={template}
            onChangeResume={onChangeResume}
            onKeep={keepEdit}
            onKind={(next) => {
              setKind(next)
              setNote('')
            }}
            onNameTouched={() => setNameTouched(true)}
            onRestore={restore}
            onTemplate={(text) => {
              setEdits((current) => ({ ...current, [kind]: text }))
              setNote('')
            }}
          />
        </section>

        <section
          aria-label="Vista previa del mensaje"
          className={`${panel === 'preview' ? 'block' : 'hidden'} bg-mist/50 px-4 pt-4 pb-[calc(var(--apply-pill,5rem)+1.5rem+env(safe-area-inset-bottom))] lg:block lg:overflow-y-auto lg:overscroll-contain lg:border-l lg:border-sky/40 lg:px-5 lg:pt-5`}
        >
          <MessagePreview
            attachments={attachmentList(resume.attachments)}
            body={message}
            subject={mailSubject(job, resume.name)}
            to={email}
          >
            {sendHint(email, mailto)}
          </MessagePreview>
        </section>
      </div>

      <SendBar
        copied={note === COPIED}
        email={email}
        job={job}
        mailto={mailto}
        pillRef={pillRef}
        ready={ready}
        status={sendStatus(note, ready, email, mailto)}
        onAskName={askForName}
        onCopy={() => void copy()}
        onSend={onSend}
      />
    </div>
  )
}
