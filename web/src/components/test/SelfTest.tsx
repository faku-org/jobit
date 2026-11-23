import {
  ArrowLeft,
  ArrowRight,
  Compass,
  Info,
  Pause,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { badgeModel } from '../../lib/badge.ts'
import { testDoneEvent } from '../../lib/events.ts'
import {
  ANSWER_SCALE,
  type Answer,
  type Answers,
  ITEM_COUNT,
  PAGE_COUNT,
  READING,
  TRAITS,
  type TraitScore,
  answeredCount,
  clearTest,
  firstOpenPage,
  levelPhrase,
  pageItems,
  readTest,
  scoreTest,
  standouts,
  suggestRubros,
  writeTest,
} from '../../lib/selfTest.ts'
import { track } from '../../lib/track.ts'
import type { Facet } from '../../lib/types.ts'
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx'
import { Badge } from './Badge.tsx'
import { Radar } from './Radar.tsx'

interface SelfTestProps {
  /** Para ponerle nombre a los rubros sugeridos; sin esto se ve el slug. */
  categories: Facet[]
  /** Lleva al tablero con ese rubro ya elegido. */
  onExploreCategory: (slug: string) => void
  onBack: () => void
}

type Phase = 'intro' | 'questions' | 'result'

const primaryButton =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-panel px-4 py-2 text-sm font-semibold text-onpanel transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
const secondaryButton =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-sky/60 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
const dangerButton =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-danger/40 bg-danger/8 px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/16 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
const linkButton =
  'inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

/** El aviso que va antes de empezar y de nuevo en el resultado. */
function Notice() {
  return (
    <div className="flex gap-2.5 rounded-xl bg-mist px-3.5 py-3">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
      <p className="text-xs leading-relaxed text-soft">
        <strong className="font-semibold text-ink">
          No es un psicotécnico ni un diagnóstico.
        </strong>{' '}
        Es una guía para conocerte mejor y pensar qué tipo de trabajo te queda
        cómodo. Ninguna empresa lo ve ni lo pide, y no reemplaza la opinión de
        una persona profesional.
      </p>
    </div>
  )
}

function Card({
  children,
  label,
}: {
  children: React.ReactNode
  label?: string
}) {
  return (
    <section
      aria-label={label}
      className="rounded-2xl border border-sky/50 bg-surface p-5 shadow-[var(--shadow-card)]"
    >
      {children}
    </section>
  )
}

export function SelfTest({
  categories,
  onExploreCategory,
  onBack,
}: SelfTestProps) {
  const [stored] = useState(readTest)
  const [answers, setAnswers] = useState<Answers>(stored.answers)
  const [reported, setReported] = useState(stored.reported)
  const [phase, setPhase] = useState<Phase>(() =>
    answeredCount(stored.answers) === ITEM_COUNT ? 'result' : 'intro',
  )
  const [page, setPage] = useState(() => firstOpenPage(stored.answers))
  /** Recién después de apretar "Siguiente" con algo sin contestar se marcan
   * las que faltan: antes de eso no se le reclama nada a nadie. */
  const [attempted, setAttempted] = useState(false)
  const [confirmingErase, setConfirmingErase] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)

  const items = pageItems(page)
  const missing = items.filter((entry) => answers[entry.id] === undefined)
  const answered = answeredCount(answers)
  const scores = useMemo(() => scoreTest(answers), [answers])

  /* El foco va al título de cada pantalla: quien usa teclado o lector no se
     queda parado en un botón que ya no está. */
  useEffect(() => {
    heading.current?.focus()
    window.scrollTo({ top: 0 })
  }, [phase, page])

  const save = (next: Answers, nextReported = reported) => {
    setAnswers(next)
    writeTest({ answers: next, reported: nextReported })
  }

  const choose = (id: string, value: Answer) =>
    save({ ...answers, [id]: value })

  const focusItem = (id: string) => {
    document
      .querySelector<HTMLInputElement>(`input[name="${CSS.escape(id)}"]`)
      ?.focus()
  }

  const start = () => {
    setAttempted(false)
    setPage(firstOpenPage(answers))
    setPhase('questions')
  }

  const next = () => {
    if (missing.length > 0) {
      setAttempted(true)
      const [first] = missing
      if (first) focusItem(first.id)
      return
    }
    setAttempted(false)
    if (page < PAGE_COUNT - 1) {
      setPage(page + 1)
      return
    }
    /* El aviso de "completado" sale una vez por tanda y sin contenido: ni las
       respuestas ni los puntajes tienen camino hacia la API. */
    if (!reported) {
      track(testDoneEvent())
      setReported(true)
      writeTest({ answers, reported: true })
    }
    setPhase('result')
  }

  const previous = () => {
    setAttempted(false)
    setPage(Math.max(0, page - 1))
  }

  const restart = () => {
    setConfirmingErase(false)
    setAttempted(false)
    setReported(false)
    setAnswers({})
    clearTest()
    setPage(0)
    setPhase('intro')
  }

  const eraseAndLeave = () => {
    clearTest()
    setAnswers({})
    setReported(false)
    setConfirmingErase(false)
    onBack()
  }

  const titleClass =
    'text-xl font-semibold tracking-tight text-ink outline-none sm:text-2xl'

  if (phase === 'intro') {
    const resuming = answered > 0
    return (
      <div className="mt-6 space-y-4">
        <button className={linkButton} type="button" onClick={onBack}>
          <ArrowLeft aria-hidden className="size-3.5" />
          Volver a las ofertas
        </button>

        <Card>
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-mist text-brand">
              <Compass aria-hidden className="size-5" />
            </span>
            <div>
              <h1 ref={heading} className={titleClass} tabIndex={-1}>
                Test de autoconocimiento laboral
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {ITEM_COUNT} frases, unos 10 minutos. Contestás qué tanto te
                describe cada una y al final ves cinco rasgos con una lectura en
                criollo y los rubros del tablero que suelen encajar.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <Notice />
            <p className="text-xs leading-relaxed text-muted">
              Tus respuestas se guardan{' '}
              <strong>solo en este dispositivo</strong>, para que puedas pausar
              y seguir otro día. No se suben a ningún servidor, y si borrás los
              datos del navegador se van con ellos.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <button className={primaryButton} type="button" onClick={start}>
                {resuming ? 'Seguir donde dejé' : 'Empezar'}
                <ArrowRight aria-hidden className="size-4" />
              </button>
              {resuming ? (
                <>
                  <span className="text-xs text-muted tabular-nums">
                    {answered} de {ITEM_COUNT} respondidas
                  </span>
                  <button
                    className={linkButton}
                    type="button"
                    onClick={restart}
                  >
                    <RotateCcw aria-hidden className="size-3.5" />
                    Empezar de cero
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </Card>
      </div>
    )
  }

  if (phase === 'questions') {
    const percent = Math.round((answered / ITEM_COUNT) * 100)
    const firstIndex = page * items.length

    return (
      <div className="mt-6 space-y-4">
        <Card>
          <h1 ref={heading} className={titleClass} tabIndex={-1}>
            Parte {page + 1} de {PAGE_COUNT}
          </h1>
          <p className="mt-1 text-xs text-muted">
            Contestá qué tanto te describe cada frase, pensando en cómo sos en
            general y no en un día puntual. No hay respuestas correctas.
          </p>

          <div
            aria-label="Avance del test"
            aria-valuemax={ITEM_COUNT}
            aria-valuemin={0}
            aria-valuenow={answered}
            aria-valuetext={`${answered} de ${ITEM_COUNT} respondidas`}
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-mist"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-brand transition-[width]"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-muted tabular-nums">
            {answered} de {ITEM_COUNT} respondidas
          </p>
        </Card>

        {items.map((entry, index) => {
          const value = answers[entry.id]
          const isMissing = attempted && value === undefined
          return (
            <fieldset
              key={entry.id}
              aria-invalid={isMissing || undefined}
              className={`rounded-2xl border bg-surface p-4 ${
                isMissing ? 'border-red-500/70' : 'border-sky/50'
              }`}
            >
              <legend className="sr-only">
                Frase {firstIndex + index + 1} de {ITEM_COUNT}: {entry.text}
              </legend>
              <p
                aria-hidden
                className="text-sm leading-relaxed font-medium text-ink"
              >
                <span className="mr-1.5 text-xs text-muted tabular-nums">
                  {firstIndex + index + 1}.
                </span>
                {entry.text}
              </p>

              <div className="mt-3 grid grid-cols-5 gap-1.5">
                {ANSWER_SCALE.map((option) => {
                  const checked = value === option.value
                  return (
                    <label
                      key={option.value}
                      className={`flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1.5 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand ${
                        checked
                          ? 'border-panel bg-panel text-onpanel'
                          : 'border-sky/60 text-ink hover:bg-mist'
                      }`}
                    >
                      <input
                        checked={checked}
                        className="sr-only"
                        name={entry.id}
                        type="radio"
                        value={option.value}
                        onChange={() => choose(entry.id, option.value)}
                      />
                      <span className="text-sm font-semibold tabular-nums">
                        {option.value}
                      </span>
                      <span className="text-[10px] leading-tight sm:text-[11px]">
                        {option.label}
                      </span>
                    </label>
                  )
                })}
              </div>

              {isMissing ? (
                <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                  Esta falta contestar.
                </p>
              ) : null}
            </fieldset>
          )
        })}

        <div aria-live="polite" className="px-1">
          {attempted && missing.length > 0 ? (
            <p className="text-xs leading-relaxed text-ink">
              Todavía falta{missing.length === 1 ? '' : 'n'} {missing.length}{' '}
              por contestar en esta parte:{' '}
              {missing.map((entry, position) => {
                const number = firstIndex + items.indexOf(entry) + 1
                return (
                  <span key={entry.id}>
                    {position > 0 ? ', ' : ''}
                    <button
                      className="font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-brand"
                      type="button"
                      onClick={() => focusItem(entry.id)}
                    >
                      la {number}
                    </button>
                  </span>
                )
              })}
              .
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {page > 0 ? (
              <button
                className={secondaryButton}
                type="button"
                onClick={previous}
              >
                <ArrowLeft aria-hidden className="size-4" />
                Anterior
              </button>
            ) : null}
            <button className={secondaryButton} type="button" onClick={onBack}>
              <Pause aria-hidden className="size-4" />
              Pausar y seguir después
            </button>
          </div>
          <button className={primaryButton} type="button" onClick={next}>
            {page < PAGE_COUNT - 1 ? 'Siguiente' : 'Ver mi resultado'}
            <ArrowRight aria-hidden className="size-4" />
          </button>
        </div>
        <p className="px-1 text-[11px] text-muted">
          Al pausar, lo que contestaste queda guardado en este dispositivo.
        </p>
      </div>
    )
  }

  return (
    <Result
      categories={categories}
      confirmingErase={confirmingErase}
      headingRef={heading}
      scores={scores ?? []}
      titleClass={titleClass}
      onBack={onBack}
      onCancelErase={() => setConfirmingErase(false)}
      onConfirmErase={eraseAndLeave}
      onExploreCategory={onExploreCategory}
      onRestart={restart}
      onStartErase={() => setConfirmingErase(true)}
    />
  )
}

function Result({
  scores,
  categories,
  confirmingErase,
  headingRef,
  titleClass,
  onBack,
  onExploreCategory,
  onRestart,
  onStartErase,
  onCancelErase,
  onConfirmErase,
}: {
  scores: TraitScore[]
  categories: Facet[]
  confirmingErase: boolean
  headingRef: React.RefObject<HTMLHeadingElement | null>
  titleClass: string
  onBack: () => void
  onExploreCategory: (slug: string) => void
  onRestart: () => void
  onStartErase: () => void
  onCancelErase: () => void
  onConfirmErase: () => void
}) {
  const labelOf = (slug: string): string =>
    categories.find((facet) => facet.value === slug)?.label ?? slug
  const rubros = suggestRubros(scores)
  const top = standouts(scores)
  const badge = badgeModel(scores)
  const eraseButton = useRef<HTMLButtonElement>(null)

  return (
    <div className="mt-6 space-y-4">
      <button className={linkButton} type="button" onClick={onBack}>
        <ArrowLeft aria-hidden className="size-3.5" />
        Volver a las ofertas
      </button>

      <Card>
        <h1 ref={headingRef} className={titleClass} tabIndex={-1}>
          Tu resultado
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Cinco rasgos, cada uno de 0 a 100 sobre la escala del propio test. No
          hay uno mejor que otro: cada punto del medio o de los extremos le
          queda cómodo a trabajos distintos.
        </p>
        <div className="mt-4">
          <Notice />
        </div>
      </Card>

      <Card label="Tu perfil en un gráfico">
        <h2 className="text-sm font-semibold tracking-tight text-ink">
          Tu perfil de un vistazo
        </h2>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          Cuanto más lejos del centro, más cerca del extremo que nombra el
          rasgo. No hay una forma mejor que otra.
        </p>
        <div className="mt-3">
          <Radar scores={scores} />
        </div>
      </Card>

      <Card label="Los cinco rasgos">
        <ul className="space-y-5">
          {TRAITS.map((trait) => {
            const score = scores.find((entry) => entry.key === trait.key)
            if (!score) return null
            const highlighted = top.some((entry) => entry.key === trait.key)
            return (
              <li key={trait.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-sm font-semibold text-ink">
                    {trait.label}
                    {highlighted ? (
                      <span className="ml-2 rounded-full bg-mist px-2 py-0.5 text-[10px] font-medium text-soft">
                        Se nota más
                      </span>
                    ) : null}
                  </h2>
                  <span className="text-xs text-muted tabular-nums">
                    {score.percent} / 100
                  </span>
                </div>

                <div
                  aria-label={`${trait.label}: ${score.percent} de 100. ${levelPhrase(score)}`}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={score.percent}
                  className="mt-2 h-2 overflow-hidden rounded-full bg-mist"
                  role="meter"
                >
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${score.percent}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-muted">
                  <span>{trait.low}</span>
                  <span>{trait.high}</span>
                </div>

                <p className="mt-2 text-xs font-semibold text-ink">
                  {levelPhrase(score)}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-soft">
                  {READING[trait.key][score.level]}
                </p>
              </li>
            )
          })}
        </ul>
      </Card>

      <Card label="Rubros sugeridos">
        <h2 className="text-sm font-semibold tracking-tight text-ink">
          Rubros que suelen encajar con este perfil
        </h2>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          Son orientaciones de sentido común, no una lista de lo que podés o no
          podés hacer. Tocá uno para ver sus ofertas.
        </p>
        {rubros.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {rubros.map((rubro) => (
              <button
                key={rubro.slug}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-sky/60 px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                type="button"
                onClick={() => onExploreCategory(rubro.slug)}
              >
                <Search aria-hidden className="size-3.5 text-brand" />
                {labelOf(rubro.slug)}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-sky/60 px-3.5 py-3 text-xs leading-relaxed text-muted">
            Tu perfil queda parejo y ningún rubro se despega de los demás. Mirá
            todas las ofertas y elegí por lo que más te interese.
          </p>
        )}
      </Card>

      {badge ? (
        <Card label="Tu badge">
          <h2 className="text-sm font-semibold tracking-tight text-ink">
            Tu badge
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            Una imagen con tu rasgo más marcado, para guardarla o mandarla. Se
            arma en tu navegador: no se sube a ningún lado y JobIt no se entera.
            Lo que muestra lo ve quien la reciba, así que compartila si querés.
          </p>
          <div className="mt-4">
            <Badge model={badge} />
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button className={primaryButton} type="button" onClick={onBack}>
          Volver a las ofertas
        </button>
        <button className={secondaryButton} type="button" onClick={onRestart}>
          <RotateCcw aria-hidden className="size-4" />
          Repetir el test
        </button>
        <button
          ref={eraseButton}
          className={dangerButton}
          type="button"
          onClick={onStartErase}
        >
          <Trash2 aria-hidden className="size-4" />
          Borrar mis respuestas
        </button>
      </div>

      <ConfirmDialog
        confirmLabel="Sí, borrar"
        open={confirmingErase}
        returnFocusTo={eraseButton}
        title="¿Borrar tus respuestas?"
        onCancel={onCancelErase}
        onConfirm={onConfirmErase}
      >
        Se borran las {ITEM_COUNT} respuestas y el resultado de este
        dispositivo, y no se pueden recuperar: JobIt no guarda una copia. Para
        volver a verlo tenés que hacer el test de nuevo.
      </ConfirmDialog>
    </div>
  )
}
