import type { Profile } from './profile.ts'
import { EMPTY_FILTERS, type Filters, type Preferences } from './types.ts'

/**
 * Lo que va en un CV y no en el ranking: foto, dónde vive, idiomas, links,
 * referencias y, si la persona quiere, su situación de discapacidad. Vive en
 * este navegador y nada más. A propósito NO es parte de `Profile`, que sí
 * viaja con la sincronización: acá hay datos personales y uno sensible, y la
 * Zero Data Policy dice que no se mandan. Lo único que sale de acá es el
 * archivo que la persona se descarga con el botón de exportar.
 */
export interface Resume {
  /** Cómo se firma la persona en una postulación. Vacío hasta que lo escribe. */
  name: string
  /** Qué adjunta ("mi CV y mi certificado"); vacío usa "mi CV". */
  attachments: string
  /** Las variantes del mensaje de postulación que la persona editó y guardó. Lo
   * que no está acá usa la plantilla de fábrica. */
  messages: Partial<Record<MessageKind, string>>
  /** Data URL de la foto ya recortada y comprimida, o vacío. */
  photo: string
  /** Departamento de donde vive, del mismo vocabulario que el tablero. */
  department: string
  /** Barrio o ciudad, texto libre. Nunca la dirección exacta. */
  city: string
  languages: ResumeLanguage[]
  /** Puesto que busca, en sus palabras. */
  role: string
  /** Busca un puesto de jefatura. Es lo único de la jerarquía que las ofertas
   * no traen, por eso queda acá y no en las preferencias que ordenan. */
  lead: boolean
  links: ResumeLink[]
  references: ResumeReference[]
  disability: ResumeDisability
}

export type MessageKind = 'formal' | 'short' | 'first'

export const MESSAGE_KINDS: MessageKind[] = ['formal', 'short', 'first']

export type LanguageLevel = 'basic' | 'intermediate' | 'advanced' | 'native'

export interface ResumeLanguage {
  name: string
  level: LanguageLevel
}

export type LinkKind = 'linkedin' | 'github' | 'portfolio' | 'other'

export interface ResumeLink {
  kind: LinkKind
  url: string
}

export interface ResumeReference {
  name: string
  relation: string
  contact: string
}

export interface ResumeDisability {
  /** Sólo `true` si la persona lo marcó ella. */
  declared: boolean
  /** Lo que quiera aclarar, por ejemplo qué adaptación necesita. */
  note: string
}

export const EMPTY_RESUME: Resume = {
  name: '',
  attachments: '',
  messages: {},
  photo: '',
  department: '',
  city: '',
  languages: [],
  role: '',
  lead: false,
  links: [],
  references: [],
  disability: { declared: false, note: '' },
}

export const DEPARTMENT_NAMES = [
  'Artigas',
  'Canelones',
  'Cerro Largo',
  'Colonia',
  'Durazno',
  'Flores',
  'Florida',
  'Lavalleja',
  'Maldonado',
  'Montevideo',
  'Paysandú',
  'Río Negro',
  'Rivera',
  'Rocha',
  'Salto',
  'San José',
  'Soriano',
  'Tacuarembó',
  'Treinta y Tres',
] as const

export const LANGUAGE_LEVELS: LanguageLevel[] = [
  'basic',
  'intermediate',
  'advanced',
  'native',
]

export const LANGUAGE_LEVEL_LABEL: Record<LanguageLevel, string> = {
  basic: 'Básico',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
  native: 'Nativo',
}

/** Idiomas que se ofrecen para elegir; el resto se escribe a mano. */
export const LANGUAGE_SUGGESTIONS = [
  'Español',
  'Inglés',
  'Portugués',
  'Francés',
  'Italiano',
  'Alemán',
  'Lengua de señas uruguaya',
] as const

export const LINK_KINDS: LinkKind[] = [
  'linkedin',
  'github',
  'portfolio',
  'other',
]

export const LINK_KIND_LABEL: Record<LinkKind, string> = {
  linkedin: 'LinkedIn',
  github: 'GitHub',
  portfolio: 'Portfolio o web',
  other: 'Otro',
}

export const MAX_LANGUAGES = 8
export const MAX_LINKS = 6
export const MAX_REFERENCES = 4
/** Un mensaje de postulación largo no entra en un `mailto`; esto corta lo que
 * alguien haya pegado a mano en el almacenamiento. */
export const MAX_MESSAGE_CHARS = 1500
/** Una foto de 400 px en JPEG pesa ~40 KB; esto deja margen y corta lo que
 * alguien haya pegado a mano en el almacenamiento. */
