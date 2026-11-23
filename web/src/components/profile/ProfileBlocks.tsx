import { ChevronDown, Compass } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { lazy, Suspense, useState } from 'react'
import { COURSES, DEGREES } from '../../lib/catalog.ts'
import { fadeUpTransition, revealPresence } from '../../lib/motion.ts'
import {
  EDUCATION_LABEL,
  EDUCATION_LEVELS,
  type EducationLevel,
  type Profile,
  withDegrees,
} from '../../lib/profile.ts'
import { type Usage, anonymousStats } from '../../lib/stats.ts'
import type { Resume, ResumeFound } from '../../lib/resume.ts'
import { pendingEvents } from '../../lib/track.ts'
import type { Facet, Preferences } from '../../lib/types.ts'
import { Combobox } from '../ui/Combobox.tsx'
import { DangerZone } from './DangerZone.tsx'
import { ExperienceField } from './ExperienceField.tsx'
import { PanelChip, PanelGroup } from './PanelControls.tsx'
import { ResumeSections } from './ResumeSections.tsx'

interface ProfileBasicsProps {
  profile: Profile
  onChange: (profile: Profile) => void
}

interface CvBlockProps {
  profile: Profile
  /** Read only by the CV import, which can suggest rubros to prefer. */
  preferences: Preferences
  categories: Facet[]
  /** Lo que la persona cargó para el CV; vive sólo en este navegador. */
  resume: Resume
  onImportCv: (
    profile: Profile,
    preferences: Preferences,
    found: ResumeFound,
  ) => void
  onChangeResume: (resume: Resume) => void
  onChangePreferences: (preferences: Preferences) => void
  onSearchBoard: () => void
}

interface TestEntryProps {
  /** Lleva al test de autoconocimiento, que es otra vista. */
  onOpenTest: () => void
  onPrefetchTest: () => void
}

interface PrivacyBlockProps {
  profile: Profile
  usage: Usage
  /** What the erase is about to throw away, so it can say it out loud before
   * doing it. */
  counts: { saved: number; applications: number; dismissed: number }
  onChange: (profile: Profile) => void
  onEraseEverything: () => void
}

const CvImport = lazy(() =>
  import('./CvImport.tsx').then((module) => ({ default: module.CvImport })),
)

/**
 * What the person studied, used to order the list and to tell whether an offer
 * asks for more than they have. It lives in this browser only: the privacy
 * section governs the one thing that ever leaves, and shows it verbatim.
 */
export function ProfileBasics({ profile, onChange }: ProfileBasicsProps) {
  const pickEducation = (level: EducationLevel) =>
    onChange({
      ...profile,
      education: profile.education === level ? '' : level,
    })

  return (
    <div className="space-y-5">
      <PanelGroup title="Nivel educativo">
        {EDUCATION_LEVELS.map((level) => (
          <PanelChip
            key={level}
            active={profile.education === level}
            onClick={() => pickEducation(level)}
          >
            {EDUCATION_LABEL[level]}
          </PanelChip>
        ))}
      </PanelGroup>

      <Combobox
        entries={DEGREES}
        label="Títulos"
        placeholder="Buscá tu título: bachillerato, UTU, licenciatura…"
        selected={profile.degrees}
        onChange={(degrees) => onChange(withDegrees(profile, degrees))}
      />

      <Combobox
        entries={COURSES}
        label="Cursos y certificaciones"
        placeholder="Buscá: inglés, Excel, libreta, primeros auxilios…"
        selected={profile.courses}
        onChange={(courses) => onChange({ ...profile, courses })}
      />

      <ExperienceField
        value={profile.experienceYears}
        onChange={(experienceYears) =>
          onChange({ ...profile, experienceYears })
        }
      />
    </div>
  )
}

/** Importar el CV y el resto de los datos que se parecen a uno. */
export function CvBlock({
  profile,
  preferences,
  categories,
  resume,
  onImportCv,
  onChangeResume,
  onChangePreferences,
  onSearchBoard,
}: CvBlockProps) {
  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <CvImport
          categories={categories}
          preferences={preferences}
          profile={profile}
          onApply={onImportCv}
        />
      </Suspense>

      <ResumeSections
        preferences={preferences}
        profile={profile}
        resume={resume}
        onChange={onChangeResume}
        onChangePreferences={onChangePreferences}
        onSearchBoard={onSearchBoard}
      />
    </div>
  )
}

