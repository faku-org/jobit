import { LEVEL_LABEL, WORK_MODE_LABEL } from '@jobit/worker/labels'
import { levelFromYears } from './match.ts'
import { EDUCATION_LABEL, type Profile, meetsEducation } from './profile.ts'
import type { Resume } from './resume.ts'
import { jobSkills, ownedSkills, skillLabel } from './skills.ts'
import { type Job, type Preferences, workMode } from './types.ts'

/**
 * El recomendador: cuánto le sirve una oferta a esta persona y por qué.
 *
 * No hay caja negra. El puntaje es la suma de razones, cada una con su peso y
 * su frase en lenguaje llano; lo que se muestra en la tarjeta y en la ficha es
 * la misma lista que se sumó. Todo corre en el navegador sobre lo que la
 * persona cargó: nada de esto viaja.
 *
 * Los pesos son del mismo orden que los de `api/src/rank.ts` (que ordena todo
 * el tablero en el servidor con lo que ya viaja en la consulta), pero este
 * puntaje además conoce las habilidades y el CV, que no salen del navegador.
 */
export const WEIGHTS = {
  /** El rubro está entre los que la persona quiere. */
  category: 20,
  /** La oferta es en un departamento que la persona eligió. */
  department: 10,
  /** Modalidad que la persona prefiere. */
  mode: 6,
  /** Nivel que la persona pidió ver. */
  level: 5,
  /** Jornada que la persona prefiere. */
  jobType: 4,
  /** Cada habilidad que la oferta pide y la persona tiene. */
  skill: 8,
  /** Techo de habilidades que suman: tres coincidencias ya dicen mucho. */
  skillCap: 3,
  /** Cada habilidad que la oferta pide y la persona no tiene. */
  skillMissing: -3,
  /** Techo de lo que restan las habilidades que faltan. */
  skillMissingCap: 3,
  /** Cumple los años de experiencia que pide. */
  experience: 8,
  /** Le faltan años de experiencia respecto de lo que pide. */
  experienceShort: -10,
  /** No pide experiencia y la persona está arrancando. */
  noExperience: 8,
  /** El nivel de la oferta coincide con los años de la persona. */
  levelFit: 6,
  /** El nivel de la oferta queda lejos de los años de la persona. */
  levelFar: -6,
  /** Cumple los estudios que pide. */
  education: 5,
  /** No llega al nivel de estudios que pide. */
  educationShort: -8,
} as const

/** `plus` suma, `minus` resta: lo que falta también se dice. */
export type ReasonKind = 'plus' | 'minus'

export interface Reason {
  id: string
  kind: ReasonKind
  points: number
  text: string
}

export interface Recommendation {
  /** Suma de los puntos de las razones. Se compara, no se muestra como número. */
  score: number
  /** De la que más pesa a la que menos. */
  reasons: Reason[]
}

export const EMPTY_RECOMMENDATION: Recommendation = { score: 0, reasons: [] }

const LEVEL_RANK = { entry: 0, mid: 1, senior: 2 } as const

const years = (count: number): string =>
  count === 1 ? '1 año' : `${count} años`

const YOUR_SKILL_SOURCE = {
  cv: 'que está en tu CV',
  manual: 'que sumaste a tu perfil',
} as const

const reason = (id: string, points: number, text: string): Reason => ({
  id,
  kind: points >= 0 ? 'plus' : 'minus',
  points,
  text,
})

/** Las razones que salen de lo que la persona dijo querer. */
function preferenceReasons(job: Job, preferences: Preferences): Reason[] {
  const out: Reason[] = []
  const mode = workMode(job)

  if (preferences.categories.includes(job.category)) {
    out.push(
      reason(
        'category',
        WEIGHTS.category,
        `Es de ${job.category_label}, tu rubro`,
      ),
    )
  }
  if (job.department && preferences.departments.includes(job.department)) {
    out.push(
      reason(
        'department',
        WEIGHTS.department,
        `Es en ${job.department}, tu zona`,
      ),
    )
  }
  if (preferences.modes.includes(mode)) {
    out.push(
      reason(
        'mode',
        WEIGHTS.mode,
        `Es ${WORK_MODE_LABEL[mode].toLowerCase()}, como preferís`,
      ),
    )
  }
  if (job.level && preferences.levels.includes(job.level)) {
    out.push(
      reason(
        'level-wanted',
        WEIGHTS.level,
        `Es nivel ${LEVEL_LABEL[job.level].toLowerCase()}, el que buscás`,
      ),
    )
  }
  if (job.job_type && preferences.jobTypes.includes(job.job_type)) {
    out.push(reason('job-type', WEIGHTS.jobType, 'Es la jornada que preferís'))
  }
  return out
}

