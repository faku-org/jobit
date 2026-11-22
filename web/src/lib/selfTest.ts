/**
 * Test de autoconocimiento laboral: los cinco grandes rasgos de personalidad
 * (Big Five) medidos con el IPIP-50 de Goldberg.
 *
 * Los ítems del IPIP (International Personality Item Pool, ipip.ori.org) son de
 * dominio público: se pueden usar, traducir y adaptar sin permiso. Esta
 * traducción es propia, en español neutro y sin adjetivos con género, para que
 * la frase sirva igual a cualquiera.
 *
 * Todo lo de este módulo corre en el navegador. Las respuestas no tienen
 * ningún camino hacia la API: lo único que sale, si la persona tiene prendida la
 * casilla de estadísticas, es el aviso de "test completado" sin contenido.
 */

export type TraitKey =
  | 'extroversion'
  | 'amabilidad'
  | 'responsabilidad'
  | 'estabilidad'
  | 'apertura'

/** 1 a 5: qué tanto describe la frase a quien responde. */
export type Answer = 1 | 2 | 3 | 4 | 5

export const ANSWER_SCALE: { value: Answer; label: string }[] = [
  { value: 1, label: 'Nada' },
  { value: 2, label: 'Poco' },
  { value: 3, label: 'Más o menos' },
  { value: 4, label: 'Bastante' },
  { value: 5, label: 'Del todo' },
]

export interface Item {
  id: string
  trait: TraitKey
  text: string
  /** Las frases invertidas puntúan al revés: estar de acuerdo baja el rasgo. */
  reversed: boolean
}

/**
 * La estabilidad emocional es el polo opuesto del neuroticismo del IPIP-50.
 * Las frases siguen siendo las de Goldberg; lo que cambia es el signo con el que
 * suman, así los cinco rasgos se leen igual: más puntos, más de lo que dice el
 * nombre.
 */
const item = (
  id: string,
  trait: TraitKey,
  text: string,
  reversed = false,
): Item => ({ id, trait, text, reversed })

/**
 * El orden es el del cuestionario: un ítem de cada rasgo por vez, para que no
 * se sienta como diez preguntas seguidas sobre lo mismo.
 */
export const ITEMS: Item[] = [
  item('e1', 'extroversion', 'Soy el alma de la fiesta.'),
  item('n1', 'estabilidad', 'Me estreso con facilidad.', true),
  item('a1', 'amabilidad', 'Me preocupo poco por los demás.', true),
  item('c1', 'responsabilidad', 'Siempre llego con todo preparado.'),
  item('o1', 'apertura', 'Tengo un vocabulario amplio.'),

  item('e2', 'extroversion', 'No soy de hablar mucho.', true),
  item('n2', 'estabilidad', 'Casi siempre me siento en calma.'),
  item('a2', 'amabilidad', 'Me interesan las personas.'),
  item(
    'c2',
    'responsabilidad',
    'Dejo mis cosas tiradas por cualquier lado.',
    true,
  ),
  item('o2', 'apertura', 'Me cuesta entender ideas abstractas.', true),

  item('e3', 'extroversion', 'Me siento a gusto entre la gente.'),
  item('n3', 'estabilidad', 'Me preocupo por las cosas.', true),
  item('a3', 'amabilidad', 'Digo cosas que ofenden a las personas.', true),
  item('c3', 'responsabilidad', 'Presto atención a los detalles.'),
  item('o3', 'apertura', 'Tengo una imaginación vívida.'),

  item('e4', 'extroversion', 'Prefiero quedarme en un segundo plano.', true),
  item('n4', 'estabilidad', 'Rara vez me siento triste.'),
  item('a4', 'amabilidad', 'Me pongo en el lugar de los demás.'),
  item('c4', 'responsabilidad', 'Desordeno todo lo que toco.', true),
  item('o4', 'apertura', 'No me interesan las ideas abstractas.', true),

  item('e5', 'extroversion', 'Suelo iniciar las conversaciones.'),
  item('n5', 'estabilidad', 'Me inquieto con facilidad.', true),
  item(
    'a5',
    'amabilidad',
    'No me interesan los problemas de otras personas.',
    true,
  ),
  item('c5', 'responsabilidad', 'Hago las tareas enseguida.'),
  item('o5', 'apertura', 'Tengo muy buenas ideas.'),

  item('e6', 'extroversion', 'Tengo poco para decir.', true),
  item('n6', 'estabilidad', 'Me disgusto con facilidad.', true),
  item('a6', 'amabilidad', 'Tengo buen corazón.'),
  item(
    'c6',
    'responsabilidad',
    'Me olvido seguido de guardar las cosas en su lugar.',
    true,
  ),
  item('o6', 'apertura', 'No tengo buena imaginación.', true),

  item(
    'e7',
    'extroversion',
    'En las fiestas hablo con muchas personas distintas.',
  ),
  item('n7', 'estabilidad', 'Mi estado de ánimo cambia mucho.', true),
  item('a7', 'amabilidad', 'En realidad no me interesan los demás.', true),
  item('c7', 'responsabilidad', 'Me gusta el orden.'),
  item('o7', 'apertura', 'Entiendo las cosas rápido.'),

  item('e8', 'extroversion', 'No me gusta llamar la atención.', true),
  item('n8', 'estabilidad', 'Tengo cambios de humor frecuentes.', true),
  item('a8', 'amabilidad', 'Dedico tiempo a los demás.'),
  item('c8', 'responsabilidad', 'Esquivo mis obligaciones.', true),
  item('o8', 'apertura', 'Uso palabras difíciles.'),

  item('e9', 'extroversion', 'No me molesta ser el centro de atención.'),
  item('n9', 'estabilidad', 'Me irrito con facilidad.', true),
  item('a9', 'amabilidad', 'Percibo lo que sienten los demás.'),
  item('c9', 'responsabilidad', 'Sigo un horario.'),
  item('o9', 'apertura', 'Me tomo tiempo para reflexionar sobre las cosas.'),

  item(
    'e10',
    'extroversion',
    'Me quedo en silencio frente a personas desconocidas.',
    true,
  ),
  item('n10', 'estabilidad', 'A menudo me siento triste.', true),
  item('a10', 'amabilidad', 'Hago que la gente se sienta cómoda.'),
  item('c10', 'responsabilidad', 'Soy exigente con mi trabajo.'),
  item('o10', 'apertura', 'Se me ocurren muchas ideas.'),
]

