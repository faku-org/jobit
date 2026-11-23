import type { Interview } from './followup.ts'

/**
 * Un evento de calendario (RFC 5545) para una entrevista. Todo se arma en el
 * navegador y se baja como archivo: no se conecta nada ni sale ningún dato.
 *
 * La hora se escribe en la zona del lugar donde ocurre la entrevista
 * (America/Montevideo, UTC-3 todo el año desde que Uruguay dejó el horario de
 * verano en 2015), con su VTIMEZONE, así Google Calendar, Outlook y iOS la
 * muestran igual sin importar dónde esté el teléfono.
 */

export const ICS_TIMEZONE = 'America/Montevideo'

/** Cuánto dura una entrevista en el calendario, que no pregunta duración. */
export const INTERVIEW_MINUTES = 60

const CRLF = '\r\n'

/** Caracteres de control que no tienen lugar en un valor TEXT. Se dejan pasar
 * el salto de línea y el retorno, que se escapan aparte. */
function dropControls(value: string): string {
  let out = ''
  for (const char of value) {
    const code = char.charCodeAt(0)
    const control = code < 0x20 || code === 0x7f
    if (!control || code === 0x0a || code === 0x0d) out += char
  }
  return out
}

/** Valor TEXT: se escapan `\`, `;`, `,` y los saltos de línea. */
export function escapeText(value: string): string {
  return dropControls(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

const encoder = new TextEncoder()

/**
 * Las líneas largas se parten a 75 octetos con CRLF + espacio. Se cuenta en
 * bytes UTF-8 y nunca se corta un carácter por la mitad.
 */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line

  const parts: string[] = []
  let current = ''
  let bytes = 0
  /** La continuación arranca con un espacio, que también cuenta. */
  let limit = 75

  for (const char of line) {
    const size = encoder.encode(char).length
    if (bytes + size > limit) {
      parts.push(current)
      current = ''
      bytes = 0
      limit = 74
    }
    current += char
    bytes += size
  }
  parts.push(current)

  return parts.join(`${CRLF} `)
}

const pad = (value: number, length = 2): string =>
  String(value).padStart(length, '0')

/** `2026-12-01` y `15:30` más unos minutos, como `20261201T163000`. */
function localStamp(date: string, time: string, plusMinutes = 0): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  const [hour = 0, minute = 0] = time.split(':').map(Number)
  const moment = new Date(
    Date.UTC(year, month - 1, day, hour, minute + plusMinutes),
  )

  return (
    `${pad(moment.getUTCFullYear(), 4)}${pad(moment.getUTCMonth() + 1)}` +
    `${pad(moment.getUTCDate())}T${pad(moment.getUTCHours())}` +
    `${pad(moment.getUTCMinutes())}00`
  )
}

/** Un instante en UTC: `20261122T201500Z`. */
function utcStamp(moment: Date): string {
  return (
    `${pad(moment.getUTCFullYear(), 4)}${pad(moment.getUTCMonth() + 1)}` +
    `${pad(moment.getUTCDate())}T${pad(moment.getUTCHours())}` +
    `${pad(moment.getUTCMinutes())}${pad(moment.getUTCSeconds())}Z`
  )
}

/** El mismo id da el mismo UID: bajar el archivo dos veces actualiza el evento
 * en vez de duplicarlo. */
export const interviewUid = (interview: Pick<Interview, 'id'>): string =>
  `jobit-entrevista-${interview.id}@jobit.uy`

export interface IcsSource {
  interview: Interview
  /** El título del aviso al que se postuló. */
  title: string
  company: string | null
  /** Inyectable para poder testear DTSTAMP. */
  now?: Date
}

export function buildInterviewIcs({
  interview,
  title,
  company,
  now = new Date(),
}: IcsSource): string {
  const where = company ? `${title} en ${company}` : title
  const description = [
    `Postulación: ${where}`,
    interview.contact ? `Con: ${interview.contact}` : '',
    interview.place ? `Lugar: ${interview.place}` : '',
    interview.link ? `Enlace: ${interview.link}` : '',
    'Agendada desde JobIt.',
  ]
    .filter(Boolean)
    .join('\n')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//JobIt//Seguimiento//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    `TZID:${ICS_TIMEZONE}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0300',
    'TZOFFSETTO:-0300',
    'TZNAME:-03',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${interviewUid(interview)}`,
    `DTSTAMP:${utcStamp(now)}`,
    `SEQUENCE:${Math.max(0, interview.revision)}`,
    `DTSTART;TZID=${ICS_TIMEZONE}:${localStamp(interview.date, interview.time)}`,
    `DTEND;TZID=${ICS_TIMEZONE}:${localStamp(interview.date, interview.time, INTERVIEW_MINUTES)}`,
    `SUMMARY:${escapeText(`Entrevista: ${where}`)}`,
    `DESCRIPTION:${escapeText(description)}`,
  ]

  if (interview.place) lines.push(`LOCATION:${escapeText(interview.place)}`)
  if (interview.link) lines.push(`URL:${interview.link}`)

  lines.push(
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(`Mañana: entrevista de ${where}`)}`,
    'TRIGGER:-P1D',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  )

  return lines.map(foldLine).join(CRLF) + CRLF
}

/** `entrevista-cocinero-la-pasiva.ics`: sin tildes ni caracteres raros. */
export function interviewIcsName(
  title: string,
  company: string | null,
): string {
  const slug = [title, company ?? '']
    .join(' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '')

  return `entrevista${slug ? `-${slug}` : ''}.ics`
}

/** Baja el archivo. Solo en el navegador: el generador de arriba no lo toca. */
export function downloadIcs(content: string, filename: string): void {
  const url = URL.createObjectURL(
    new Blob([content], { type: 'text/calendar;charset=utf-8' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
