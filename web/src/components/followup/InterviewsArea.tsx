import {
  CalendarPlus,
  CalendarClock,
  ExternalLink,
  MapPin,
  Pencil,
  Trash2,
  TriangleAlert,
  UserRound,
} from 'lucide-react'
import { useId, useState } from 'react'
import {
  type Interview,
  type InterviewDraft,
  type InterviewField,
  interviewIssues,
  MAX_CONTACT,
  MAX_LINK,
  MAX_PLACE,
} from '../../lib/followup.ts'
import { formatInterviewWhen } from '../../lib/format.ts'
import { fieldClass } from '../../lib/styles.ts'
import { ConfirmDelete } from './ConfirmDelete.tsx'

interface InterviewsAreaProps {
  applicationId: string
  interviews: Interview[]
  onSave: (draft: Omit<InterviewDraft, 'id'> & { id?: string }) => void
  onRemove: (id: string) => void
  /** Baja el .ics de esta entrevista. */
  onCalendar: (interview: Interview) => void
}

const primaryClass =
  'rounded-xl bg-panel px-3.5 py-2 text-sm font-medium text-onpanel transition-colors hover:bg-brand focus:ring-4 focus:ring-brand/25 focus:outline-none'

const quietClass =
  'rounded-xl px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-mist hover:text-ink'

const secondaryClass =
  'inline-flex items-center gap-1.5 rounded-xl border border-sky px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-mist'

const rowButtonClass =
  'inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-mist hover:text-ink'

const FIELD_LABEL: Record<InterviewField, string> = {
  date: 'el día',
  time: 'la hora',
  link: 'el enlace',
}

interface Values {
  date: string
  time: string
  place: string
  link: string
  contact: string
}

const emptyValues: Values = {
  date: '',
  time: '',
  place: '',
  link: '',
  contact: '',
}

