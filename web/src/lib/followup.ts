/**
 * Notas y entrevistas de cada postulación.
 *
 * Viven solo en este navegador, bajo su propia clave: a propósito NO están en
 * `Application` ni en `SyncedState`, así que ni el sync de la cuenta ni
 * ninguna petición a la API las lleva (Zero Data Policy). Lo que se escribe
 * acá es lo más íntimo del seguimiento —qué preguntaron, con quién se habló—
 * y se queda donde se escribió.
 */

export const FOLLOWUP_KEY = 'jobit.followup.v1'

export const MAX_NOTE = 4000
export const MAX_PLACE = 200
export const MAX_LINK = 500
export const MAX_CONTACT = 120
/** Topes de cordura, no de producto: nadie llega, pero el almacenamiento local
 * es chico y lo que se lee de ahí no es confiable. */
export const MAX_NOTES = 500
export const MAX_INTERVIEWS = 200

export interface Note {
  id: string
  applicationId: string
  text: string
  createdAt: string
  updatedAt: string
}

export interface Interview {
  id: string
  applicationId: string
  /** `YYYY-MM-DD`, el día en Uruguay. */
  date: string
  /** `HH:MM`, 24 horas. */
  time: string
  /** Dirección o sala; vacío si es a distancia. */
  place: string
  /** Enlace de la videollamada; vacío si es presencial. */
  link: string
  /** Con quién es: nombre y cargo, como se quiera anotar. */
  contact: string
  /** Sube con cada edición: el calendario lo toma como actualización del mismo
   * evento (SEQUENCE). */
  revision: number
}

export interface FollowUpState {
  notes: Note[]
  interviews: Interview[]
}

export const EMPTY_FOLLOWUP: FollowUpState = { notes: [], interviews: [] }

/* ───────────── Lectura saneada ───────────── */

const text = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.slice(0, max) : ''

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^(\d{2}):(\d{2})$/

/** Un día que existe en el calendario: `2026-02-30` no. */
export function isValidDate(value: string): boolean {
  const match = DATE_RE.exec(value)
  if (!match) return false
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ]
  const probe = new Date(Date.UTC(year, month - 1, day))
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  )
}

export function isValidTime(value: string): boolean {
  const match = TIME_RE.exec(value)
  if (!match) return false
  return Number(match[1]) <= 23 && Number(match[2]) <= 59
}

