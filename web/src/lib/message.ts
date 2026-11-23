import {
  LANGUAGE_LEVEL_LABEL,
  type MessageKind,
  type Resume,
} from './resume.ts'
import type { Job } from './types.ts'

export const MESSAGE_LABEL: Record<MessageKind, string> = {
  formal: 'Formal',
  short: 'Corta',
  first: 'Primer empleo',
}

/** Las plantillas de fábrica. Lo que la persona guarda las reemplaza, y puede
 * volver a ellas cuando quiera. */
export const DEFAULT_TEMPLATES: Record<MessageKind, string> = {
  formal: `Buenos días,

Me llamo {nombre} y me postulo al puesto de {puesto} en {empresa}. Les adjunto {adjuntos} para que revisen mi postulación.

Quedo a disposición para ampliar cualquier dato o coordinar una entrevista.

Saludos cordiales,
{nombre}`,
  short: `Hola, soy {nombre} y me postulo al puesto de {puesto} en {empresa}. Les adjunto {adjuntos}. ¡Gracias!`,
  first: `Hola, soy {nombre} y me postulo al puesto de {puesto} en {empresa}. Es mi primer empleo formal, pero tengo muchas ganas de aprender y de comprometerme con el trabajo. Les adjunto {adjuntos} para que lo revisen.

Quedo a la espera de su respuesta.

Saludos,
{nombre}`,
}

/** Lo que se puede escribir entre llaves en una plantilla. */
export const PLACEHOLDERS = [
  'nombre',
  'puesto',
  'empresa',
  'adjuntos',
  'idiomas',
  'links',
] as const

export type Placeholder = (typeof PLACEHOLDERS)[number]

/** La plantilla vigente de una variante: la guardada, o la de fábrica. */
export const templateFor = (resume: Resume, kind: MessageKind): string =>
  resume.messages[kind] ?? DEFAULT_TEMPLATES[kind]

/** Los valores con los que se completa, tomados del perfil y de la oferta. */
export function messageValues(
  job: Job,
  resume: Resume,
): Record<Placeholder, string> {
  return {
    nombre: resume.name.trim(),
    puesto: job.title,
    empresa: job.company ?? 'su empresa',
    adjuntos: resume.attachments.trim() || 'mi CV',
    idiomas: resume.languages
      .map((l) => `${l.name} (${LANGUAGE_LEVEL_LABEL[l.level].toLowerCase()})`)
      .join(', '),
    links: resume.links.map((l) => l.url).join(', '),
  }
}

const TOKEN = new RegExp(`\\{(${PLACEHOLDERS.join('|')})\\}`, 'g')

/** Completa las llaves de la plantilla. Lo que no es una llave conocida queda
 * como lo escribió la persona. */
export function fillTemplate(
  template: string,
  values: Record<Placeholder, string>,
): string {
  return template.replace(TOKEN, (_, key: Placeholder) => values[key]).trim()
}

/* Una dirección de mail, sin pretender ser la gramática completa del RFC: sólo
   lo que se ve en un aviso. El dominio termina en letras, así que un punto de
   cierre de oración no entra. */
const EMAIL =
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g
const EXACT = new RegExp(`^${EMAIL.source}$`)

/* Lo que parece un mail y no lo es: archivos con @2x, casillas que no leen, y
   el dominio de ejemplo. */
const NOT_A_CONTACT = [
  /^(?:no-?reply|do-?not-?reply|noresponder|no-?responder)/i,
  /\.(?:png|jpe?g|gif|svg|webp|pdf|css|js)$/i,
  /@(?:example|ejemplo|test|dominio|email)\.[a-z]+$/i,
]

const isContact = (address: string): boolean =>
  !NOT_A_CONTACT.some((rule) => rule.test(address))

/**
 * El mail de contacto de una oferta, sólo si ya está en ella. Primero un
 * `mailto:` en el enlace de postulación, que es lo más explícito; si no, la
 * descripción y los requisitos. Con más de una dirección distinta no se
 * adivina cuál es: devuelve nada y la persona usa "Copiar".
 */
export function findContactEmail(job: Job): string | null {
  if (/^mailto:/i.test(job.apply_url)) {
    const address = decodeURIComponent(
      job.apply_url.slice('mailto:'.length).split('?')[0] ?? '',
    ).trim()
    return EXACT.test(address) && isContact(address) ? address : null
  }

  const found = new Map<string, string>()
  for (const text of [job.description, job.requirements ?? '']) {
    for (const match of text.matchAll(EMAIL)) {
      const key = match[0].toLowerCase()
      if (isContact(match[0]) && !found.has(key)) found.set(key, match[0])
    }
  }
  return found.size === 1 ? ([...found.values()][0] ?? null) : null
}

/** Un `mailto` más largo que esto lo cortan algunos clientes de correo. */
export const MAX_MAILTO_CHARS = 1800

/**
 * El enlace que abre el cliente de correo con todo cargado, o `null` si el
 * mensaje no entra: truncarlo en silencio mandaría una postulación cortada. Los
 * saltos de línea van como CRLF, que es lo que pide RFC 6068.
 */
export function buildMailto(
  to: string,
  subject: string,
  body: string,
): string | null {
  const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    body.replace(/\r?\n/g, '\r\n'),
  )}`
  return url.length <= MAX_MAILTO_CHARS ? url : null
}

export const mailSubject = (job: Job, name: string): string =>
  name.trim() === ''
    ? `Postulación: ${job.title}`
    : `Postulación: ${job.title} - ${name.trim()}`

/**
 * Lo que dice "Qué adjuntás" partido en piezas, para mostrarlas como adjuntos
 * en la vista previa: "mi CV, carta y certificados" son tres. Vacío vale "mi CV",
 * igual que `{adjuntos}` en la plantilla.
 */
export function attachmentList(text: string): string[] {
  const parts = text
    .split(/\s*(?:,|;|\sy\s|\se\s)\s*/i)
    .map((part) => part.trim())
    .filter((part) => part !== '')
  return parts.length > 0 ? parts : ['mi CV']
}

/**
 * Lo que dice el pie de la página de armar: la nota (copiado, guardado…) manda;
 * sin nombre no dice nada (el pie pide el nombre); si no, a dónde va. Con `null`
 * la pantalla muestra "falta tu nombre".
 */
export function sendStatus(
  note: string,
  ready: boolean,
  email: string | null,
  mailto: string | null,
): string | null {
  if (note) return note
  if (!ready) return null
  if (email === null)
    return 'Sin mail en el aviso: se copia y se abre el aviso.'
  if (mailto === null)
    return 'Es largo para el correo: copialo y pegalo en un mail.'
  return `Va a ${email}.`
}

/** La aclaración bajo la vista previa: cómo sale y qué queda de tu lado. */
export function sendHint(email: string | null, mailto: string | null): string {
  if (email === null)
    return 'Este aviso no trae un mail: se copia el mensaje y se abre el aviso, donde lo pegás.'
  if (mailto === null)
    return `Es demasiado largo para abrirlo en el correo. Copialo y pegalo en un mail a ${email}.`
  return 'Los adjuntos los sumás vos en tu correo: un enlace de mail no puede llevarlos.'
}
