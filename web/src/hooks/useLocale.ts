import { useSyncExternalStore } from 'react'
import {
  DEFAULT_LOCALE,
  type Locale,
  type MessageKey,
  isLocale,
  translate,
} from '../lib/i18n.ts'

/** `useDisplay` escribe el idioma en `<html data-locale>`; esto lo lee. */
const readLocale = (): Locale => {
  if (typeof document === 'undefined') return DEFAULT_LOCALE
  const value = document.documentElement.dataset.locale
  return isLocale(value) ? value : DEFAULT_LOCALE
}

const subscribe = (notify: () => void): (() => void) => {
  const observer = new MutationObserver(notify)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-locale'],
  })
  return () => observer.disconnect()
}

/** El idioma de la interfaz, sin pasarlo por props: cambia cuando cambia
 * Preferencias, igual que `useMotionReduced`. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, readLocale, () => DEFAULT_LOCALE)
}

/** La función para traducir en el idioma actual. */
export function useT(): (
  key: MessageKey,
  params?: Record<string, string | number>,
) => string {
  const locale = useLocale()
  return (key, params) => translate(locale, key, params)
}