/** La entrada al test de autoconocimiento, que es una vista propia. */
export function TestEntry({ onOpenTest, onPrefetchTest }: TestEntryProps) {
  return (
    <button
      className="flex w-full items-start gap-2.5 rounded-xl bg-onpanel-wash px-3 py-2.5 text-left transition-colors hover:bg-onpanel/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      type="button"
      onClick={onOpenTest}
      onFocus={onPrefetchTest}
      onMouseEnter={onPrefetchTest}
      onPointerDown={onPrefetchTest}
    >
      <Compass aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
      <span>
        <span className="block text-sm font-medium text-onpanel">
          Test de autoconocimiento laboral
        </span>
        <span className="mt-0.5 block text-[0.6875rem] leading-relaxed text-onpanel/75">
          50 frases, unos 10 minutos. Las respuestas quedan en este navegador y
          no se suben a ningún lado.
        </span>
      </span>
    </button>
  )
}

/**
 * Lo único que sale de este navegador (y es opcional), con la carga útil a la
 * vista, el borrado de todo y las legales: es el lugar de la app donde alguien
 * está mirando qué se guarda y qué se comparte.
 */
export function PrivacyBlock({
  profile,
  usage,
  counts,
  onChange,
  onEraseEverything,
}: PrivacyBlockProps) {
  const [showPayload, setShowPayload] = useState(false)
  const payload = anonymousStats(profile, usage)
  /* Lo que está en la cola ahora mismo, no un ejemplo: si dice que no se
     manda el texto que escribiste, se puede comprobar acá. */
  const events = pendingEvents()

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            checked={profile.shareStats}
            className="mt-0.5 size-3.5 shrink-0 accent-brand"
            type="checkbox"
            onChange={(event) =>
              onChange({ ...profile, shareStats: event.target.checked })
            }
          />
          <span className="text-[0.6875rem] leading-relaxed text-onpanel/75">
            Compartir estadísticas anónimas de uso. Una vez por día: tu nivel
            educativo y cuántos títulos, cursos, guardadas y postulaciones
            tenés. Y mientras navegás: qué puesto estás buscando, qué filtros
            usás y a qué avisos les diste a “Postularme”. Y que terminaste el
            test de autoconocimiento, sin una sola respuesta. Sin nombre, sin
            identificador y sin el texto que escribís.
          </span>
        </label>

        <button
          aria-expanded={showPayload}
          className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-onpanel/60 transition-colors hover:text-onpanel"
          type="button"
          onClick={() => setShowPayload((current) => !current)}
        >
          <ChevronDown
            aria-hidden
            className={`size-3 transition-transform ${showPayload ? 'rotate-180' : ''}`}
          />
          Ver exactamente qué se envía
        </button>

        <AnimatePresence initial={false}>
          {showPayload ? (
            <m.div
              {...revealPresence}
              className="grid overflow-hidden"
              transition={fadeUpTransition}
            >
              <pre className="min-h-0 overflow-x-auto rounded-lg bg-onpanel-wash p-2.5 text-[0.625rem] leading-relaxed text-onpanel/80">
                {JSON.stringify({ resumen: payload, eventos: events }, null, 2)}
              </pre>
            </m.div>
          ) : null}
        </AnimatePresence>
      </div>

      <DangerZone counts={counts} onEraseEverything={onEraseEverything} />

      {/* Las legales van acá y no en un pie de página: es el único lugar de la
          app donde alguien está mirando qué se guarda y qué se comparte. */}
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-[0.6875rem] text-onpanel/60">
        <a
          className="underline underline-offset-2 transition-colors hover:text-onpanel"
          href="/privacidad"
          rel="noopener"
          target="_blank"
        >
          Política de privacidad
        </a>
        <a
          className="underline underline-offset-2 transition-colors hover:text-onpanel"
          href="/terminos"
          rel="noopener"
          target="_blank"
        >
          Términos del servicio
        </a>
      </p>
    </div>
  )
}
