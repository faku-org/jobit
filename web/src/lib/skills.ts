import { SKILLS, skillsOf } from '@jobit/worker/skills'
import { type CatalogEntry, courseById, degreeById } from './catalog.ts'
import type { Profile } from './profile.ts'
import type { Resume } from './resume.ts'
import type { Job } from './types.ts'

/**
 * Las habilidades de la persona, en el mismo vocabulario que las de las ofertas
 * (`worker/src/skills.ts`): un slug cerrado, nunca texto libre. Así "Pide React"
 * y "tenés React" son el mismo valor y se pueden comparar sin adivinar.
 *
 * Todo vive en el navegador. Lo único que viaja es la lista de slugs del perfil,
 * y solo con el sync de cuenta prendido.
 */

/** El catálogo como lista para el buscador del perfil. */
export const SKILL_ENTRIES: CatalogEntry[] = SKILLS.map((skill) => ({
  id: skill.slug,
  label: skill.label,
  group: 'Habilidades',
}))

const LABEL_BY_SLUG = new Map(SKILLS.map((skill) => [skill.slug, skill.label]))

export const isSkillSlug = (slug: string): boolean => LABEL_BY_SLUG.has(slug)

export const skillLabel = (slug: string): string =>
  LABEL_BY_SLUG.get(slug) ?? slug

/** Techo de habilidades cargadas a mano: pasado esto es un CV, no un perfil. */
export const MAX_SKILLS = 30

/** De dónde sale una habilidad: del CV y el perfil, o la sumó la persona. */
export type SkillSource = 'cv' | 'manual'

export interface OwnedSkill {
  slug: string
  source: SkillSource
}

/**
 * Lo que dice el perfil de la persona, como texto: títulos, cursos, el puesto
 * que busca y los idiomas del CV. Las habilidades se leen de ahí con el mismo
 * reconocedor que usan las ofertas.
 */
function profileText(profile: Profile, resume: Resume | null): string {
  const labels = [
    ...profile.degrees.map((id) => degreeById(id)?.label ?? ''),
    ...profile.courses.map((id) => courseById(id)?.label ?? ''),
  ]
  if (resume) {
    labels.push(resume.role, ...resume.languages.map((entry) => entry.name))
  }
  return labels.filter(Boolean).join('\n')
}

const cvSkills = (profile: Profile, resume: Resume | null): string[] =>
  skillsOf(profileText(profile, resume)).map((skill) => skill.slug)

/** Las habilidades que salen solas del CV y del perfil, sin las que se quitaron. */
export function derivedSkills(
  profile: Profile,
  resume: Resume | null,
): string[] {
  const off = new Set(profile.skillsOff)
  return cvSkills(profile, resume).filter((slug) => !off.has(slug))
}

/**
 * Las habilidades que la persona tiene: las derivadas del CV y el perfil, más
 * las que sumó a mano. Una sumada a mano gana sobre una quitada.
 */
export function ownedSkills(
  profile: Profile,
  resume: Resume | null,
): OwnedSkill[] {
  const manual = profile.skills.filter(isSkillSlug)
  const owned = new Map<string, SkillSource>()
  for (const slug of derivedSkills(profile, resume)) owned.set(slug, 'cv')
  for (const slug of manual) owned.set(slug, 'manual')
  return [...owned].map(([slug, source]) => ({ slug, source }))
}

/**
 * Aplica la lista que la persona dejó en el editor: lo que sumó va a `skills`
 * (y deja de estar quitado), y lo que sacó se borra de `skills` o, si salía
 * solo del CV, queda en `skillsOff` para que no vuelva a aparecer.
 */
export function withOwnedSkills(
  profile: Profile,
  resume: Resume | null,
  next: string[],
): Profile {
  const before = new Set(
    ownedSkills(profile, resume).map((skill) => skill.slug),
  )
  const after = new Set(next.filter(isSkillSlug))
  const skills = new Set(profile.skills)
  const off = new Set(profile.skillsOff)
  const fromCv = new Set(cvSkills(profile, resume))

  for (const slug of after) {
    if (before.has(slug)) continue
    skills.add(slug)
    off.delete(slug)
  }
  for (const slug of before) {
    if (after.has(slug)) continue
    skills.delete(slug)
    if (fromCv.has(slug)) off.add(slug)
  }
  return { ...profile, skills: [...skills], skillsOff: [...off] }
}

/**
 * Las habilidades que nombra una oferta, leídas de su título, sus requisitos y
 * su descripción. Se calcula una vez por oferta: la lista se vuelve a dibujar
 * mucho más seguido de lo que una oferta cambia.
 */
const OFFER_SKILLS = new WeakMap<Job, string[]>()

export function jobSkills(job: Job): string[] {
  const known = OFFER_SKILLS.get(job)
  if (known) return known
  const text = [job.title, job.requirements ?? '', job.description].join('\n')
  const slugs = skillsOf(text).map((skill) => skill.slug)
  OFFER_SKILLS.set(job, slugs)
  return slugs
}
