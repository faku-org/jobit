import {
  ArrowLeft,
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
import { m, useReducedMotion } from 'motion/react'
import {
  type CSSProperties,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  APPLICATION_STATUS_LABEL,
  SOURCE_LABEL,
  formatDay,
  formatLocation,
} from '../../lib/format.ts'
import { islandTransition } from '../../lib/motion.ts'
import type { Resume } from '../../lib/resume.ts'
import { jobShare, sharedJobId } from '../../lib/share.ts'
import { readApplyOpen, writeApplyOpen } from '../../lib/url.ts'
import { offerView } from '../../lib/events.ts'
import { track } from '../../lib/track.ts'
import { chipClass, iconButtonClass } from '../../lib/styles.ts'
import {
  type Application,
  type Job,
  type Tag,
  relatedApplications,
} from '../../lib/types.ts'
import { useApplyFlow } from '../../hooks/useApplyFlow.ts'
import { usePillHeight } from '../../hooks/usePillHeight.ts'
import { ALL_PREP_KINDS, usePrep } from '../../hooks/usePrep.ts'
import { useRoleGuide } from '../../hooks/useRoleGuide.ts'
import { ApplyFooter } from './ApplyFooter.tsx'
import { WorkedBadge } from './WorkedBadge.tsx'
import { JobChips, type TagActions } from './JobChips.tsx'
import { JobDescription } from './JobDescription.tsx'
import { JobFit } from './JobFit.tsx'
import { PrepTips } from './PrepTips.tsx'
import { ShareMenu } from '../ui/ShareMenu.tsx'

const ApplyMessage = lazy(() =>
  import('./ApplyMessage.tsx').then((module) => ({
    default: module.ApplyMessage,
  })),
)

/** Las dos páginas de la ficha: la oferta y el armado del mensaje. */
type Page = 'offer' | 'compose'

/** Lo ancho que es la ficha en cada página: la de componer lleva el formulario
 * y la vista previa lado a lado. */
const WIDTH: Record<Page, number> = { offer: 672, compose: 1040 }

interface JobModalProps {
  job: Job
  isSaved: boolean
  isDismissed: boolean
  isMatch: boolean
  isApplied: boolean
  /** La empresa es una que la persona cargó como suya; solo una marca. */
  worked?: boolean
  applications: Application[]
  /** What the chips of the sheet can do to the list behind it. */
  tagActions: TagActions
  onToggleSaved: (id: string) => void
  onToggleDismissed: (id: string) => void
  onApplied: (job: Job) => void
  /** El currículum del dispositivo: de ahí sale el mensaje de postulación. */
  resume: Resume
  onChangeResume: (resume: Resume) => void
  /** Abrir directo en la página de armar el mensaje (viene de la tarjeta). */
  startComposing?: boolean
  onClose: () => void
  /** Abre el stand de la empresa de esta oferta. */
  onOpenEmployer?: () => void
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
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

/**
 * The whole offer on one sheet: description, tips written for this offer, and
 * what the person already did with the offers around it.
 */
export function JobModal({
  job,
  isSaved,
  isDismissed,
  isMatch,
  isApplied,
  worked = false,
  applications,
  tagActions,
  onToggleSaved,
  onToggleDismissed,
  onApplied,
  resume,
  onChangeResume,
  startComposing = false,
  onClose,
  onOpenEmployer,
}: JobModalProps) {
  const related = relatedApplications(job, applications)
  /** La preparación del rubro: se pide siempre, así las preguntas y los
   * ejercicios están a mano aunque todavía no te hayas postulado. */
  const prep = usePrep(job.category, true, ALL_PREP_KINDS)
  /** La guía del puesto concreto (Cajero/a, Enfermería…), cuando existe. */
  const roleGuide = useRoleGuide(job.title)
  /** The sheet plays its own exit and then asks to be unmounted. */
  const [closing, setClosing] = useState(false)
  const close = useCallback(() => setClosing(true), [])
  /** Filtering by a chip is a jump back to the list, so the sheet steps aside. */
  const chipActions: TagActions = {
    ...tagActions,
    onFilter: (tag: Tag) => {
      tagActions.onFilter(tag)
      close()
    },
  }

  const flow = useApplyFlow(job, isApplied, onApplied)
  const reduceMotion = useReducedMotion()

  /* La ficha es un solo diálogo con dos páginas. Arranca en la de componer si
     viene de "Armar mensaje" de la tarjeta o de un enlace con `apply=1` a esta
     misma oferta; una oferta ya postulada no tiene mensaje que armar. */
  const [page, setPage] = useState<Page>(() =>
    !isApplied &&
    (startComposing || (sharedJobId() === job.id && readApplyOpen()))
      ? 'compose'
      : 'offer',
  )
  const composing = page === 'compose'
  /** La página de componer se carga la primera vez que se pide y después queda
   * montada: volver y entrar de nuevo no pierde lo que se estaba escribiendo. */
  const [composeSeen, setComposeSeen] = useState(composing)
  const openedComposing = useRef(composing)
  const offerTitleRef = useRef<HTMLHeadingElement>(null)
  const composeTitleRef = useRef<HTMLHeadingElement>(null)
  const [pillRef, pillHeight] = usePillHeight()

  const goCompose = useCallback(() => {
    setComposeSeen(true)
    setPage('compose')
  }, [])
  const goOffer = useCallback(() => setPage('offer'), [])

  /* La página de componer tiene su dirección (`apply=1`) y se escribe sin sumar
     un paso al historial, igual que `job`. Al irse la ficha, se saca. */
  useEffect(() => {
    writeApplyOpen(composing)
  }, [composing])
  useEffect(() => () => writeApplyOpen(false), [])

  /* El foco acompaña a la página: al cambiar, va a su título. */
  const changed = useRef(false)
  useEffect(() => {
    if (!changed.current) {
      changed.current = true
      return
    }
    ;(composing ? composeTitleRef : offerTitleRef).current?.focus()
  }, [composing])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      /* Escape sale de a una página: del mensaje a la oferta, y de ahí cierra. */
      if (composing) goOffer()
      else close()
    }

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [close, composing, goOffer])

  /** Abrir la ficha de una oferta publicada acá cuenta como una vista para su
   * empresa; las scrapeadas no tienen a nadie del otro lado. */
  useEffect(() => {
    const own = offerView(job)
    if (own) track(own)
  }, [job])

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center sm:items-center sm:p-6">
      <m.div
        animate={{ opacity: closing ? 0 : 1 }}
        aria-hidden
        className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        onClick={close}
      />

      {/* Un solo diálogo con dos páginas: al armar el mensaje no se abre otro
          encima, la ficha se ensancha y la página de la oferta se desliza a un
          lado. Con movimiento reducido solo cambia la opacidad. */}
      <m.div
        animate={
          closing
            ? { opacity: 0, y: 24, scale: 0.98, maxWidth: WIDTH[page] }
            : { opacity: 1, y: 0, scale: 1, maxWidth: WIDTH[page] }
        }
        aria-labelledby={composing ? 'apply-title' : 'job-modal-title'}
        aria-modal
        className="relative flex h-[92svh] w-full flex-col overflow-hidden rounded-t-3xl border border-sky/50 bg-surface shadow-[var(--shadow-panel)] supports-[height:1dvh]:h-[92dvh] sm:h-[min(85svh,52rem)] sm:rounded-3xl"
        initial={{
          opacity: 0,
          y: 24,
          scale: 0.98,
          maxWidth: WIDTH[page],
        }}
        role="dialog"
        transition={{
          ...islandTransition,
          maxWidth: reduceMotion ? { duration: 0 } : islandTransition,
        }}
        onAnimationComplete={() => {
          if (closing) onClose()
        }}
      >
        <div className="relative min-h-0 flex-1 overflow-hidden">
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
            {/* En el teléfono el título va a lo ancho y las acciones bajan a su
            propia fila: es lo que evita que el nombre de la empresa se parta
            en dos y que la cabecera se sienta apretada. */}
            <header className="flex flex-col gap-2.5 border-b border-sky/40 px-4 py-3 sm:flex-row sm:items-start sm:gap-3 sm:px-5 sm:py-4">
              <div className="min-w-0 flex-1">
                {isMatch ? (
                  <span className={`${chipClass} mb-2 bg-panel text-onpanel`}>
                    <Target aria-hidden className="size-3.5" />
                    Para vos
                  </span>
                ) : null}
                <h2
                  ref={offerTitleRef}
                  className="text-[19px] leading-snug font-semibold tracking-tight text-ink focus:outline-none"
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
                      <Building2
                        aria-hidden
                        className="size-3.5 shrink-0 text-brand"
                      />
                      {job.company}
                    </button>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin
                      aria-hidden
                      className="size-3.5 shrink-0 text-brand"
                    />
                    {formatLocation(job.city, job.department)}
                  </span>
                  {worked ? <WorkedBadge /> : null}
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-1.5">
                <ShareMenu target={jobShare(job)} />
                <m.button
                  aria-label={
                    isSaved ? 'Quitar de guardadas' : 'Guardar oferta'
                  }
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
                  aria-label={
                    isDismissed ? 'Recuperar oferta' : 'Descartar oferta'
                  }
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
                  onClick={close}
                >
                  <X aria-hidden className="size-4" />
                </m.button>
              </div>
            </header>

            <div
              className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pt-4 pb-[calc(var(--apply-pill,5rem)+1.5rem+env(safe-area-inset-bottom))] sm:space-y-6 sm:px-5 sm:pt-5"
              style={{ '--apply-pill': `${pillHeight}px` } as CSSProperties}
            >
              <JobChips actions={chipActions} job={job} />

              <JobFit job={job} profile={tagActions.profile} />

              <Section title="Descripción">
                {job.description ? (
                  <JobDescription
                    profile={tagActions.profile}
                    text={job.description}
                  />
                ) : (
                  <p className="text-sm text-muted">
                    Esta oferta todavía no tiene la descripción descargada.
                    Suele aparecer en la próxima actualización; mientras tanto
                    podés abrir el aviso original.
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

              {prep.items.length > 0 || roleGuide ? (
                <details className="group rounded-2xl border border-sky/50 bg-surface">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                    <GraduationCap
                      aria-hidden
                      className="size-4 shrink-0 text-brand"
                    />
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
              ) : null}

              {related.company.length > 0 || related.category.length > 0 ? (
                <Section title="Tus postulaciones">
                  <div className="space-y-4 rounded-xl border border-sky/50 px-3 py-3">
                    {related.company.length > 0 ? (
                      <div>
                        <p className="text-sm font-medium text-ink">
                          Ya te postulaste a {related.company.length}{' '}
                          {related.company.length === 1 ? 'puesto' : 'puestos'}{' '}
                          en {job.company}
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
                          {related.category.length === 1
                            ? 'postulación'
                            : 'postulaciones'}{' '}
                          en {job.category_label}
                        </p>
                        <div className="mt-2">
                          <ApplicationList applications={related.category} />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </Section>
              ) : null}

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

            {/* El pie es un pill que flota sobre el borde de abajo, no una franja
            del layout: como hijo del flex se achicaba y scrolleaba. El cuerpo
            reserva su alto (--apply-pill) para que nada quede tapado. */}
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
                onCompose={goCompose}
              />
            </div>
          </m.div>

          {composeSeen ? (
            <m.div
              animate={{
                opacity: composing ? 1 : 0,
                x: composing || reduceMotion ? '0%' : '100%',
              }}
              className="absolute inset-0 flex flex-col"
              initial={
                openedComposing.current
                  ? false
                  : { opacity: 0, x: reduceMotion ? '0%' : '100%' }
              }
              inert={!composing}
              transition={islandTransition}
            >
              <header className="flex items-start gap-2 border-b border-sky/40 px-4 py-3 sm:gap-3 sm:px-5 sm:py-4">
                <button
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-sky/60 px-3 py-2 text-xs font-medium text-soft transition-colors hover:border-brand hover:text-ink"
                  type="button"
                  onClick={goOffer}
                >
                  <ArrowLeft aria-hidden className="size-4" />
                  <span className="hidden sm:inline">Volver a la ficha</span>
                  <span className="sm:hidden">Volver</span>
                </button>
                <div className="min-w-0 flex-1">
                  <h2
                    ref={composeTitleRef}
                    className="text-[19px] leading-snug font-semibold tracking-tight text-ink focus:outline-none"
                    id="apply-title"
                    tabIndex={-1}
                  >
                    Armar mensaje
                  </h2>
                  <p className="mt-0.5 truncate text-sm text-soft">
                    {job.title}
                    {job.company ? ` · ${job.company}` : ''}
                  </p>
                </div>
                <m.button
                  aria-label="Cerrar"
                  className={iconButtonClass}
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={close}
                >
                  <X aria-hidden className="size-4" />
                </m.button>
              </header>

              <Suspense fallback={null}>
                <ApplyMessage
                  job={job}
                  resume={resume}
                  onChangeResume={onChangeResume}
                  onSend={() => {
                    /* Salió a postular: la ficha vuelve a la oferta, donde espera
                     la pregunta de si lo mandó. */
                    flow.begin()
                    goOffer()
                  }}
                />
              </Suspense>
            </m.div>
          ) : null}
        </div>
      </m.div>
    </div>
  )
}
