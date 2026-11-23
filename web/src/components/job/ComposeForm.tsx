import { RotateCcw, Save } from 'lucide-react'
import { type Ref, useId } from 'react'
import { DEFAULT_TEMPLATES, MESSAGE_LABEL } from '../../lib/message.ts'
import {
  MAX_MESSAGE_CHARS,
  MESSAGE_KINDS,
  type MessageKind,
  type Resume,
} from '../../lib/resume.ts'

const fieldClass =
  'w-full rounded-xl border border-sky/60 bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:ring-4 focus:ring-brand/25 focus:outline-none'

const smallClass =
  'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:text-ink disabled:opacity-40 disabled:hover:text-muted'

interface ComposeFormProps {
  resume: Resume
  onChangeResume: (resume: Resume) => void
  kind: MessageKind
  onKind: (kind: MessageKind) => void
  template: string
  onTemplate: (text: string) => void
  /** Hay cambios sin guardar en la variante abierta. */
  dirty: boolean
  /** La variante abierta ya es una versión propia. */
  customized: boolean
  onKeep: () => void
  onRestore: () => void
  nameRef: Ref<HTMLInputElement>
  /** El nombre falta y la persona ya lo vio: se marca el campo. */
  missingName: boolean
  onNameTouched: () => void
}

/**
 * Lo que se edita para armar el mensaje: variante, nombre, adjuntos y la
 * plantilla. Cuál se ve en el teléfono lo decide quien lo monta.
 */
export function ComposeForm({
  resume,
  onChangeResume,
  kind,
  onKind,
  template,
  onTemplate,
  dirty,
  customized,
  onKeep,
  onRestore,
  nameRef,
  missingName,
  onNameTouched,
}: ComposeFormProps) {
  const id = useId()

  return (
    <>
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
            onClick={() => onKind(option)}
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
            onBlur={onNameTouched}
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
          onChange={(event) => onTemplate(event.target.value)}
        />
        <p className="text-xs text-muted">
          Se completa sola: podés usar {'{nombre}'} {'{puesto}'} {'{empresa}'}{' '}
          {'{adjuntos}'} {'{idiomas}'} {'{links}'}.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <button
          className={smallClass}
          disabled={!dirty}
          type="button"
          onClick={onKeep}
        >
          <Save aria-hidden className="size-3.5" />
          Guardar como mi versión
        </button>
        <button
          className={smallClass}
          disabled={!customized && template === DEFAULT_TEMPLATES[kind]}
          type="button"
          onClick={onRestore}
        >
          <RotateCcw aria-hidden className="size-3.5" />
          Volver al original
        </button>
      </div>
    </>
  )
}
