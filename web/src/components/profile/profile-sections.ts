import type { MessageKey } from '../../lib/i18n.ts'

/** Las sub-secciones de Perfil, en el orden de la barra. El id es el ancla
 * (`?view=settings#cv`). */
export const PROFILE_SECTIONS = [
  { id: 'perfil', label: 'settings.profile.basics' },
  { id: 'cv', label: 'settings.profile.cv' },
  { id: 'cv-datos', label: 'settings.profile.cvData' },
  { id: 'cv-puesto', label: 'settings.profile.cvRole' },
  { id: 'cv-extra', label: 'settings.profile.cvExtra' },
  { id: 'busqueda', label: 'settings.profile.search' },
  { id: 'fuentes', label: 'settings.profile.sources' },
  { id: 'autoconocimiento', label: 'settings.profile.test' },
  { id: 'cuenta', label: 'settings.profile.account' },
  { id: 'agentes', label: 'settings.profile.agents' },
  { id: 'privacidad', label: 'settings.profile.privacy' },
] as const satisfies readonly { id: string; label: MessageKey }[]

export type ProfileSectionId = (typeof PROFILE_SECTIONS)[number]['id']
