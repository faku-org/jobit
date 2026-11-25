import { useT } from '../../hooks/useLocale.ts'
import type { Profile } from '../../lib/profile.ts'
import type { Resume } from '../../lib/resume.ts'
import {
  MAX_SKILLS,
  SKILL_ENTRIES,
  ownedSkills,
  withOwnedSkills,
} from '../../lib/skills.ts'
import { Combobox } from '../ui/Combobox.tsx'

interface SkillsFieldProps {
  profile: Profile
  /** Lo que se cargó en el CV: sus datos también aportan habilidades. */
  resume: Resume | null
  onChange: (profile: Profile) => void
}

/**
 * Las habilidades de la persona, del mismo catálogo que las ofertas. Salen
 * solas del CV y los cursos y se pueden quitar; las que faltan se suman acá.
 * Nunca es texto libre: lo que no está en la lista no se podría comparar.
 */
export function SkillsField({ profile, resume, onChange }: SkillsFieldProps) {
  const t = useT()
  const owned = ownedSkills(profile, resume).map((skill) => skill.slug)

  return (
    <div>
      <Combobox
        entries={SKILL_ENTRIES}
        label={t('skills.label')}
        max={MAX_SKILLS}
        placeholder={t('skills.placeholder')}
        selected={owned}
        onChange={(next) => onChange(withOwnedSkills(profile, resume, next))}
      />
      <p className="mt-1.5 text-xs leading-relaxed text-onpanel-faint">
        {t('skills.hint')}
      </p>
    </div>
  )
}