/** Experiencia y nivel: lo que la oferta pide contra los años de la persona. */
function experienceReasons(job: Job, profile: Profile): Reason[] {
  const have = profile.experienceYears

  if (job.no_experience) {
    return have === null || have <= 1
      ? [
          reason(
            'no-experience',
            WEIGHTS.noExperience,
            'No pide experiencia previa',
          ),
        ]
      : []
  }

  if (job.experience_years_min !== null && have !== null) {
    const asks = job.experience_years_min
    return have >= asks
      ? [
          reason(
            'experience',
            WEIGHTS.experience,
            `Pide ${years(asks)} y tenés ${years(have)}`,
          ),
        ]
      : [
          reason(
            'experience',
            WEIGHTS.experienceShort,
            `Pide ${years(asks)} y tenés ${have === 0 ? 'ninguno' : years(have)}`,
          ),
        ]
  }

  /** Sin años explícitos en la oferta, el nivel es lo único que se compara. */
  if (job.level && have !== null) {
    const gap = Math.abs(
      LEVEL_RANK[job.level] - LEVEL_RANK[levelFromYears(have)],
    )
    const level = LEVEL_LABEL[job.level].toLowerCase()
    if (gap === 0) {
      return [
        reason(
          'level',
          WEIGHTS.levelFit,
          `Es nivel ${level}, acorde a tus años`,
        ),
      ]
    }
    if (gap >= 2) {
      return [
        reason(
          'level',
          WEIGHTS.levelFar,
          `Es nivel ${level} y queda lejos de tus años`,
        ),
      ]
    }
  }
  return []
}

function educationReasons(job: Job, profile: Profile): Reason[] {
  const meets = meetsEducation(job, profile)
  if (meets === null || profile.education === '' || !job.education_level) {
    return []
  }
  const asks = job.education_level.toLowerCase()
  const yours = EDUCATION_LABEL[profile.education].toLowerCase()
  return meets
    ? [reason('education', WEIGHTS.education, `Pide ${asks} y tenés ${yours}`)]
    : [
        reason(
          'education',
          WEIGHTS.educationShort,
          `Pide ${asks} y cargaste ${yours}`,
        ),
      ]
}

/**
 * Arma el recomendador de una persona: las habilidades se derivan una sola
 * vez y la función que vuelve sirve para toda la lista.
 */
export function recommender(
  preferences: Preferences,
  profile: Profile,
  resume: Resume | null,
): (job: Job) => Recommendation {
  const owned = new Map(
    ownedSkills(profile, resume).map((skill) => [skill.slug, skill.source]),
  )

  return (job) => {
    const reasons: Reason[] = [
      ...preferenceReasons(job, preferences),
      ...experienceReasons(job, profile),
      ...educationReasons(job, profile),
    ]

    const asked = jobSkills(job)
    const have = asked.filter((slug) => owned.has(slug))
    for (const slug of have.slice(0, WEIGHTS.skillCap)) {
      const source = owned.get(slug) ?? 'cv'
      reasons.push(
        reason(
          `skill-${slug}`,
          WEIGHTS.skill,
          `Pide ${skillLabel(slug)}, ${YOUR_SKILL_SOURCE[source]}`,
        ),
      )
    }

    /** Sin habilidades cargadas no se sabe qué falta: no se castiga a nadie
     * por no haber completado el perfil. */
    if (owned.size > 0) {
      const missing = asked.filter((slug) => !owned.has(slug))
      for (const slug of missing.slice(0, WEIGHTS.skillMissingCap)) {
        reasons.push(
          reason(
            `missing-${slug}`,
            WEIGHTS.skillMissing,
            `Pide ${skillLabel(slug)} y no lo tenés cargado`,
          ),
        )
      }
    }

    reasons.sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    const score = reasons.reduce((sum, entry) => sum + entry.points, 0)
    return { score, reasons }
  }
}

/** Las razones para la tarjeta: pocas y solo las que suman. */
export const cardReasons = (
  recommendation: Recommendation,
  max = 2,
): Reason[] =>
  recommendation.reasons.filter((entry) => entry.kind === 'plus').slice(0, max)

/** Lo que le falta a la oferta respecto de la persona, para la ficha. */
export const missingReasons = (recommendation: Recommendation): Reason[] =>
  recommendation.reasons.filter((entry) => entry.kind === 'minus')

export const hasReasons = (recommendation: Recommendation): boolean =>
  recommendation.reasons.length > 0
