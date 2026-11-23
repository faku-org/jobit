/**
 * Cómo se ve y cómo se mueve la app en este dispositivo: escala, movimiento,
 * contraste y subrayado de enlaces. Es del dispositivo, igual que el tema: vive
 * en `jobit.prefs.v1`, no entra en `SyncedState` ni viaja a la API.
 *
 * Todo se aplica como atributos de `<html>` (`data-scale`, `data-motion`,
 * `data-contrast`, `data-links`) y el CSS de `index.css` hace el resto, así que
 * ningún componente tiene que enterarse. El script de `index.html` pone los
 * mismos atributos antes del primer pintado.
 */

import { DEFAULT_LOCALE, type Locale, isLocale } from './i18n.ts'

export const SCALES = [90, 100, 115, 130] as const
export type Scale = (typeof SCALES)[number]

export interface Display {
  /** Tamaño de texto y de interfaz, en porcentaje. */
  scale: Scale
  /** Quita el movimiento aunque el sistema no lo pida. */
  reduceMotion: boolean
  /** Más contraste en texto, bordes y enlaces. */
  highContrast: boolean
  /** Subraya todos los enlaces, no solo los que están dentro de un párrafo. */
  underlineLinks: boolean
  /** El idioma de la interfaz (`lib/i18n.ts`). Es del dispositivo, como el
   * tema: no viaja a la cuenta. */
  locale: Locale
}

export const DEFAULT_DISPLAY: Display = {
  scale: 100,
  reduceMotion: false,
  highContrast: false,
  underlineLinks: false,
  locale: DEFAULT_LOCALE,
}

export const isScale = (value: unknown): value is Scale =>
  SCALES.some((scale) => scale === value)

/** Lo que haya guardado, recortado: un valor inventado vuelve al de fábrica. */
export function readDisplay(value: unknown): Display {
  if (typeof value !== 'object' || value === null) return DEFAULT_DISPLAY
  const raw = value as Record<string, unknown>

  return {
    scale: isScale(raw.scale) ? raw.scale : DEFAULT_DISPLAY.scale,
    reduceMotion: raw.reduceMotion === true,
    highContrast: raw.highContrast === true,
    underlineLinks: raw.underlineLinks === true,
    locale: isLocale(raw.locale) ? raw.locale : DEFAULT_LOCALE,
  }
}

/** Lo que el sistema operativo ya pidió, aparte de lo que eligió la persona. */
export interface SystemDisplay {
  reduceMotion: boolean
  highContrast: boolean
}

/** Los atributos de `<html>` que dejan al CSS hacer su parte. Un atributo
 * ausente es el estado de fábrica. */
export function displayAttributes(
  display: Omit<Display, 'locale'>,
  system: SystemDisplay,
): Record<'scale' | 'motion' | 'contrast' | 'links', string | null> {
  return {
    scale: display.scale === 100 ? null : String(display.scale),
    motion: display.reduceMotion || system.reduceMotion ? 'reduce' : null,
    contrast: display.highContrast || system.highContrast ? 'more' : null,
    links: display.underlineLinks ? 'underline' : null,
  }
}

export const MOTION_QUERY = '(prefers-reduced-motion: reduce)'
export const CONTRAST_QUERY = '(prefers-contrast: more)'

/** ¿Hay que quitar el movimiento? Lo que ya decidió el CSS (`data-motion`) y,
 * si el hook todavía no corrió, lo que pide el sistema. */
export function motionReduced(): boolean {
  if (typeof document === 'undefined') return false
  return (
    document.documentElement.dataset.motion === 'reduce' ||
    window.matchMedia(MOTION_QUERY).matches
  )
}