/** Solo http(s): el enlace se abre y se escribe en el .ics tal cual. */
export function isMeetingLink(value: string): boolean {
  if (/\s/.test(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function readNotes(value: unknown): Note[] {
  if (!Array.isArray(value)) return []

  return value
    .flatMap((item): Note[] => {
      if (typeof item !== 'object' || item === null) return []
      const raw = item as Record<string, unknown>
      const body = text(raw.text, MAX_NOTE)
      if (
        typeof raw.id !== 'string' ||
        typeof raw.applicationId !== 'string' ||
        body.trim() === ''
      ) {
        return []
      }
      const createdAt = text(raw.createdAt, 40)
      return [
        {
          id: raw.id,
          applicationId: raw.applicationId,
          text: body,
          createdAt,
          updatedAt: text(raw.updatedAt, 40) || createdAt,
        },
      ]
    })
    .slice(0, MAX_NOTES)
}

function readInterviews(value: unknown): Interview[] {
  if (!Array.isArray(value)) return []

  return value
    .flatMap((item): Interview[] => {
      if (typeof item !== 'object' || item === null) return []
      const raw = item as Record<string, unknown>
      const date = text(raw.date, 10)
      const time = text(raw.time, 5)
      const link = text(raw.link, MAX_LINK).trim()
      if (
        typeof raw.id !== 'string' ||
        typeof raw.applicationId !== 'string' ||
        !isValidDate(date) ||
        !isValidTime(time)
      ) {
        return []
      }
      return [
        {
          id: raw.id,
          applicationId: raw.applicationId,
          date,
          time,
          place: text(raw.place, MAX_PLACE),
          link: isMeetingLink(link) ? link : '',
          contact: text(raw.contact, MAX_CONTACT),
          revision:
            typeof raw.revision === 'number' && raw.revision >= 0
              ? Math.floor(raw.revision)
              : 0,
        },
      ]
    })
    .slice(0, MAX_INTERVIEWS)
}

/** Lo guardado se trata como no confiable: se recorta y se descarta lo que no
 * tenga forma de nota o de entrevista. */
export function readFollowUp(value: unknown): FollowUpState {
  if (typeof value !== 'object' || value === null) return EMPTY_FOLLOWUP
  const raw = value as Record<string, unknown>
  return {
    notes: readNotes(raw.notes),
    interviews: readInterviews(raw.interviews),
  }
}

/* ───────────── Cambios (puros, para testear sin React) ───────────── */

export function addNote(
  state: FollowUpState,
  input: { id: string; applicationId: string; text: string; now: string },
): FollowUpState {
  const body = input.text.trim().slice(0, MAX_NOTE)
  if (body === '' || state.notes.length >= MAX_NOTES) return state

  return {
    ...state,
    notes: [
      {
        id: input.id,
        applicationId: input.applicationId,
        text: body,
        createdAt: input.now,
        updatedAt: input.now,
      },
      ...state.notes,
    ],
  }
}

export function editNote(
  state: FollowUpState,
  id: string,
  nextText: string,
  now: string,
): FollowUpState {
  const body = nextText.trim().slice(0, MAX_NOTE)
  if (body === '') return state

  return {
    ...state,
    notes: state.notes.map((note) =>
      note.id === id ? { ...note, text: body, updatedAt: now } : note,
    ),
  }
}

export const removeNote = (
  state: FollowUpState,
  id: string,
): FollowUpState => ({
  ...state,
  notes: state.notes.filter((note) => note.id !== id),
})

export type InterviewDraft = Omit<Interview, 'revision'>

/** Crea la entrevista o, si el id ya existe, la edita y sube su revisión. */
export function saveInterview(
  state: FollowUpState,
  draft: InterviewDraft,
): FollowUpState {
  const clean: InterviewDraft = {
    ...draft,
    place: draft.place.trim().slice(0, MAX_PLACE),
    link: draft.link.trim().slice(0, MAX_LINK),
    contact: draft.contact.trim().slice(0, MAX_CONTACT),
  }
  const existing = state.interviews.find((item) => item.id === draft.id)

  if (existing) {
    return {
      ...state,
      interviews: state.interviews.map((item) =>
        item.id === draft.id
          ? { ...clean, revision: existing.revision + 1 }
          : item,
      ),
    }
  }
  if (state.interviews.length >= MAX_INTERVIEWS) return state

  return {
    ...state,
    interviews: [...state.interviews, { ...clean, revision: 0 }],
  }
}

export const removeInterview = (
  state: FollowUpState,
  id: string,
): FollowUpState => ({
  ...state,
  interviews: state.interviews.filter((item) => item.id !== id),
})

/** Al quitar una postulación del seguimiento se va con sus notas y entrevistas:
 * no queda nada colgando de algo que ya no se ve. */
export const removeForApplication = (
  state: FollowUpState,
  applicationId: string,
): FollowUpState => ({
  notes: state.notes.filter((note) => note.applicationId !== applicationId),
  interviews: state.interviews.filter(
    (item) => item.applicationId !== applicationId,
  ),
})

/** Lo más reciente primero. */
export const notesFor = (state: FollowUpState, applicationId: string): Note[] =>
  state.notes
    .filter((note) => note.applicationId === applicationId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

/** En orden de fecha: la próxima arriba. */
export const interviewsFor = (
  state: FollowUpState,
  applicationId: string,
): Interview[] =>
  state.interviews
    .filter((item) => item.applicationId === applicationId)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))

/* ───────────── Validación del formulario de entrevista ───────────── */

export type InterviewField = 'date' | 'time' | 'link'

export interface InterviewIssues {
  /** Vacío y obligatorio. */
  missing: InterviewField[]
  /** Completo pero que no cierra. */
  invalid: InterviewField[]
}

export function interviewIssues(draft: {
  date: string
  time: string
  link: string
}): InterviewIssues {
  const missing: InterviewField[] = []
  const invalid: InterviewField[] = []

  if (draft.date === '') missing.push('date')
  else if (!isValidDate(draft.date)) invalid.push('date')

  if (draft.time === '') missing.push('time')
  else if (!isValidTime(draft.time)) invalid.push('time')

  const link = draft.link.trim()
  if (link !== '' && !isMeetingLink(link)) invalid.push('link')

  return { missing, invalid }
}
