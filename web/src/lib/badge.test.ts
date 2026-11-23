import { describe, expect, test } from 'bun:test'
import {
  BADGE_FILE_NAME,
  BADGE_HEIGHT,
  BADGE_WIDTH,
  type ShareEnv,
  badgeModel,
  drawBadge,
  shareBadge,
} from './badge.ts'
import { TRAITS, type TraitScore, levelOf } from './selfTest.ts'

const scoresOf = (percents: number[]): TraitScore[] =>
  TRAITS.map((trait, index) => {
    const percent = percents[index] ?? 50
    return { key: trait.key, percent, level: levelOf(percent) }
  })

describe('badgeModel', () => {
  test('toma el rasgo más alto y lo describe', () => {
    const model = badgeModel(scoresOf([40, 55, 90, 30, 70]))
    expect(model?.top.key).toBe('responsabilidad')
    expect(model?.traitLabel).toBe('Responsabilidad')
    expect(model?.phrase).toBe('Más cerca de Método')
    expect(model?.alt).toContain('Responsabilidad, 90 de 100')
  })

  test('si empatan gana el primero del orden del test', () => {
    expect(badgeModel(scoresOf([80, 80, 80, 80, 80]))?.top.key).toBe(
      'extroversion',
    )
  })

  test('un rasgo alto pero en el medio no se vende como extremo', () => {
    expect(badgeModel(scoresOf([50, 50, 55, 50, 50]))?.phrase).toBe(
      'En el medio',
    )
  })

  test('sin puntajes no hay badge', () => {
    expect(badgeModel([])).toBeNull()
  })
})

/** Un contexto que anota lo que se dibuja, sin canvas real. */
function recordingContext() {
  const texts: string[] = []
  const props: Record<string, unknown> = {}
  const context = new Proxy(props, {
    get(_, name: string) {
      if (name === 'fillText') return (text: string) => void texts.push(text)
      if (name === 'measureText') {
        return (text: string) => ({ width: text.length * 10 })
      }
      if (name === 'createLinearGradient' || name === 'createRadialGradient') {
        return () => ({ addColorStop: () => {} })
      }
      return name in props ? props[name] : () => {}
    },
    set(_, name: string, value) {
      props[name] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { context, texts }
}

describe('drawBadge', () => {
  test('escribe la marca, el rasgo, los cinco rótulos y el aviso', () => {
    const model = badgeModel(scoresOf([40, 55, 90, 30, 70]))
    if (!model) throw new Error('sin modelo')
    const { context, texts } = recordingContext()
    drawBadge(context, model)

    expect(texts).toContain('JobIt')
    expect(texts).toContain('Responsabilidad')
    for (const label of [
      'Extroversión',
      'Amabilidad',
      'Estabilidad',
      'Apertura',
    ]) {
      expect(texts).toContain(label)
    }
    expect(texts.some((text) => text.includes('No es un psicotécnico'))).toBe(
      true,
    )
  })

  test('el formato es vertical, listo para historias y chats', () => {
    expect(BADGE_HEIGHT).toBeGreaterThan(BADGE_WIDTH)
  })
})

function fakeEnv(overrides: Partial<ShareEnv> = {}) {
  const calls: string[] = []
  const env: ShareEnv = {
    canShareFile: () => true,
    share: async () => void calls.push('share'),
    copyImage: async () => void calls.push('copy'),
    download: () => void calls.push('download'),
    ...overrides,
  }
  return { env, calls }
}

const blob = new Blob(['png'], { type: 'image/png' })

describe('shareBadge', () => {
  test('con soporte de archivos usa el menú del sistema y nada más', async () => {
    const names: string[] = []
    const { env, calls } = fakeEnv({
      share: async (data) => {
        names.push(...data.files.map((file) => file.name))
      },
    })
    expect(await shareBadge(blob, 'texto', env)).toBe('shared')
    expect(calls).toEqual([])
    expect(names).toEqual([BADGE_FILE_NAME])
  })

  test('cerrar el menú no cae a las alternativas', async () => {
    const { env, calls } = fakeEnv({
      share: async () => {
        throw new DOMException('cancelado', 'AbortError')
      },
    })
    expect(await shareBadge(blob, 'texto', env)).toBe('cancelled')
    expect(calls).toEqual([])
  })

  test('sin compartir archivos copia la imagen', async () => {
    const { env, calls } = fakeEnv({ canShareFile: () => false })
    expect(await shareBadge(blob, 'texto', env)).toBe('copied')
    expect(calls).toEqual(['copy'])
  })

  test('sin portapapeles descarga', async () => {
    const { env, calls } = fakeEnv({
      canShareFile: () => false,
      copyImage: async () => {
        throw new Error('no hay')
      },
    })
    expect(await shareBadge(blob, 'texto', env)).toBe('downloaded')
    expect(calls).toEqual(['download'])
  })

  test('un fallo raro al compartir pasa a copiar en vez de perderse', async () => {
    const { env, calls } = fakeEnv({
      share: async () => {
        throw new Error('NotAllowedError')
      },
    })
    expect(await shareBadge(blob, 'texto', env)).toBe('copied')
    expect(calls).toEqual(['copy'])
  })
})
