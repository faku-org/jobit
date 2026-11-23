import { describe, expect, test } from 'bun:test'
import { CATEGORIES } from '@jobit/worker/categories'
import {
  type Answer,
  type Answers,
  ITEMS,
  ITEM_COUNT,
  PAGE_COUNT,
  RUBRO_WEIGHTS,
  TRAITS,
  type TraitKey,
  answeredCount,
  firstOpenPage,
  isComplete,
  levelOf,
  pageItems,
  parseStored,
  scoreOf,
  scoreTest,
  standouts,
  suggestRubros,
} from './selfTest.ts'

/** Todas las respuestas iguales, o decididas por ítem. */
const answersWith = (
  pick: number | ((item: (typeof ITEMS)[number]) => number),
) =>
  Object.fromEntries(
    ITEMS.map((entry) => [
      entry.id,
      (typeof pick === 'number' ? pick : pick(entry)) as Answer,
    ]),
  ) as Answers

/** Responde como alguien que "se parece" al polo alto de los rasgos pedidos. */
const profile = (high: TraitKey[]): Answers =>
  answersWith((entry) => {
    const wantsHigh = high.includes(entry.trait)
    return wantsHigh === entry.reversed ? 1 : 5
  })

const percentOf = (answers: Answers, key: TraitKey): number =>
  scoreTest(answers)?.find((score) => score.key === key)?.percent ?? -1

describe('los ítems', () => {
  test('son 50, diez por rasgo, en cinco partes de diez', () => {
    expect(ITEM_COUNT).toBe(50)
    expect(PAGE_COUNT).toBe(5)
    for (const trait of TRAITS) {
      expect(ITEMS.filter((entry) => entry.trait === trait.key)).toHaveLength(
        10,
      )
    }
    for (let page = 0; page < PAGE_COUNT; page += 1) {
      expect(pageItems(page)).toHaveLength(10)
    }
  })

  test('los ids no se repiten y las frases tampoco', () => {
    expect(new Set(ITEMS.map((entry) => entry.id)).size).toBe(50)
    expect(new Set(ITEMS.map((entry) => entry.text)).size).toBe(50)
  })

  test('cada rasgo mezcla frases directas e invertidas', () => {
    for (const trait of TRAITS) {
      const own = ITEMS.filter((entry) => entry.trait === trait.key)
      const reversed = own.filter((entry) => entry.reversed).length
      expect(reversed).toBeGreaterThan(0)
      expect(reversed).toBeLessThan(own.length)
    }
  })

  test('el IPIP-50 tiene 24 frases invertidas en total', () => {
    /* Extroversión 5, amabilidad 4, responsabilidad 4, apertura 3 y, en la
       estabilidad (neuroticismo invertido), las 8 que apuntan al malestar. */
    const reversedBy = (key: TraitKey) =>
      ITEMS.filter((entry) => entry.trait === key && entry.reversed).length

    expect(reversedBy('extroversion')).toBe(5)
    expect(reversedBy('amabilidad')).toBe(4)
    expect(reversedBy('responsabilidad')).toBe(4)
    expect(reversedBy('apertura')).toBe(3)
    expect(reversedBy('estabilidad')).toBe(8)
  })
})

describe('scoreOf', () => {
  const direct = ITEMS.find((entry) => !entry.reversed)!
  const reversed = ITEMS.find((entry) => entry.reversed)!

  test('una frase directa suma lo que se contestó', () => {
    expect(scoreOf(direct, 1)).toBe(1)
    expect(scoreOf(direct, 5)).toBe(5)
  })

  test('una invertida cruza el 1 con el 5 y deja el 3 donde está', () => {
    expect(scoreOf(reversed, 1)).toBe(5)
    expect(scoreOf(reversed, 2)).toBe(4)
    expect(scoreOf(reversed, 3)).toBe(3)
    expect(scoreOf(reversed, 5)).toBe(1)
  })
})

describe('scoreTest', () => {
  test('con una respuesta sin contestar no hay resultado', () => {
    const answers = answersWith(3)
    delete answers.e1

    expect(isComplete(answers)).toBe(false)
    expect(scoreTest(answers)).toBeNull()
  })

  test('responder todo 3 da el medio exacto en los cinco rasgos', () => {
    const scores = scoreTest(answersWith(3))

    expect(scores).toHaveLength(5)
    for (const score of scores ?? []) {
      expect(score.percent).toBe(50)
      expect(score.level).toBe('mid')
    }
  })

  test('estar de acuerdo con todo NO da el máximo: las invertidas restan', () => {
    const scores = scoreTest(answersWith(5)) ?? []
    const byKey = Object.fromEntries(scores.map((s) => [s.key, s.percent]))

    /* Extroversión: 5 directas en 5 + 5 invertidas en 1 = 30 de 50 -> 50 %. */
    expect(byKey.extroversion).toBe(50)
    /* Estabilidad: 2 directas en 5 + 8 invertidas en 1 = 18 -> 20 %. */
    expect(byKey.estabilidad).toBe(20)
    /* Responsabilidad: 6 directas en 5 + 4 invertidas en 1 = 34 -> 60 %. */
    expect(byKey.responsabilidad).toBe(60)
    /* Amabilidad: 6 directas en 5 + 4 invertidas en 1 = 34 -> 60 %. */
    expect(byKey.amabilidad).toBe(60)
    /* Apertura: 7 directas en 5 + 3 invertidas en 1 = 38 -> 70 %. */
    expect(byKey.apertura).toBe(70)
  })

  test('el polo alto de un rasgo da 100 y el bajo da 0', () => {
    for (const trait of TRAITS) {
      expect(percentOf(profile([trait.key]), trait.key)).toBe(100)
      const others = TRAITS.filter((entry) => entry.key !== trait.key).map(
        (entry) => entry.key,
      )
      expect(percentOf(profile(others), trait.key)).toBe(0)
    }
  })

  test('un rasgo no mueve a los otros', () => {
    const answers = profile(['apertura'])

    expect(percentOf(answers, 'apertura')).toBe(100)
    expect(percentOf(answers, 'extroversion')).toBe(0)
    expect(percentOf(answers, 'estabilidad')).toBe(0)
  })

  test('un ítem a la vez: cambiar una respuesta mueve un décimo de rasgo', () => {
    const base = answersWith(3)
    const before = percentOf(base, 'extroversion')
    const after = percentOf({ ...base, e1: 5 }, 'extroversion')

    /* e1 es directa: pasar de 3 a 5 suma 2 de un rango de 40. */
    expect(after - before).toBe(5)
  })
})