function InterviewForm({
  existing,
  applicationId,
  onSave,
  onCancel,
}: {
  existing: Interview | null
  applicationId: string
  onSave: InterviewsAreaProps['onSave']
  onCancel: () => void
}) {
  const base = useId()
  const [values, setValues] = useState<Values>(
    existing
      ? {
          date: existing.date,
          time: existing.time,
          place: existing.place,
          link: existing.link,
          contact: existing.contact,
        }
      : emptyValues,
  )
  const [touched, setTouched] = useState<Set<InterviewField>>(new Set())
  const [submitted, setSubmitted] = useState(false)

  const fieldId = (name: keyof Values) => `${base}-${name}`
  const issues = interviewIssues(values)
  const shown = (field: InterviewField) => submitted || touched.has(field)

  const invalidShown = issues.invalid.filter(shown)
  const missingShown = issues.missing.filter(shown)
  const problems = [...missingShown, ...invalidShown]

  const touch = (field: InterviewField) =>
    setTouched((current) => new Set(current).add(field))

  const focusField = (field: InterviewField) =>
    document.getElementById(fieldId(field))?.focus()

  const set = (name: keyof Values) => (value: string) =>
    setValues((current) => ({ ...current, [name]: value }))

  const errorOf = (field: InterviewField): string | null => {
    if (!shown(field)) return null
    if (issues.missing.includes(field)) {
      return field === 'date' ? 'Elegí el día.' : 'Elegí la hora.'
    }
    if (issues.invalid.includes(field)) {
      return field === 'link'
        ? 'El enlace tiene que empezar con https://.'
        : 'No es un valor válido.'
    }
    return null
  }

  const fieldClassFor = (field: InterviewField) =>
    `${fieldClass} mt-1 px-3 py-2 ${errorOf(field) ? 'border-red-600' : ''}`

  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        setSubmitted(true)
        const first = [...issues.missing, ...issues.invalid][0]
        if (first) {
          focusField(first)
          return
        }
        onSave({
          ...(existing ? { id: existing.id } : {}),
          applicationId,
          ...values,
        })
        onCancel()
      }}
    >
      <p className="text-sm font-medium text-ink">
        {existing ? 'Editar entrevista' : 'Nueva entrevista'}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            className="block text-xs font-medium text-soft"
            htmlFor={fieldId('date')}
          >
            Día
          </label>
          <input
            aria-describedby={`${fieldId('date')}-error`}
            aria-invalid={errorOf('date') ? true : undefined}
            className={fieldClassFor('date')}
            id={fieldId('date')}
            type="date"
            value={values.date}
            onBlur={() => touch('date')}
            onChange={(event) => set('date')(event.target.value)}
          />
          <p
            className="mt-1 min-h-4 text-[11px] text-red-600"
            id={`${fieldId('date')}-error`}
          >
            {errorOf('date')}
          </p>
        </div>

        <div>
          <label
            className="block text-xs font-medium text-soft"
            htmlFor={fieldId('time')}
          >
            Hora
          </label>
          <input
            aria-describedby={`${fieldId('time')}-error`}
            aria-invalid={errorOf('time') ? true : undefined}
            className={fieldClassFor('time')}
            id={fieldId('time')}
            type="time"
            value={values.time}
            onBlur={() => touch('time')}
            onChange={(event) => set('time')(event.target.value)}
          />
          <p
            className="mt-1 min-h-4 text-[11px] text-red-600"
            id={`${fieldId('time')}-error`}
          >
            {errorOf('time')}
          </p>
        </div>
      </div>

      <div>
        <label
          className="block text-xs font-medium text-soft"
          htmlFor={fieldId('place')}
        >
          Lugar
        </label>
        <input
          aria-describedby={`${fieldId('place')}-help`}
          className={`${fieldClass} mt-1 px-3 py-2`}
          id={fieldId('place')}
          maxLength={MAX_PLACE}
          type="text"
          value={values.place}
          onChange={(event) => set('place')(event.target.value)}
        />
        <p
          className="mt-1 text-[11px] text-muted"
          id={`${fieldId('place')}-help`}
        >
          Dirección o sala. Si es a distancia, dejalo vacío.
        </p>
      </div>

      <div>
        <label
          className="block text-xs font-medium text-soft"
          htmlFor={fieldId('link')}
        >
          Enlace de la videollamada
        </label>
        <input
          aria-describedby={`${fieldId('link')}-help`}
          aria-invalid={errorOf('link') ? true : undefined}
          autoComplete="off"
          className={fieldClassFor('link')}
          id={fieldId('link')}
          inputMode="url"
          maxLength={MAX_LINK}
          placeholder="https://"
          type="url"
          value={values.link}
          onBlur={() => touch('link')}
          onChange={(event) => set('link')(event.target.value)}
        />
        <p
          className={`mt-1 text-[11px] ${errorOf('link') ? 'text-red-600' : 'text-muted'}`}
          id={`${fieldId('link')}-help`}
        >
          {errorOf('link') ??
            'Meet, Zoom, Teams. Si es presencial, dejalo vacío.'}
        </p>
      </div>

      <div>
        <label
          className="block text-xs font-medium text-soft"
          htmlFor={fieldId('contact')}
        >
          Con quién
        </label>
        <input
          aria-describedby={`${fieldId('contact')}-help`}
          className={`${fieldClass} mt-1 px-3 py-2`}
          id={fieldId('contact')}
          maxLength={MAX_CONTACT}
          type="text"
          value={values.contact}
          onChange={(event) => set('contact')(event.target.value)}
        />
        <p
          className="mt-1 text-[11px] text-muted"
          id={`${fieldId('contact')}-help`}
        >
          El nombre y el cargo de quien te entrevista, para tenerlo a mano.
        </p>
      </div>

      <div aria-live="polite" className="text-xs text-red-600">
        {problems.length > 0 ? (
          <div className="flex gap-1.5">
            <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <p>
              {[
                missingShown.length > 0
                  ? `Falta ${missingShown.map((field) => FIELD_LABEL[field]).join(' y ')}.`
                  : '',
                invalidShown.length > 0
                  ? `No cierra ${invalidShown.map((field) => FIELD_LABEL[field]).join(' y ')}.`
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}{' '}
              {problems.map((field) => (
                <button
                  key={field}
                  className="underline underline-offset-2"
                  type="button"
                  onClick={() => focusField(field)}
                >
                  Ir a {FIELD_LABEL[field]}
                </button>
              ))}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex gap-2">
        <button className={primaryClass} type="submit">
          Guardar entrevista
        </button>
        <button className={quietClass} type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

function InterviewRow({
  interview,
  onEdit,
  onRemove,
  onCalendar,
}: {
  interview: Interview
  onEdit: () => void
  onRemove: (id: string) => void
  onCalendar: (interview: Interview) => void
}) {
  const [asking, setAsking] = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink first-letter:uppercase">
            <CalendarClock aria-hidden className="size-4 shrink-0 text-brand" />
            {formatInterviewWhen(interview.date, interview.time)}
          </p>
          {interview.place ? (
            <p className="flex items-start gap-1.5 text-xs text-soft">
              <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <span className="[overflow-wrap:anywhere]">
                {interview.place}
              </span>
            </p>
          ) : null}
          {interview.link ? (
            <p className="flex items-start gap-1.5 text-xs text-soft">
              <ExternalLink aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <a
                className="[overflow-wrap:anywhere] underline underline-offset-2 hover:text-brand"
                href={interview.link}
                rel="noopener noreferrer"
                target="_blank"
              >
                Entrar a la videollamada
              </a>
            </p>
          ) : null}
          {interview.contact ? (
            <p className="flex items-start gap-1.5 text-xs text-soft">
              <UserRound aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <span className="[overflow-wrap:anywhere]">
                {interview.contact}
              </span>
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 gap-1">
          <button
            aria-label="Editar la entrevista"
            className={rowButtonClass}
            type="button"
            onClick={onEdit}
          >
            <Pencil aria-hidden className="size-4" />
          </button>
          <button
            aria-expanded={asking}
            aria-label="Borrar la entrevista"
            className={rowButtonClass}
            type="button"
            onClick={() => setAsking((current) => !current)}
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          className={secondaryClass}
          type="button"
          onClick={() => {
            onCalendar(interview)
            setDownloaded(true)
            setTimeout(() => setDownloaded(false), 5000)
          }}
        >
          <CalendarPlus aria-hidden className="size-4" />
          Agregar al calendario
        </button>
        <p aria-live="polite" className="text-[11px] text-muted">
          {downloaded
            ? 'Se bajó el archivo. Abrilo y se suma a tu calendario.'
            : 'Baja un archivo .ics, con un aviso el día anterior.'}
        </p>
      </div>

      {asking ? (
        <ConfirmDelete
          question="¿Borrar esta entrevista? No se puede deshacer."
          onCancel={() => setAsking(false)}
          onConfirm={() => onRemove(interview.id)}
        />
      ) : null}
    </li>
  )
}

/** Fecha, hora, lugar o enlace y con quién; con botón para llevarla al
 * calendario. */
export function InterviewsArea({
  applicationId,
  interviews,
  onSave,
  onRemove,
  onCalendar,
}: InterviewsAreaProps) {
  /** `'new'`, el id de la que se edita o nada. */
  const [editing, setEditing] = useState<'new' | string | null>(null)
  const current =
    editing && editing !== 'new'
      ? (interviews.find((item) => item.id === editing) ?? null)
      : null

  return (
    <div className="space-y-4">
      {editing ? (
        <InterviewForm
          key={editing}
          applicationId={applicationId}
          existing={current}
          onCancel={() => setEditing(null)}
          onSave={onSave}
        />
      ) : (
        <button
          className={secondaryClass}
          type="button"
          onClick={() => setEditing('new')}
        >
          <CalendarPlus aria-hidden className="size-4" />
          Agendar entrevista
        </button>
      )}

      {interviews.length === 0 ? (
        <p className="rounded-xl border border-dashed border-sky px-4 py-5 text-center text-xs text-muted">
          Sin entrevistas todavía. Cuando te llamen, anotá el día y la hora acá
          y llevala a tu calendario con un aviso el día anterior.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {interviews.map((interview) => (
            <InterviewRow
              key={interview.id}
              interview={interview}
              onCalendar={onCalendar}
              onEdit={() => setEditing(interview.id)}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
