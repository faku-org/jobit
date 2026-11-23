import { Check, Pencil, Plus, ShieldCheck, Upload, X } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import type { OrbState } from 'thinking-orbs'
import { holdBusy } from '../../hooks/useSettlingBusy.ts'
import { COURSES, DEGREES } from '../../lib/catalog.ts'
import {
  type CvReading,
  EMPTY_READING,
  isEmptyReading,
  placeCity,
  readCv,
} from '../../lib/cv.ts'
import { fadeUpTransition, stagger } from '../../lib/motion.ts'
import {
  EDUCATION_LABEL,
  EDUCATION_LEVELS,
  type Profile,
} from '../../lib/profile.ts'
import {
  LANGUAGE_LEVEL_LABEL,
  type ResumeFound,
  type ResumeLanguage,
  type ResumeLink,
} from '../../lib/resume.ts'
import type { Facet, Preferences } from '../../lib/types.ts'
import { Aura, AuraSpark } from '../ui/Aura.tsx'
import { Combobox } from '../ui/Combobox.tsx'
import { ExperienceField } from './ExperienceField.tsx'
import { LanguagesField } from './LanguagesField.tsx'
import { LinksField } from './LinksField.tsx'
import { PanelChip } from './PanelControls.tsx'

/** Las auras de acá viven sobre el panel y no sobre una tarjeta. */
const ON_PANEL = '[--aura-base:var(--color-panel)] [--aura-tone:40%]'

interface CvImportProps {
  profile: Profile
  preferences: Preferences
  categories: Facet[]
  /** Lo tildado de idiomas, links y ubicación va como tercer argumento. */
  onApply: (
    profile: Profile,
    preferences: Preferences,
    found: ResumeFound,
  ) => void
  /** Si quien llama guarda idiomas y links (el panel del perfil). El onboarding
   * todavía no tiene dónde, así que no los ofrece: tildar algo que se pierde
   * sería mentirle a la persona. */
  withResume?: boolean
  /** Dentro de un panel de columnas: cada pieza (la entrada, el resumen, cada
   * grupo leído, el botón de sumar) sale como hija directa para que se reparta
   * entre las columnas en vez de ser una tarjeta que no entra en una. */
  columns?: boolean
  title?: string
  onEmpty?: () => void
}

const MAX_FILE_BYTES = 8 * 1024 * 1024
const ACCEPT = '.pdf,.txt,.md,.markdown,text/plain,application/pdf'

const isPdf = (file: File): boolean =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

/**
 * El lector de PDF se trae recién cuando hace falta, y se trae desde acá: un
 * `import()` adentro del componente es sintaxis que el compilador de React no
 * sabe leer, y le hacía perder la memoización de todo `CvImport`.
 */
const readFileText = async (file: File): Promise<string> =>
  isPdf(file)
    ? (await import('../../lib/pdf.ts')).extractPdfText(file)
    : file.text()

type Stage = 'idle' | 'uploading' | 'analyzing' | 'answered' | 'review'

const BEAT: Record<
  Exclude<Stage, 'idle' | 'review'>,
  { label: string; orb: OrbState; ms: number }
> = {
  uploading: { label: 'Subiendo archivo…', orb: 'working', ms: 900 },
  analyzing: { label: 'Analizando CV…', orb: 'working', ms: 1800 },
  answered: { label: 'CV analizado', orb: 'working', ms: 1100 },
}

const labelOf = (id: string): string =>
  [...DEGREES, ...COURSES].find((entry) => entry.id === id)?.label ?? id