describe('levelOf', () => {
  test('parte la escala en tres, con el medio ancho', () => {
    expect(levelOf(0)).toBe('low')
    expect(levelOf(39)).toBe('low')
    expect(levelOf(40)).toBe('mid')
    expect(levelOf(60)).toBe('mid')
    expect(levelOf(61)).toBe('high')
    expect(levelOf(100)).toBe('high')
  })
})

describe('avance', () => {
  test('cuenta las respondidas y ubica la primera parte con huecos', () => {
    expect(answeredCount({})).toBe(0)
    expect(firstOpenPage({})).toBe(0)

    const firstTwoPages = Object.fromEntries(
      ITEMS.slice(0, 20).map((entry) => [entry.id, 3 as Answer]),
    ) as Answers
    expect(answeredCount(firstTwoPages)).toBe(20)
    expect(firstOpenPage(firstTwoPages)).toBe(2)
  })

  test('con todo respondido queda en la última parte', () => {
    expect(firstOpenPage(answersWith(3))).toBe(PAGE_COUNT - 1)
  })
})

describe('suggestRubros', () => {
  const slugsOf = (answers: Answers): string[] =>
    suggestRubros(scoreTest(answers) ?? []).map((entry) => entry.slug)

  test('todos los rubros del mapa existen en el tablero', () => {
    const known = new Set(CATEGORIES.map((category) => category.slug))

    for (const slug of Object.keys(RUBRO_WEIGHTS)) {
      expect(known.has(slug)).toBe(true)
    }
  })

  test('el medio exacto no sugiere nada: no hay un perfil que leer', () => {
    expect(slugsOf(answersWith(3))).toEqual([])
  })

  test('mucha apertura empuja tecnología y diseño', () => {
    const slugs = slugsOf(profile(['apertura']))

    expect(slugs).toContain('diseno')
    expect(slugs).toContain('tecnologia')
  })

  test('mucha amabilidad empuja salud, atención al cliente y RR. HH.', () => {
    const slugs = slugsOf(profile(['amabilidad', 'estabilidad']))

    expect(slugs).toContain('salud')
    expect(slugs).toContain('atencion-cliente')
    expect(slugs).toContain('rrhh')
  })

  test('mucha responsabilidad empuja administración y contabilidad', () => {
    const slugs = slugsOf(profile(['responsabilidad']))

    expect(slugs).toContain('administracion')
    expect(slugs).toContain('contabilidad-finanzas')
  })

  test('devuelve como mucho el límite, de mayor a menor afinidad', () => {
    const all = suggestRubros(
      scoreTest(profile(TRAITS.map((trait) => trait.key))) ?? [],
      3,
    )

    expect(all).toHaveLength(3)
    for (let index = 1; index < all.length; index += 1) {
      expect(all[index - 1]!.affinity).toBeGreaterThanOrEqual(
        all[index]!.affinity,
      )
    }
  })
})

describe('standouts', () => {
  test('elige los dos rasgos más lejos del medio', () => {
    const scores = scoreTest(profile(['apertura', 'responsabilidad'])) ?? []
    const keys = standouts(scores).map((score) => score.key)

    expect(keys).toHaveLength(2)
    /* Los cinco quedan a 0 o a 100: los dos primeros por orden estable. */
    for (const score of standouts(scores)) {
      expect(Math.abs(score.percent - 50)).toBe(50)
    }
  })
})

describe('parseStored', () => {
  test('sin nada guardado, vacío', () => {
    expect(parseStored(null)).toEqual({ answers: {}, reported: false })
  })

  test('un JSON roto o de otro tipo no rompe: vacío', () => {
    expect(parseStored('{no es json')).toEqual({ answers: {}, reported: false })
    expect(parseStored('42')).toEqual({ answers: {}, reported: false })
    expect(parseStored('null')).toEqual({ answers: {}, reported: false })
  })

  test('descarta ítems que no existen y valores fuera del 1 al 5', () => {
    const stored = parseStored(
      JSON.stringify({
        answers: { e1: 4, n1: 9, a1: 'cinco', zz: 3, c1: 0, o1: 2.5, e2: 1 },
        reported: true,
      }),
    )

    expect(stored.answers).toEqual({ e1: 4, e2: 1 })
    expect(stored.reported).toBe(true)
  })

  test('lo que se guarda vuelve igual', () => {
    const answers = answersWith(4)
    const back = parseStored(JSON.stringify({ answers, reported: false }))

    expect(back.answers).toEqual(answers)
  })
})
