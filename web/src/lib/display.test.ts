import { describe, expect, test } from 'bun:test'
import { Glob } from 'bun'
import {
  DEFAULT_DISPLAY,
  displayAttributes,
  isScale,
  readDisplay,
} from './display.ts'

const calm = { reduceMotion: false, highContrast: false }

describe('readDisplay', () => {
  test('lo que falta o no es un objeto vuelve al de fábrica', () => {
    expect(readDisplay(undefined)).toEqual(DEFAULT_DISPLAY)
    expect(readDisplay(null)).toEqual(DEFAULT_DISPLAY)
    expect(readDisplay('130')).toEqual(DEFAULT_DISPLAY)
  })

  test('conserva lo válido', () => {
    expect(
      readDisplay({
        scale: 130,
        reduceMotion: true,
        highContrast: true,
        underlineLinks: true,
        locale: 'pt',
      }),
    ).toEqual({
      scale: 130,
      reduceMotion: true,
      highContrast: true,
      underlineLinks: true,
      locale: 'pt',
    })
  })

  test('un idioma que no existe vuelve al español', () => {
    expect(readDisplay({ locale: 'fr' }).locale).toBe('es')
    expect(readDisplay({}).locale).toBe('es')
  })

  test('una escala inventada no pasa, y un booleano tiene que ser true', () => {
    expect(readDisplay({ scale: 250 }).scale).toBe(100)
    expect(readDisplay({ scale: '115' }).scale).toBe(100)
    expect(readDisplay({ reduceMotion: 'true' }).reduceMotion).toBe(false)
    expect(readDisplay({ highContrast: 1 }).highContrast).toBe(false)
  })

  test('isScale solo acepta las escalas ofrecidas', () => {
    expect([90, 100, 115, 130].every(isScale)).toBe(true)
    expect(isScale(110)).toBe(false)
  })
})

describe('displayAttributes', () => {
  test('el estado de fábrica no escribe ningún atributo', () => {
    expect(displayAttributes(DEFAULT_DISPLAY, calm)).toEqual({
      scale: null,
      motion: null,
      contrast: null,
      links: null,
    })
  })

  test('la escala se escribe salvo la de 100', () => {
    expect(
      displayAttributes({ ...DEFAULT_DISPLAY, scale: 115 }, calm).scale,
    ).toBe('115')
    expect(
      displayAttributes({ ...DEFAULT_DISPLAY, scale: 100 }, calm).scale,
    ).toBe(null)
  })

  test('la elección suma a lo que pide el sistema, nunca lo quita', () => {
    const system = { reduceMotion: true, highContrast: true }
    const off = displayAttributes(DEFAULT_DISPLAY, system)
    expect(off.motion).toBe('reduce')
    expect(off.contrast).toBe('more')

    const on = displayAttributes(
      { ...DEFAULT_DISPLAY, reduceMotion: true, highContrast: true },
      calm,
    )
    expect(on.motion).toBe('reduce')
    expect(on.contrast).toBe('more')
  })

  test('subrayar enlaces es solo cosa de la persona', () => {
    expect(
      displayAttributes({ ...DEFAULT_DISPLAY, underlineLinks: true }, calm)
        .links,
    ).toBe('underline')
  })
})

describe('texto en rem', () => {
  /* La escala cambia el tamaño de letra de `<html>`: un `text-[13px]` no la
     seguiría y quedaría chico en el 130 %. Admin y empresas son otras
     páginas, con su propia hoja. */
  test('ningún componente de la app fija el texto en px', async () => {
    const offenders: string[] = []
    const glob = new Glob('**/*.tsx')
    for await (const scanned of glob.scan({ cwd: `${import.meta.dir}/..` })) {
      const file = scanned.replaceAll('\\', '/')
      if (/^(admin|empresas)\//.test(file)) continue
      const text = await Bun.file(`${import.meta.dir}/../${file}`).text()
      if (/text-\[\d+(\.\d+)?px\]/.test(text)) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })
})