export const ITEM_COUNT = ITEMS.length

/** Cuántas frases por pantalla. Diez es una parte: cinco partes en total. */
export const PAGE_SIZE = 10
export const PAGE_COUNT = Math.ceil(ITEM_COUNT / PAGE_SIZE)

export const pageItems = (page: number): Item[] =>
  ITEMS.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

export type Answers = Record<string, Answer>

export const TRAITS: {
  key: TraitKey
  label: string
  /** Los dos extremos de la escala, para que "bajo" no suene a "malo". */
  low: string
  high: string
}[] = [
  {
    key: 'extroversion',
    label: 'Extroversión',
    low: 'Reserva',
    high: 'Sociabilidad',
  },
  {
    key: 'amabilidad',
    label: 'Amabilidad',
    low: 'Franqueza',
    high: 'Cooperación',
  },
  {
    key: 'responsabilidad',
    label: 'Responsabilidad',
    low: 'Flexibilidad',
    high: 'Método',
  },
  {
    key: 'estabilidad',
    label: 'Estabilidad emocional',
    low: 'Sensibilidad',
    high: 'Serenidad',
  },
  {
    key: 'apertura',
    label: 'Apertura a lo nuevo',
    low: 'Practicidad',
    high: 'Curiosidad',
  },
]

const PER_TRAIT = ITEMS.filter((entry) => entry.trait === 'apertura').length
const MIN_SUM = PER_TRAIT
const MAX_SUM = PER_TRAIT * 5

/** El puntaje de un ítem, con la inversión aplicada: 1 y 5 se cruzan. */
export const scoreOf = (entry: Item, answer: Answer): number =>
  entry.reversed ? 6 - answer : answer

export const answeredCount = (answers: Answers): number =>
  ITEMS.filter((entry) => answers[entry.id] !== undefined).length

export const isComplete = (answers: Answers): boolean =>
  answeredCount(answers) === ITEM_COUNT

/** La primera parte con alguna frase sin responder, o la última si no queda. */
export function firstOpenPage(answers: Answers): number {
  const page = Array.from({ length: PAGE_COUNT }, (_, index) => index).find(
    (index) =>
      pageItems(index).some((entry) => answers[entry.id] === undefined),
  )
  return page ?? PAGE_COUNT - 1
}

export type Level = 'low' | 'mid' | 'high'

export interface TraitScore {
  key: TraitKey
  /** 0 a 100: 0 es la suma mínima posible del rasgo, 100 la máxima. */
  percent: number
  level: Level
}

/** Sin baremo: no hay con quién compararse, así que los cortes son de la
 * escala misma (un tercio, un tercio, un tercio) y no de una población. */
export function levelOf(percent: number): Level {
  if (percent < 40) return 'low'
  if (percent > 60) return 'high'
  return 'mid'
}

