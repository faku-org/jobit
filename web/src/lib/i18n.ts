import { en } from './locales/en.ts'
import { type MessageKey, type Messages, es } from './locales/es.ts'
import { pt } from './locales/pt.ts'

export type { MessageKey } from './locales/es.ts'

/**
 * Los idiomas de la interfaz. `ready` dice si se puede elegir: un idioma pasa
 * a listo cuando toda la interfaz está traducida, no cuando su diccionario
 * cubre lo que hay en `es.ts` (que hoy es solo una parte). En desarrollo se
 * pueden elegir todos, para ver cómo queda lo que ya está traducido.
 *
 * `lang` es lo que va en `<html lang>`: lo leen el lector de pantalla, la
 * separación en sílabas y el corrector del navegador.
 */
export const LOCALES = [
  { code: 'es', label: 'Español', lang: 'es-UY', ready: true },
  { code: 'en', label: 'English', lang: 'en', ready: false },
  { code: 'pt', label: 'Português', lang: 'pt-BR', ready: false },
] as const

export type Locale = (typeof LOCALES)[number]['code']

export const DEFAULT_LOCALE: Locale = 'es'

const DICTIONARIES: Record<Locale, Partial<Messages>> = { es, en, pt }

export const isLocale = (value: unknown): value is Locale =>
  LOCALES.some((locale) => locale.code === value)

export const htmlLang = (locale: Locale): string =>
  LOCALES.find((entry) => entry.code === locale)?.lang ?? 'es-UY'

/** ¿Se puede elegir este idioma acá? */
export const isSelectable = (
  locale: Locale,
  dev: boolean = import.meta.env?.DEV === true,
): boolean =>
  dev || LOCALES.some((entry) => entry.code === locale && entry.ready)

/**
 * El texto de una clave en un idioma, con los huecos `{nombre}` llenos. Lo que
 * el idioma no tiene traducido cae al español, así una traducción a medias
 * nunca deja una clave pelada en pantalla.
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const text = DICTIONARIES[locale][key] ?? es[key]
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (hole, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : hole,
  )
}

/** Qué claves le faltan a un idioma: lo usa la prueba que mide la cobertura. */
export const missingKeys = (locale: Locale): MessageKey[] =>
  (Object.keys(es) as MessageKey[]).filter(
    (key) => DICTIONARIES[locale][key] === undefined,
  )
