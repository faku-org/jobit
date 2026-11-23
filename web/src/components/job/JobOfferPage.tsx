import {
  Bookmark,
  Building2,
  ChevronDown,
  EyeOff,
  GraduationCap,
  MapPin,
  Target,
  Undo2,
  X,
} from 'lucide-react'
import { m } from 'motion/react'
import type { CSSProperties, ReactNode } from 'react'
import {
  APPLICATION_STATUS_LABEL,
  SOURCE_LABEL,
  formatDay,
  formatLocation,
} from '../../lib/format.ts'
import { islandTransition } from '../../lib/motion.ts'
import { jobShare } from '../../lib/share.ts'
import { chipClass, iconButtonClass } from '../../lib/styles.ts'
import {
  type Application,
  type Job,
  relatedApplications,
} from '../../lib/types.ts'
import type { ApplyFlow } from '../../hooks/useApplyFlow.ts'
import { usePillHeight } from '../../hooks/usePillHeight.ts'
import { ALL_PREP_KINDS, usePrep } from '../../hooks/usePrep.ts'
import { useRoleGuide } from '../../hooks/useRoleGuide.ts'
import { ShareMenu } from '../ui/ShareMenu.tsx'
import { ApplyFooter } from './ApplyFooter.tsx'
import { JobChips, type TagActions } from './JobChips.tsx'
import { JobDescription } from './JobDescription.tsx'
import { JobFit } from './JobFit.tsx'
import { PrepTips } from './PrepTips.tsx'
import { WorkedBadge } from './WorkedBadge.tsx'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function ApplicationList({ applications }: { applications: Application[] }) {
  return (
    <ul className="space-y-1.5">
      {applications.map((entry) => (
        <li
          key={entry.id}
          className="flex items-baseline justify-between gap-3 text-sm"
        >
          <span className="min-w-0 truncate text-ink/80">{entry.title}</span>
          <span className="shrink-0 text-xs text-muted">
            {APPLICATION_STATUS_LABEL[entry.status]}
            {entry.appliedAt ? ` · ${formatDay(entry.appliedAt)}` : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}

interface OfferHeaderProps {
  job: Job
  isSaved: boolean
  isDismissed: boolean
  isMatch: boolean
  worked: boolean
  onToggleSaved: (id: string) => void
  onToggleDismissed: (id: string) => void
  onClose: () => void
  onOpenEmployer?: () => void
}

/* En el teléfono el título va a lo ancho y las acciones bajan a su propia fila:
   es lo que evita que el nombre de la empresa se parta en dos y que la cabecera
   se sienta apretada. */
function OfferHeader({
  job,
  isSaved,
  isDismissed,
  isMatch,
  worked,
  onToggleSaved,
  onToggleDismissed,
  onClose,
  onOpenEmployer,
}: OfferHeaderProps) {
  return (
    <header className="flex flex-col gap-2.5 border-b border-sky/40 px-4 py-3 sm:flex-row sm:items-start sm:gap-3 sm:px-5 sm:py-4">
      <div className="min-w-0 flex-1">
        {isMatch ? (
          <span className={`${chipClass} mb-2 bg-panel text-onpanel`}>
            <Target aria-hidden className="size-3.5" />
            Para vos
          </span>
        ) : null}
        <h2
          className="text-[1.1875rem] leading-snug font-semibold tracking-tight text-ink focus:outline-none"
          id="job-modal-title"
          tabIndex={-1}
        >
          {job.title}
        </h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-soft">
          {job.company ? (
            <button
              className="inline-flex items-center gap-1.5 transition-colors hover:text-ink"
              type="button"
              onClick={onOpenEmployer}
            >
              <Building2 aria-hidden className="size-3.5 shrink-0 text-brand" />
              {job.company}
            </button>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <MapPin aria-hidden className="size-3.5 shrink-0 text-brand" />
            {formatLocation(job.city, job.department)}
          </span>
          {worked ? <WorkedBadge /> : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1.5">
        <ShareMenu target={jobShare(job)} />
        <m.button
          aria-label={isSaved ? 'Quitar de guardadas' : 'Guardar oferta'}
          aria-pressed={isSaved}
          className={`${iconButtonClass} ${
            isSaved
              ? 'border-panel bg-panel text-onpanel hover:text-onpanel'
              : ''
          }`}
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => onToggleSaved(job.id)}
        >
          <Bookmark
            aria-hidden
            className={`size-4 ${isSaved ? 'fill-current' : ''}`}
          />
        </m.button>
        <m.button
          aria-label={isDismissed ? 'Recuperar oferta' : 'Descartar oferta'}
          className={iconButtonClass}
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => onToggleDismissed(job.id)}
        >
          {isDismissed ? (
            <Undo2 aria-hidden className="size-4" />
          ) : (
            <EyeOff aria-hidden className="size-4" />
          )}
        </m.button>
        <m.button
          aria-label="Cerrar"
          className={iconButtonClass}
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
        >
          <X aria-hidden className="size-4" />
        </m.button>
      </div>
    </header>
  )
}

/** La preparación del rubro y, si existe, la guía del puesto concreto. */
function PrepSection({ job }: { job: Job }) {
  /* Se pide siempre, así las preguntas y los ejercicios están a mano aunque
     todavía no te hayas postulado. */
  const prep = usePrep(job.category, true, ALL_PREP_KINDS)
  const roleGuide = useRoleGuide(job.title)
  if (prep.items.length === 0 && !roleGuide) return null

  return (
    <details className="group rounded-2xl border border-sky/50 bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <GraduationCap aria-hidden className="size-4 shrink-0 text-brand" />
        <span className="text-xs font-semibold tracking-wide text-muted uppercase">
          Para prepararte
        </span>
        <ChevronDown
          aria-hidden
          className="ml-auto size-4 shrink-0 text-muted transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-sky/40 px-4 py-3">
        <PrepTips items={prep.items} />
        {roleGuide ? (
          <a
            className={`inline-block text-xs font-medium text-brand transition-colors hover:text-ink ${prep.items.length > 0 ? 'mt-4' : ''}`}
            href={roleGuide}
          >
            Ver la guía de entrevista para este puesto
          </a>
        ) : null}
      </div>
    </details>
  )
}

/** Las postulaciones previas a la misma empresa o al mismo rubro. */
function RelatedSection({
  job,
  applications,
}: {
  job: Job
  applications: Application[]
}) {
  const related = relatedApplications(job, applications)
  if (related.company.length === 0 && related.category.length === 0) return null

  return (
    <Section title="Tus postulaciones">
      <div className="space-y-4 rounded-xl border border-sky/50 px-3 py-3">
        {related.company.length > 0 ? (
          <div>
            <p className="text-sm font-medium text-ink">
              Ya te postulaste a {related.company.length}{' '}
              {related.company.length === 1 ? 'puesto' : 'puestos'} en{' '}
              {job.company}
            </p>
            <div className="mt-2">
              <ApplicationList applications={related.company} />
            </div>
          </div>
        ) : null}

        {related.category.length > 0 ? (
          <div>
            <p className="text-sm font-medium text-ink">
              {related.category.length}{' '}
              {related.category.length === 1 ? 'postulación' : 'postulaciones'}{' '}
              en {job.category_label}
            </p>
            <div className="mt-2">
              <ApplicationList applications={related.category} />
            </div>
          </div>
        ) : null}
      </div>
    </Section>
  )
}

interface JobOfferPageProps extends OfferHeaderProps {
  applications: Application[]
  /** What the chips of the sheet can do to the list behind it. */
  tagActions: TagActions
  isApplied: boolean
  flow: ApplyFlow
  /** La ficha está en la página de armar: ésta queda a un lado, inerte. */
  composing: boolean
  reduceMotion: boolean
  onCompose: () => void
}

/**
 * La primera página de la ficha: la oferta completa, los consejos escritos para
 * ella y lo que la persona ya hizo con las de alrededor. Cuando se arma el
 * mensaje se desliza a un lado y queda inerte.
 */
export function JobOfferPage({
  applications,
  tagActions,
  isApplied,
  flow,
  composing,
  reduceMotion,
  onCompose,
  ...header
}: JobOfferPageProps) {
  const { job } = header
  const [pillRef, pillHeight] = usePillHeight()

  return (
    <m.div
      animate={{
        opacity: composing ? 0 : 1,
        x: composing && !reduceMotion ? '-18%' : '0%',
      }}
      className="absolute inset-0 flex flex-col"
      initial={false}
      inert={composing}
      transition={islandTransition}
    >
      <OfferHeader {...header} />

      <div
        className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pt-4 pb-[calc(var(--apply-pill,5rem)+1.5rem+env(safe-area-inset-bottom))] sm:space-y-6 sm:px-5 sm:pt-5"
        style={{ '--apply-pill': `${pillHeight}px` } as CSSProperties}
      >
        <JobChips actions={tagActions} job={job} />

        <JobFit job={job} profile={tagActions.profile} />

        <Section title="Descripción">
          {job.description ? (
            <JobDescription
              profile={tagActions.profile}
              text={job.description}
            />
          ) : (
            <p className="text-sm text-muted">
              Esta oferta todavía no tiene la descripción descargada. Suele
              aparecer en la próxima actualización; mientras tanto podés abrir
              el aviso original.
            </p>
          )}
        </Section>

        {job.requirements ? (
          <Section title="Requisitos">
            <JobDescription
              profile={tagActions.profile}
              text={job.requirements}
            />
          </Section>
        ) : null}

        <PrepSection job={job} />

        <RelatedSection applications={applications} job={job} />

        <p className="text-xs text-muted">
          Fuente: {SOURCE_LABEL[job.source] ?? job.source}
          {job.vacancies && job.vacancies > 1
            ? ` · ${job.vacancies} vacantes`
            : ''}
          {job.duplicates.length > 0
            ? ` · ${job.duplicates.length} publicación repetida`
            : ''}
        </p>
      </div>

      {/* El pie es un pill que flota sobre el borde de abajo, no una franja del
          layout: como hijo del flex se achicaba y scrolleaba. El cuerpo reserva
          su alto (--apply-pill) para que nada quede tapado. */}
      <div
        ref={pillRef}
        className="absolute inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-10 rounded-2xl border border-sky/50 bg-surface/90 px-3 py-2.5 shadow-[var(--shadow-panel)] backdrop-blur-md sm:inset-x-4 sm:bottom-4 sm:px-4"
      >
        <ApplyFooter
          flow={flow}
          isApplied={isApplied}
          job={job}
          left={
            <p className="hidden text-xs text-muted sm:block">
              {isApplied
                ? 'Está en tu lista de seguimiento.'
                : 'Te pregunto si te postulaste al volver.'}
            </p>
          }
          onCompose={onCompose}
        />
      </div>
    </m.div>
  )
}