/**
 * Puntaje de los cinco rasgos. Devuelve `null` si falta alguna respuesta: un
 * resultado a medias sería una lectura inventada.
 */
export function scoreTest(answers: Answers): TraitScore[] | null {
  if (!isComplete(answers)) return null

  return TRAITS.map(({ key }) => {
    const sum = ITEMS.filter((entry) => entry.trait === key).reduce(
      (total, entry) => {
        const answer = answers[entry.id]
        return total + (answer === undefined ? 0 : scoreOf(entry, answer))
      },
      0,
    )
    const percent = Math.round(((sum - MIN_SUM) / (MAX_SUM - MIN_SUM)) * 100)
    return { key, percent, level: levelOf(percent) }
  })
}

/**
 * La lectura de cada rasgo, en lenguaje de todos los días y hablando de cómo
 * trabajar, no de quién es la persona. Ninguno de los tres niveles es mejor que
 * otro: cada uno encaja en cosas distintas.
 */
export const READING: Record<TraitKey, Record<Level, string>> = {
  extroversion: {
    low: 'Rendís mejor con calma y de a pocos. Te cuesta menos trabajar solo o con un grupo chico, y la entrevista suele pedirte un poco más de energía de la que ponés a diario.',
    mid: 'Te movés bien tanto con gente como a solas. Podés adaptarte a un trabajo de mucho trato o a uno más tranquilo sin que te pese.',
    high: 'Ganás energía con el trato con otras personas. Te resulta natural hablar, presentarte y tomar la iniciativa en un equipo.',
  },
  amabilidad: {
    low: 'Decís las cosas como son y ponés el resultado por delante. Sirve donde hay que decidir, negociar o marcar un límite; conviene cuidar el tono con el equipo.',
    mid: 'Sabés ceder cuando hace falta y también defender tu postura. Tenés un punto medio entre colaborar y marcar tu opinión.',
    high: 'Te importa cómo está la gente y tendés a colaborar y ayudar. Es una ventaja donde hay que cuidar, escuchar o sostener un buen clima de trabajo.',
  },
  responsabilidad: {
    low: 'Te manejás con flexibilidad y te adaptás rápido a los cambios. Te cuesta más sostener rutinas y papeles muy estrictos; ayudan las listas y los recordatorios.',
    mid: 'Combinás orden con margen para improvisar. Cumplís con lo importante sin necesitar que todo esté planificado al detalle.',
    high: 'Tendés al método: planificás, cumplís con los plazos y cuidás los detalles. Los trabajos con procedimientos claros y que piden constancia te van a resultar naturales.',
  },
  estabilidad: {
    low: 'Sentís las cosas con intensidad y los imprevistos te mueven. Eso también te vuelve atento a lo que puede salir mal; ayuda elegir ambientes con apoyo y ritmos previsibles.',
    mid: 'Llevás bien la presión del día a día, aunque hay situaciones que te pesan más que otras. Es una base pareja para casi cualquier trabajo.',
    high: 'Mantenés la calma bajo presión y te recuperás rápido de un mal día. Es útil en trabajos con apuro, reclamos o mucha incertidumbre.',
  },
  apertura: {
    low: 'Preferís lo conocido y lo concreto: lo que ya se probó y funciona. Rendís bien donde hay que hacer las cosas con método y sin vueltas.',
    mid: 'Te interesan las ideas nuevas sin dejar de lado lo práctico. Podés aprender algo distinto o seguir un procedimiento, según lo que pida el trabajo.',
    high: 'Te atrae aprender, imaginar y probar formas distintas de hacer las cosas. Te vas a aburrir antes en un trabajo siempre igual que en uno que cambia.',
  },
}

/**
 * Cuánto pesa cada rasgo en cada rubro, de 0 a 1. Son orientaciones de sentido
 * común sobre qué rasgos ayudan en el día a día de un trabajo, no una tabla de
 * selección: dicen "suele encajar", nunca "sirve" o "no sirve".
 *
 * Los slugs son los de los rubros del tablero. Un rubro sin entrada acá (como
 * "otros") no se sugiere nunca.
 */
export const RUBRO_WEIGHTS: Record<
  string,
  Partial<Record<TraitKey, number>>
