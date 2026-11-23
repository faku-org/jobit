import { Pencil, Trash2, TriangleAlert } from 'lucide-react'
import { useId, useState } from 'react'
import { MAX_NOTE, type Note } from '../../lib/followup.ts'
import { formatDay } from '../../lib/format.ts'
import { fieldClass } from '../../lib/styles.ts'
import { ConfirmDelete } from './ConfirmDelete.tsx'

interface NotesAreaProps {
  notes: Note[]
  onAdd: (text: string) => void
  onEdit: (id: string, text: string) => void
  onRemove: (id: string) => void
}

const primaryClass =
  'rounded-xl bg-panel px-3.5 py-2 text-sm font-medium text-onpanel transition-colors hover:bg-brand focus:ring-4 focus:ring-brand/25 focus:outline-none'

const quietClass =
  'rounded-xl px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-mist hover:text-ink'

const rowButtonClass =
  'inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-mist hover:text-ink'

/** Un cuadro de texto que valida mientras se escribe y no se deshabilita. */
function NoteField({
  label,
  help,
  initial,
  action,
  onSubmit,
  onCancel,
}: {
  label: string
  help?: string
  initial: string
  action: string
  onSubmit: (text: string) => void
  onCancel?: () => void
}) {
  const id = useId()
  const [value, setValue] = useState(initial)
  const [touched, setTouched] = useState(false)
  const empty = value.trim() === ''
  const showError = touched && empty

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        setTouched(true)
        if (empty) {
          document.getElementById(id)?.focus()
          return
        }
        onSubmit(value)
        setValue('')
        setTouched(false)
      }}
    >
      <label className="block text-xs font-medium text-soft" htmlFor={id}>
        {label}
      </label>
      <textarea
        aria-describedby={`${id}-help`}
        aria-invalid={showError ? true : undefined}
        className={`${fieldClass} mt-1 min-h-20 resize-y px-3 py-2 ${
          showError ? 'border-red-600' : ''
        }`}
        id={id}
        maxLength={MAX_NOTE}
        rows={3}
        value={value}
        onBlur={() => setTouched(true)}
        onChange={(event) => setValue(event.target.value)}
      />
      <p
        aria-live="polite"
        className={`mt-1 flex items-center gap-1.5 text-[0.6875rem] ${
          showError ? 'text-red-600' : 'text-muted'
        }`}
        id={`${id}-help`}
      >
        {showError ? (
          <>
            <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
            Escribí algo antes de guardar.
          </>
        ) : (
          (help ?? '')
        )}
      </p>
      <div className="mt-2 flex gap-2">
        <button className={primaryClass} type="submit">
          {action}
        </button>
        {onCancel ? (
          <button className={quietClass} type="button" onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  )
}

function NoteRow({
  note,
  onEdit,
  onRemove,
}: {
  note: Note
  onEdit: (id: string, text: string) => void
  onRemove: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [asking, setAsking] = useState(false)
  const edited = note.updatedAt !== note.createdAt

  if (editing) {
    return (
      <li className="py-3">
        <NoteField
          action="Guardar cambios"
          initial={note.text}
          label="Editar nota"
          onCancel={() => setEditing(false)}
          onSubmit={(text) => {
            onEdit(note.id, text)
            setEditing(false)
          }}
        />
      </li>
    )
  }

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap text-ink">
          {note.text}
        </p>
        <div className="flex shrink-0 gap-1">
          <button
            aria-label="Editar la nota"
            className={rowButtonClass}
            type="button"
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden className="size-4" />
          </button>
          <button
            aria-expanded={asking}
            aria-label="Borrar la nota"
            className={rowButtonClass}
            type="button"
            onClick={() => setAsking((current) => !current)}
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        </div>
      </div>
      <p className="mt-1 text-[0.6875rem] text-faint tabular-nums">
        {formatDay(note.createdAt)}
        {edited ? ` · editada el ${formatDay(note.updatedAt)}` : ''}
      </p>
      {asking ? (
        <ConfirmDelete
          question="¿Borrar esta nota? No se puede deshacer."
          onCancel={() => setAsking(false)}
          onConfirm={() => onRemove(note.id)}
        />
      ) : null}
    </li>
  )
}

/** Qué preguntaron, con quién se habló, próximos pasos. */
export function NotesArea({ notes, onAdd, onEdit, onRemove }: NotesAreaProps) {
  return (
    <div className="space-y-4">
      <NoteField
        action="Guardar nota"
        help="Qué preguntaron, con quién hablaste, próximos pasos."
        initial=""
        label="Nueva nota"
        onSubmit={onAdd}
      />

      {notes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-sky px-4 py-5 text-center text-xs text-muted">
          Todavía no anotaste nada de esta postulación. Lo que escribas queda
          acá, para repasarlo antes de la próxima entrevista.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {notes.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              onEdit={onEdit}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