export const MAX_PHOTO_CHARS = 250_000

const PHOTO_PREFIX = /^data:image\/(?:jpeg|webp);base64,[A-Za-z0-9+/=]+$/

/**
 * Deja una URL lista para usar o vacío. Agrega https:// si falta y sólo acepta
 * http(s): un `javascript:` pegado en el campo no llega nunca a un href.
 */
export function normalizeUrl(input: string): string {
  const text = input.trim()
  if (text === '' || /\s/.test(text)) return ''
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return ''
    if (!url.hostname.includes('.')) return ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}

/** El tipo que sugiere la URL, para que pegar un link de LinkedIn no obligue
 * a elegirlo aparte. */
export function linkKindOf(url: string): LinkKind {
  if (/(?:^|\.)linkedin\.com\//i.test(url.replace(/^https?:\/\//i, '')))
    return 'linkedin'
  if (/(?:^|\.)github\.com\//i.test(url.replace(/^https?:\/\//i, '')))
    return 'github'
  return 'other'
}

const clip = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

const isLevel = (value: unknown): value is LanguageLevel =>
  LANGUAGE_LEVELS.includes(value as LanguageLevel)

const isKind = (value: unknown): value is LinkKind =>
  LINK_KINDS.includes(value as LinkKind)

const objects = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          typeof item === 'object' && item !== null,
      )
    : []

/**
 * Lee lo guardado en el navegador sin confiar en su forma: el almacenamiento lo
 * puede haber tocado cualquiera y una versión vieja puede no traer los campos.
 * Siempre devuelve un `Resume` válido.
 */
export function sanitizeResume(raw: unknown): Resume {
  if (typeof raw !== 'object' || raw === null) return EMPTY_RESUME
  const source = raw as Record<string, unknown>

  const languages: ResumeLanguage[] = []
  for (const item of objects(source.languages)) {
    const name = clip(item.name, 40)
    if (
      name === '' ||
      languages.some((entry) => entry.name.toLowerCase() === name.toLowerCase())
    )
      continue
    languages.push({
      name,
      level: isLevel(item.level) ? item.level : 'intermediate',
    })
  }

  const links: ResumeLink[] = []
  for (const item of objects(source.links)) {
    const url = normalizeUrl(typeof item.url === 'string' ? item.url : '')
    if (url === '' || links.some((entry) => entry.url === url)) continue
    links.push({ kind: isKind(item.kind) ? item.kind : linkKindOf(url), url })
  }

  const references = objects(source.references)
    .map((item) => ({
      name: clip(item.name, 80),
      relation: clip(item.relation, 80),
      contact: clip(item.contact, 120),
    }))
    .filter((item) => item.name !== '')

  const disability =
    typeof source.disability === 'object' && source.disability !== null
      ? (source.disability as Record<string, unknown>)
      : {}
  const declared = disability.declared === true

  const photo =
    typeof source.photo === 'string' &&
    source.photo.length <= MAX_PHOTO_CHARS &&
    PHOTO_PREFIX.test(source.photo)
      ? source.photo
      : ''

  const department = (DEPARTMENT_NAMES as readonly string[]).includes(
    source.department as string,
  )
    ? (source.department as string)
    : ''

  const saved =
    typeof source.messages === 'object' && source.messages !== null
      ? (source.messages as Record<string, unknown>)
      : {}
  const messages: Resume['messages'] = {}
  for (const kind of MESSAGE_KINDS) {
    const text = clip(saved[kind], MAX_MESSAGE_CHARS)
    if (text !== '') messages[kind] = text
  }

  return {
    name: clip(source.name, 80),
    attachments: clip(source.attachments, 120),
    messages,
    photo,
    department,
    city: clip(source.city, 60),
    languages: languages.slice(0, MAX_LANGUAGES),
    role: clip(source.role, 80),
    lead: source.lead === true,
    links: links.slice(0, MAX_LINKS),
    references: references.slice(0, MAX_REFERENCES),
    /* Sin la marca, la nota no se guarda: una aclaración sobre una condición
       que la persona dijo que no declara no tiene por qué quedar. */
    disability: { declared, note: declared ? clip(disability.note, 200) : '' },
  }
}

/** Cuántos bloques completó, para el resumen de cada sección y la insignia. */
export function resumeCount(resume: Resume): number {
  return (
    (resume.photo === '' ? 0 : 1) +
    (resume.department === '' && resume.city === '' ? 0 : 1) +
    resume.languages.length +
    (resume.role === '' && !resume.lead ? 0 : 1) +
    resume.links.length +
    resume.references.length +
    (resume.disability.declared ? 1 : 0)
  )
}

/** Lo que el lector de CV encontró y la persona dejó tildado para el perfil. */
export interface ResumeFound {
  languages: ResumeLanguage[]
  links: ResumeLink[]
  place?: { department: string; city: string } | null
}

/** Suma lo que leyó un CV sin pisar lo que la persona ya cargó. */
export function mergeReading(resume: Resume, found: ResumeFound): Resume {
  const known = new Set(resume.languages.map((l) => l.name.toLowerCase()))
  const languages = [
    ...resume.languages,
    ...found.languages.filter((l) => !known.has(l.name.toLowerCase())),
  ].slice(0, MAX_LANGUAGES)

  const urls = new Set(resume.links.map((l) => l.url))
  const links = [
    ...resume.links,
    ...found.links.filter((l) => !urls.has(l.url)),
  ].slice(0, MAX_LINKS)

  const place = found.place
  const emptyPlace = resume.department === '' && resume.city === ''

  return sanitizeResume({
    ...resume,
    languages,
    links,
    department: emptyPlace && place ? place.department : resume.department,
    city: emptyPlace && place ? place.city : resume.city,
  })
}

/**
 * Para pasar un idioma de la lista de nivel del CV a lo guardado.
 * "Básico", "intermedio", "avanzado", "nativo", o un nivel MCER (A1-C2).
 */
export function levelFromText(folded: string): LanguageLevel | null {
  if (/\b(?:nativo|materna|bilingue|c2)\b/.test(folded)) return 'native'
  if (/\b(?:avanzado|fluido|fluida|c1|b2)\b/.test(folded)) return 'advanced'
  if (/\b(?:intermedio|b1)\b/.test(folded)) return 'intermediate'
  if (/\b(?:basico|elemental|escolar|a1|a2)\b/.test(folded)) return 'basic'
  return null
}

/**
 * Los filtros del tablero que salen de lo que la persona cargó: el puesto va al
 * filtro de título, y jerarquía, jornada y modalidad sólo cuando eligió una
 * sola, porque el tablero filtra por un valor y no por una lista. Con varias
 * elegidas esas siguen ordenando "Para vos", pero no recortan el listado.
 * Jefatura no se filtra: las ofertas no traen ese dato.
 */
export function filtersFromSearch(
  resume: Resume,
  preferences: Preferences,
): Filters {
  const only = <T extends string>(list: T[]): T | '' =>
    list.length === 1 ? (list[0] ?? '') : ''
  return {
    ...EMPTY_FILTERS,
    title: resume.role,
    level: only(preferences.levels),
    mode: only(preferences.modes),
    jobType: only(preferences.jobTypes),
  }
}

/** Nombre de archivo del export: sin la fecha de hoy nadie sabe cuál es el
 * último. */
export const exportFileName = (now: Date): string =>
  `jobit-perfil-${now.toISOString().slice(0, 10)}.json`

/**
 * Todo lo que la persona cargó en un solo archivo suyo. Es la salida de la
 * descarga, no de la red: se arma acá y la arma el navegador. Con
 * `includeDisability` en falso la situación de discapacidad queda afuera aunque
 * esté marcada, para el que comparte el archivo con alguien.
 */
export function buildExport(
  profile: Profile,
  preferences: Preferences,
  resume: Resume,
  now: Date,
  includeDisability = true,
): Record<string, unknown> {
  const { photo: _photo, disability, ...rest } = resume
  return {
    app: 'jobit',
    formato: 1,
    exportado: now.toISOString(),
    formacion: {
      nivel: profile.education,
      titulos: profile.degrees,
      cursos: profile.courses,
      aniosExperiencia: profile.experienceYears,
    },
    busqueda: {
      puesto: resume.role,
      jefatura: resume.lead,
      jerarquia: preferences.levels,
      jornada: preferences.jobTypes,
      modalidad: preferences.modes,
      rubros: preferences.categories,
      departamentos: preferences.departments,
      sueldo: preferences.salary,
    },
    contacto: {
      nombre: rest.name,
      departamento: rest.department,
      ciudad: rest.city,
      links: rest.links,
    },
    idiomas: rest.languages,
    referencias: rest.references,
    foto: resume.photo === '' ? null : resume.photo,
    ...(includeDisability && disability.declared
      ? { discapacidad: disability }
      : {}),
  }
}