> = {
  ventas: { extroversion: 1, amabilidad: 0.5, estabilidad: 0.5 },
  'atencion-cliente': { amabilidad: 1, estabilidad: 0.7, extroversion: 0.5 },
  administracion: { responsabilidad: 1, amabilidad: 0.3 },
  oficios: { responsabilidad: 0.8, estabilidad: 0.4, amabilidad: 0.2 },
  produccion: { responsabilidad: 1, estabilidad: 0.5 },
  logistica: { responsabilidad: 1, estabilidad: 0.4 },
  'contabilidad-finanzas': {
    responsabilidad: 1,
    estabilidad: 0.3,
    apertura: 0.2,
  },
  tecnologia: { apertura: 1, responsabilidad: 0.5 },
  'datos-analisis': { apertura: 0.7, responsabilidad: 0.7 },
  salud: { amabilidad: 1, estabilidad: 0.6, responsabilidad: 0.5 },
  ingenieria: { responsabilidad: 0.6, apertura: 0.7 },
  marketing: { apertura: 0.7, extroversion: 0.7 },
  rrhh: { amabilidad: 1, extroversion: 0.5, estabilidad: 0.3 },
  educacion: { amabilidad: 0.7, extroversion: 0.5, apertura: 0.5 },
  diseno: { apertura: 1, extroversion: 0.1 },
}

export interface RubroSuggestion {
  slug: string
  /** De 0 a 100, solo para ordenar; no se muestra como número. */
  affinity: number
}

/**
 * Los rubros que más se parecen al perfil: la media de los rasgos del rubro,
 * cada uno medido contra el punto medio de la escala y ponderado por su peso.
 * Solo se sugiere lo que queda por encima del medio.
 */
export function suggestRubros(
  scores: TraitScore[],
  limit = 4,
): RubroSuggestion[] {
  const byKey = new Map(scores.map((score) => [score.key, score.percent]))

  return Object.entries(RUBRO_WEIGHTS)
    .map(([slug, weights]) => {
      let weighted = 0
      let total = 0
      for (const [key, weight] of Object.entries(weights)) {
        const percent = byKey.get(key as TraitKey) ?? 50
        weighted += weight * percent
        total += weight
      }
      return { slug, affinity: total === 0 ? 0 : Math.round(weighted / total) }
    })
    .filter((entry) => entry.affinity > 50)
    .sort(
      (first, second) =>
        second.affinity - first.affinity ||
        first.slug.localeCompare(second.slug),
    )
    .slice(0, limit)
}

/** Los dos rasgos que más se alejan del medio, para abrir la lectura por ahí. */
export function standouts(scores: TraitScore[]): TraitScore[] {
  return [...scores]
    .sort(
      (first, second) =>
        Math.abs(second.percent - 50) - Math.abs(first.percent - 50),
    )
    .slice(0, 2)
}

/* ---------------------------------------------------------------------------
 * Guardado en el dispositivo
 * ------------------------------------------------------------------------ */

export const SELF_TEST_KEY = 'jobit.selftest.v1'

export interface StoredTest {
  answers: Answers
  /** Si ya se avisó el "completado" de esta tanda, para no contarlo dos veces. */
  reported: boolean
}

export const EMPTY_TEST: StoredTest = { answers: {}, reported: false }

const isAnswer = (value: unknown): value is Answer =>
  value === 1 || value === 2 || value === 3 || value === 4 || value === 5

/**
 * Lee lo guardado sin confiar en él: el storage es de la persona y puede
 * traer cualquier cosa, de una versión vieja a un JSON editado a mano. Solo
 * pasan las respuestas a ítems que existen y valores del 1 al 5.
 */
export function parseStored(raw: string | null): StoredTest {
  if (raw === null) return EMPTY_TEST
  try {
    const data: unknown = JSON.parse(raw)
    if (typeof data !== 'object' || data === null) return EMPTY_TEST
    const record = data as Record<string, unknown>
    const source =
      typeof record.answers === 'object' && record.answers !== null
        ? (record.answers as Record<string, unknown>)
        : {}

    const answers: Answers = {}
    for (const entry of ITEMS) {
      const value = source[entry.id]
      if (isAnswer(value)) answers[entry.id] = value
    }
    return { answers, reported: record.reported === true }
  } catch {
    return EMPTY_TEST
  }
}

export function readTest(): StoredTest {
  try {
    return parseStored(localStorage.getItem(SELF_TEST_KEY))
  } catch {
    /** Un navegador que no deja leer el storage empieza de cero. */
    return EMPTY_TEST
  }
}

export function writeTest(test: StoredTest): void {
  try {
    if (answeredCount(test.answers) === 0 && !test.reported) {
      localStorage.removeItem(SELF_TEST_KEY)
      return
    }
    localStorage.setItem(SELF_TEST_KEY, JSON.stringify(test))
  } catch {
    /** Sin storage el test sigue andando; solo no se puede pausar. */
  }
}

export function clearTest(): void {
  try {
    localStorage.removeItem(SELF_TEST_KEY)
  } catch {
    /** Sin storage no hay nada que borrar. */
  }
}