function Pick({
  label,
  checked,
  onToggle,
}: {
  label: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      aria-pressed={checked}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        checked
          ? 'bg-brand/85 text-ink'
          : 'bg-onpanel-wash text-onpanel-muted hover:bg-onpanel-wash'
      }`}
      type="button"
      onClick={onToggle}
    >
      {checked ? <Check aria-hidden className="size-3" /> : null}
      {label}
    </button>
  )
}

function Group({
  title,
  children,
  fix,
}: {
  title: string
  /** Lo que se leyó, para tildar o destilar de a uno. */
  children: React.ReactNode
  /** "Algo está mal": cambia lo leído por el mismo control del perfil. */
  fix?: {
    open: boolean
    edited: boolean
    onToggle: () => void
    editor: React.ReactNode
  }
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.6875rem] font-semibold tracking-wide text-onpanel-muted uppercase">
          {title}
          {fix?.edited && !fix.open ? (
            <span className="ml-1.5 font-medium tracking-normal normal-case">
              · corregido
            </span>
          ) : null}
        </p>
        {fix ? (
          <button
            aria-expanded={fix.open}
            aria-label={
              fix.open
                ? `Listo con ${title.toLowerCase()}`
                : `Algo está mal en ${title.toLowerCase()}`
            }
            className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md px-1.5 text-[0.6875rem] font-medium text-onpanel/75 transition-colors hover:bg-onpanel/15 hover:text-onpanel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            type="button"
            onClick={fix.onToggle}
          >
            {fix.open ? (
              <Check aria-hidden className="size-3" />
            ) : (
              <Pencil aria-hidden className="size-3" />
            )}
            {fix.open ? 'Listo' : 'Algo está mal'}
          </button>
        ) : null}
      </div>
      {fix?.open ? (
        <div className="mt-2 space-y-2">
          {fix.editor}
          <p className="text-[0.6875rem] leading-relaxed text-onpanel-faint">
            Lo que dejes acá es lo que se suma a tu perfil.
          </p>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
      )}
    </div>
  )
}

function ProgressBeat({ stage }: { stage: Exclude<Stage, 'idle' | 'review'> }) {
  const beat = BEAT[stage]

  return (
    <Aura busy className={`rounded-xl ${ON_PANEL}`} intro={false}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <AuraSpark intro={false} state={beat.orb} tone="panel" />
        <AnimatePresence mode="wait">
          <m.p
            key={stage}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs font-medium text-onpanel"
            exit={{ opacity: 0, y: -6 }}
            initial={{ opacity: 0, y: 6 }}
            transition={fadeUpTransition}
          >
            {beat.label}
          </m.p>
        </AnimatePresence>
      </div>
    </Aura>
  )
}

/**
 * Reads a CV — or a LinkedIn profile saved as PDF — and matches it against the
 * same closed lists the profile uses. The file is opened in this browser and
 * nothing is uploaded; there is no server that could receive it.
 */
export function CvImport({
  profile,
  preferences,
  categories,
  onApply,
  onEmpty,
  withResume = true,
  columns = false,
  title = 'Importar tu CV',
}: CvImportProps) {
  const [stage, setStage] = useState<Stage>('idle')
  const [reading, setReading] = useState<CvReading>(EMPTY_READING)
  const [dropped, setDropped] = useState<Set<string>>(new Set())
  /** Grupos abiertos en "Algo está mal", y los que ya se corrigieron. */
  const [fixing, setFixing] = useState<Set<string>>(new Set())
  const [edited, setEdited] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const reviewRef = useRef<HTMLDivElement>(null)
  const readTicket = useRef(0)

  useEffect(
    () => () => {
      readTicket.current += 1
    },
    [],
  )

  useEffect(() => {
    if (stage !== 'review') return
    reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [stage])

  const kept = (key: string) => !dropped.has(key)
  const toggle = (key: string) =>
    setDropped((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const flip = (key: string) =>
    setFixing((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  /** Lo que la persona corrige es lo que quiere: queda tildado. */
  const correct = (group: string, revive: string[] = [group]) => {
    setEdited((current) => new Set(current).add(group))
    setDropped((current) => {
      const next = new Set(current)
      for (const key of revive) next.delete(key)
      return next
    })
  }

  const fixDegrees = (degrees: string[]) => {
    correct(
      'degrees',
      degrees.map((id) => `degree:${id}`),
    )
    setReading((current) => ({ ...current, degrees }))
  }
  const fixCourses = (courses: string[]) => {
    correct(
      'courses',
      courses.map((id) => `course:${id}`),
    )
    setReading((current) => ({ ...current, courses }))
  }
  const fixLanguages = (languages: ResumeLanguage[]) => {
    correct(
      'languages',
      languages.map((language) => `lang:${language.name}`),
    )
    setReading((current) => ({ ...current, languages }))
  }
  const fixLinks = (links: ResumeLink[]) => {
    correct(
      'links',
      links.map((link) => `link:${link.url}`),
    )
    setReading((current) => ({ ...current, links }))
  }

  const finish = (read: CvReading) => {
    /* Sin dónde guardarlos, idiomas y links no cuentan como hallazgo. */
    const found = withResume ? read : { ...read, languages: [], links: [] }
    if (isEmptyReading(found) && onEmpty) {
      setStage('idle')
      setError(null)
      onEmpty()
      return
    }

    setReading(found)
    setDropped(new Set())
    setFixing(new Set())
    setEdited(new Set())
    setStage('review')
    if (isEmptyReading(found)) {
      setError(
        found.characters < 40
          ? 'Casi no se pudo leer texto. Si el PDF es una foto escaneada, exportalo de nuevo como PDF de texto.'
          : 'Se leyó el archivo pero no reconocí títulos ni cursos de la lista. Podés cargarlos a mano.',
      )
    } else {
      setError(null)
    }
  }

  const runReading = async (source: () => Promise<string>) => {
    const ticket = ++readTicket.current
    setError(null)
    const live = (next: Stage) =>
      ticket === readTicket.current && setStage(next)

    try {
      live('uploading')
      const uploadStarted = performance.now()
      const text = await source()
      await holdBusy(uploadStarted, BEAT.uploading.ms)
      if (ticket !== readTicket.current) return

      live('analyzing')
      const analyzeStarted = performance.now()
      const found = readCv(text)
      await holdBusy(analyzeStarted, BEAT.analyzing.ms)
      if (ticket !== readTicket.current) return

      live('answered')
      await holdBusy(performance.now(), BEAT.answered.ms)
      if (ticket !== readTicket.current) return
      finish(found)
    } catch (cause) {
      /** The message stays generic; the console keeps the real reason. */
      console.error('CV import failed', cause)
      if (ticket !== readTicket.current) return
      setStage('idle')
      setError(
        'No se pudo abrir el archivo. Probá con un PDF de texto o un .txt.',
      )
    }
  }

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (file.size > MAX_FILE_BYTES) {
      setError(
        'El archivo pesa más de 8 MB. Probá con el CV solo, sin adjuntos.',
      )
      return
    }

    void runReading(() => readFileText(file))
  }

  const apply = () => {
    const degrees = reading.degrees.filter((id) => kept(`degree:${id}`))
    const courses = reading.courses.filter((id) => kept(`course:${id}`))
    const wanted = reading.categories.filter((slug) => kept(`category:${slug}`))
    const places = reading.places.filter((place) =>
      kept(`place:${place.department}`),
    )
    const place = places[0]

    onApply(
      {
        ...profile,
        degrees: [...new Set([...profile.degrees, ...degrees])],
        courses: [...new Set([...profile.courses, ...courses])],
        education:
          reading.education !== '' && kept('education')
            ? reading.education
            : profile.education,
        experienceYears:
          reading.experienceYears !== null && kept('experience')
            ? reading.experienceYears
            : profile.experienceYears,
      },
      {
        ...preferences,
        categories: [...new Set([...preferences.categories, ...wanted])].filter(
          (slug) => !preferences.hiddenCategories.includes(slug),
        ),
        departments: [
          ...new Set([
            ...preferences.departments,
            ...places.map((p) => p.department),
          ]),
        ].filter((name) => !preferences.hiddenDepartments.includes(name)),
      },
      {
        languages: reading.languages.filter((language) =>
          kept(`lang:${language.name}`),
        ),
        links: reading.links.filter((link) => kept(`link:${link.url}`)),
        place:
          withResume && place
            ? { department: place.department, city: placeCity(place) }
            : null,
      },
    )

    setStage('idle')
    setReading(EMPTY_READING)
  }

  const found =
    reading.degrees.length +
    reading.courses.length +
    reading.categories.length +
    reading.places.length +
    reading.languages.length +
    reading.links.length +
    (reading.education === '' ? 0 : 1) +
    (reading.experienceYears === null ? 0 : 1)

  const fixFor = (key: string, editor: React.ReactNode) => ({
    open: fixing.has(key),
    edited: edited.has(key),
    onToggle: () => flip(key),
    editor,
  })

  const groups: { key: string; node: React.ReactNode }[] = []
  if (reading.places.length > 0) {
    groups.push({
      key: 'places',
      node: (
        <Group title="Ubicación">
          {reading.places.map((place) => (
            <Pick
              key={place.department}
              checked={kept(`place:${place.department}`)}
              label={place.label}
              onToggle={() => toggle(`place:${place.department}`)}
            />
          ))}
        </Group>
      ),
    })
  }
  if (reading.education !== '') {
    groups.push({
      key: 'education',
      node: (
        <Group
          fix={fixFor(
            'education',
            <div className="flex flex-wrap gap-1.5">
              {EDUCATION_LEVELS.map((level) => (
                <PanelChip
                  key={level}
                  active={reading.education === level}
                  onClick={() => {
                    correct('education')
                    setReading((current) => ({ ...current, education: level }))
                  }}
                >
                  {EDUCATION_LABEL[level]}
                </PanelChip>
              ))}
            </div>,
          )}
          title="Nivel educativo"
        >
          <Pick
            checked={kept('education')}
            label={EDUCATION_LABEL[reading.education]}
            onToggle={() => toggle('education')}
          />
        </Group>
      ),
    })
  }
  if (reading.degrees.length > 0 || fixing.has('degrees')) {
    groups.push({
      key: 'degrees',
      node: (
        <Group
          fix={fixFor(
            'degrees',
            <Combobox
              entries={DEGREES}
              hideLabel
              label="Títulos"
              placeholder="Buscá tu título: bachillerato, UTU, licenciatura…"
              selected={reading.degrees}
              onChange={fixDegrees}
            />,
          )}
          title="Títulos"
        >
          {reading.degrees.map((id) => (
            <Pick
              key={id}
              checked={kept(`degree:${id}`)}
              label={labelOf(id)}
              onToggle={() => toggle(`degree:${id}`)}
            />
          ))}
        </Group>
      ),
    })
  }
  if (reading.courses.length > 0 || fixing.has('courses')) {
    groups.push({
      key: 'courses',
      node: (
        <Group
          fix={fixFor(
            'courses',
            <Combobox
              entries={COURSES}
              hideLabel
              label="Cursos y certificaciones"
              placeholder="Buscá: inglés, Excel, libreta, primeros auxilios…"
              selected={reading.courses}
              onChange={fixCourses}
            />,
          )}
          title="Cursos y certificaciones"
        >
          {reading.courses.map((id) => (
            <Pick
              key={id}
              checked={kept(`course:${id}`)}
              label={labelOf(id)}
              onToggle={() => toggle(`course:${id}`)}
            />
          ))}
        </Group>
      ),
    })
  }
  if (reading.experienceYears !== null) {
    groups.push({
      key: 'experience',
      node: (
        <Group
          fix={fixFor(
            'experience',
            <ExperienceField
              value={reading.experienceYears}
              onChange={(experienceYears) => {
                if (experienceYears === null) return
                correct('experience')
                setReading((current) => ({ ...current, experienceYears }))
              }}
            />,
          )}
          title="Años de experiencia"
        >
          <Pick
            checked={kept('experience')}
            label={
              reading.experienceYears === 0
                ? 'Sin experiencia'
                : `${reading.experienceYears} ${reading.experienceYears === 1 ? 'año' : 'años'}`
            }
            onToggle={() => toggle('experience')}
          />
        </Group>
      ),
    })
  }
  if (reading.languages.length > 0 || fixing.has('languages')) {
    groups.push({
      key: 'languages',
      node: (
        <Group
          fix={fixFor(
            'languages',
            <LanguagesField
              value={reading.languages}
              onChange={fixLanguages}
            />,
          )}
          title="Idiomas"
        >
          {reading.languages.map((language) => (
            <Pick
              key={language.name}
              checked={kept(`lang:${language.name}`)}
              label={`${language.name}, ${LANGUAGE_LEVEL_LABEL[language.level].toLowerCase()}`}
              onToggle={() => toggle(`lang:${language.name}`)}
            />
          ))}
        </Group>
      ),
    })
  }
  if (reading.links.length > 0 || fixing.has('links')) {
    groups.push({
      key: 'links',
      node: (
        <Group
          fix={fixFor(
            'links',
            <LinksField value={reading.links} onChange={fixLinks} />,
          )}
          title="Web y redes"
        >
          {reading.links.map((link) => (
            <Pick
              key={link.url}
              checked={kept(`link:${link.url}`)}
              label={link.url.replace(/^https?:\/\/(www\.)?/, '')}
              onToggle={() => toggle(`link:${link.url}`)}
            />
          ))}
        </Group>
      ),
    })
  }
  if (reading.categories.length > 0) {
    groups.push({
      key: 'categories',
      node: (
        <Group title="Rubros que sugiere">
          {reading.categories.map((slug) => (
            <Pick
              key={slug}
              checked={kept(`category:${slug}`)}
              label={
                categories.find((facet) => facet.value === slug)?.label ?? slug
              }
              onToggle={() => toggle(`category:${slug}`)}
            />
          ))}
        </Group>
      ),
    })
  }

  if (columns) {
    return (
      <>
        <div className="space-y-3">
          <div>
            <p className="text-[0.6875rem] font-semibold tracking-wide text-onpanel-muted uppercase">
              {title}
            </p>
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-onpanel-muted">
              Leo el archivo <strong>en este navegador</strong> y busco tus
              títulos, cursos, años de experiencia
              {withResume ? ', idiomas y links' : ''}. No se sube a ningún lado.
              También sirve tu perfil de LinkedIn: entrá a tu perfil, “Más” →
              “Guardar como PDF”, y subí ese archivo.
            </p>
          </div>

          <input
            ref={input}
            accept={ACCEPT}
            className="hidden"
            type="file"
            onChange={onFile}
          />

          {stage === 'idle' ? (
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-onpanel-wash px-3 py-2.5 text-xs font-medium text-onpanel/85 transition-colors hover:bg-onpanel/20 hover:text-onpanel"
              type="button"
              onClick={() => input.current?.click()}
            >
              <Upload aria-hidden className="size-4" />
              Elegir archivo (PDF o texto)
            </button>
          ) : null}

          {stage === 'uploading' ||
          stage === 'analyzing' ||
          stage === 'answered' ? (
            <ProgressBeat stage={stage} />
          ) : null}

          {error ? (
            <p className="rounded-lg bg-onpanel-wash px-2.5 py-2 text-[0.6875rem] leading-relaxed text-onpanel/70">
              {error}
            </p>
          ) : null}
        </div>

        {stage === 'review' ? (
          <>
            <div ref={reviewRef} className="space-y-2">
              <div className="flex items-center gap-2">
                <AuraSpark intro={false} state="breathing" tone="panel" />
                <p className="min-w-0 flex-1 text-xs font-semibold text-onpanel">
                  {found === 0
                    ? 'No encontré nada de la lista'
                    : `Encontré ${found} cosas`}
                </p>
                <button
                  aria-label="Descartar la lectura"
                  className="shrink-0 rounded-md p-1 text-onpanel-muted transition-colors hover:bg-onpanel/15 hover:text-onpanel"
                  type="button"
                  onClick={() => {
                    setStage('idle')
                    setError(null)
                  }}
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </div>
              {found > 0 ? (
                <p className="text-[0.6875rem] leading-relaxed text-onpanel/80">
                  Tocá para sacar lo que no corresponda, o “Algo está mal” para
                  corregirlo acá. Se suma a tu perfil, no lo reemplaza.
                </p>
              ) : null}
            </div>

            {groups.map((group) => (
              <div key={group.key}>{group.node}</div>
            ))}

            <div className="space-y-2">
              <button
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-onpanel/20 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap text-ink shadow-[0_0_20px_color-mix(in_srgb,var(--color-brand)_45%,transparent)] transition-[box-shadow,background-color] hover:bg-green-300/30 focus-visible:ring-4 focus-visible:ring-brand/30 focus-visible:outline-none disabled:opacity-40 disabled:shadow-none"
                disabled={found === 0}
                type="button"
                onClick={apply}
              >
                <Plus aria-hidden className="size-3.5" />
                Sumar a mi perfil
              </button>
              <span className="inline-flex items-center justify-center gap-1 text-[0.625rem] text-onpanel-faint">
                <ShieldCheck aria-hidden className="size-3" />
                El archivo no salió de tu navegador
              </span>
            </div>
          </>
        ) : null}
      </>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[0.6875rem] font-semibold tracking-wide text-onpanel-muted uppercase">
          {title}
        </p>
        <p className="mt-1 text-[0.6875rem] leading-relaxed text-onpanel-muted">
          Leo el archivo <strong>en este navegador</strong> y busco tus títulos,
          cursos, años de experiencia{withResume ? ', idiomas y links' : ''}. No
          se sube a ningún lado. También sirve tu perfil de LinkedIn: entrá a tu
          perfil, “Más” → “Guardar como PDF”, y subí ese archivo.
        </p>
      </div>

      <input
        ref={input}
        accept={ACCEPT}
        className="hidden"
        type="file"
        onChange={onFile}
      />

      {stage === 'idle' ? (
        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-onpanel-wash px-3 py-2.5 text-xs font-medium text-onpanel/85 transition-colors hover:bg-onpanel/20 hover:text-onpanel"
          type="button"
          onClick={() => input.current?.click()}
        >
          <Upload aria-hidden className="size-4" />
          Elegir archivo (PDF o texto)
        </button>
      ) : null}

      {stage === 'uploading' ||
      stage === 'analyzing' ||
      stage === 'answered' ? (
        <ProgressBeat stage={stage} />
      ) : null}

      {error ? (
        <p className="rounded-lg bg-onpanel-wash px-2.5 py-2 text-[0.6875rem] leading-relaxed text-onpanel/70">
          {error}
        </p>
      ) : null}

      <AnimatePresence initial={false}>
        {stage === 'review' ? (
          <m.div
            ref={reviewRef}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            initial={{ opacity: 0, y: 16 }}
            transition={fadeUpTransition}
          >
            <Aura className={`rounded-xl ${ON_PANEL}`} intro={false}>
              <div className="space-y-4 rounded-xl px-3 py-3">
                <div className="flex items-center gap-2">
                  <AuraSpark intro={false} state="breathing" tone="panel" />
                  <p className="min-w-0 flex-1 text-xs font-semibold text-onpanel">
                    {found === 0
                      ? 'No encontré nada de la lista'
                      : `Encontré ${found} cosas`}
                  </p>
                  <button
                    aria-label="Descartar la lectura"
                    className="shrink-0 rounded-md p-1 text-onpanel-muted transition-colors hover:bg-onpanel/15 hover:text-onpanel"
                    type="button"
                    onClick={() => {
                      setStage('idle')
                      setError(null)
                    }}
                  >
                    <X aria-hidden className="size-3.5" />
                  </button>
                </div>

                {found > 0 ? (
                  <p className="text-[0.6875rem] leading-relaxed text-onpanel/80">
                    Tocá para sacar lo que no corresponda, o “Algo está mal”
                    para corregirlo acá. Se suma a tu perfil, no lo reemplaza.
                  </p>
                ) : null}

                {groups.map((group, index) => (
                  <m.div
                    key={group.key}
                    animate={{ opacity: 1, y: 0 }}
                    initial={{ opacity: 0, y: 10 }}
                    transition={{
                      ...fadeUpTransition,
                      delay: stagger(index, 0.07, 0.4),
                    }}
                  >
                    {group.node}
                  </m.div>
                ))}

                <div className="space-y-2 border-t border-onpanel/10 pt-3">
                  <m.button
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-onpanel/20 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap text-ink shadow-[0_0_20px_color-mix(in_srgb,var(--color-brand)_45%,transparent)] transition-[box-shadow,background-color] hover:bg-green-300/30 hover:shadow-[0_0_28px_color-mix(in_srgb,var(--color-brand)_60%,transparent)] focus-visible:ring-4 focus-visible:ring-brand/30 focus-visible:outline-none disabled:opacity-40 disabled:shadow-none"
                    disabled={found === 0}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={apply}
                  >
                    <Plus aria-hidden className="size-3.5" />
                    Sumar a mi perfil
                  </m.button>
                  <span className="inline-flex items-center justify-center gap-1 text-[0.625rem] text-onpanel-faint">
                    <ShieldCheck aria-hidden className="size-3" />
                    El archivo no salió de tu navegador
                  </span>
                </div>
              </div>
            </Aura>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
