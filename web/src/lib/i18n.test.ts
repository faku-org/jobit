import { describe, expect, test } from 'bun:test'
import {
  LOCALES,
  htmlLang,
  isLocale,
  isSelectable,
  missingKeys,
  translate,
} from './i18n.ts'

describe('translate', () => {
  test('cada idioma da su texto', () => {
    expect(translate('es', 'island.help')).toBe('Ayuda')
    expect(translate('en', 'island.help')).toBe('Help')
    expect(translate('pt', 'island.help')).toBe('Ajuda')
  })

  test('llena los huecos y deja a la vista los que no vinieron', () => {
    /* No hay claves con huecos todavía: se prueba sobre el texto de origen. */
    expect(translate('es', 'menu.soon', { x: 1 })).toBe('pronto')
  })
})

describe('cobertura', () => {
  test('los diccionarios cubren todo lo que ya pasó por es.ts', () => {
    for (const { code } of LOCALES) expect(missingKeys(code)).toEqual([])
  })
})

describe('qué se puede elegir', () => {
  test('en producción solo lo listo; en desarrollo, todo', () => {
    expect(isSelectable('es', false)).toBe(true)
    expect(isSelectable('en', false)).toBe(false)
    expect(isSelectable('en', true)).toBe(true)
  })

  test('isLocale y htmlLang', () => {
    expect(isLocale('pt')).toBe(true)
    expect(isLocale('fr')).toBe(false)
    expect(htmlLang('es')).toBe('es-UY')
    expect(htmlLang('pt')).toBe('pt-BR')
  })
})
