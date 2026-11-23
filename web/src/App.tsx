import { Loader2 } from 'lucide-react'
import { m } from 'motion/react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { CategoryChips } from './components/board/CategoryChips.tsx'
import { DynamicIsland } from './components/board/DynamicIsland.tsx'
import { FadeUp } from './components/ui/FadeUp.tsx'
import { FilterBar } from './components/board/FilterBar.tsx'
import { RubroPrep } from './components/board/RubroPrep.tsx'
import { RubroResources } from './components/board/RubroResources.tsx'
import { JobCard } from './components/job/JobCard.tsx'
import { JobList } from './components/job/JobList.tsx'
import { ServiceModal } from './components/service/ServiceModal.tsx'
import { Services } from './components/service/Services.tsx'
import { EmployerModal } from './components/employer/EmployerModal.tsx'
import { PracticeDialog } from './components/job/PracticeDialog.tsx'
import {
  EmptyState,
  ErrorState,
  JobListSkeleton,
} from './components/board/States.tsx'
import type { TagActions } from './components/job/JobChips.tsx'
import { SavedTabs } from './components/board/SavedTabs.tsx'
import { ViewTabs } from './components/board/ViewTabs.tsx'
import { useAccountSync } from './hooks/useAccountSync.ts'
import { useFollowUp } from './hooks/useFollowUp.ts'
import { useJobPrefs } from './hooks/useJobPrefs.ts'
import { useJobLink } from './hooks/useJobLink.ts'
import { useJobs } from './hooks/useJobs.ts'
import { useMeta } from './hooks/useMeta.ts'
import { useServiceLink } from './hooks/useServiceLink.ts'
import { useSession } from './hooks/useSession.ts'
import { useViewLink } from './hooks/useViewLink.ts'
import { useCustomFeeds } from './hooks/useCustomFeeds.ts'
import { useEmployers } from './hooks/useEmployers.ts'
import { prefetchMarket, useMarket } from './hooks/useMarket.ts'
import { useNews } from './hooks/useNews.ts'
import { onIdle, usePrefetchViews } from './hooks/usePrefetch.ts'
import { useStats } from './hooks/useStats.ts'
import { useSearchTracking, useTracking } from './hooks/useTracking.ts'
import { useTheme } from './hooks/useTheme.ts'
import { isAbortError, jobsQueryKey } from './lib/api.ts'
import { employerSlug, isWorkedAt } from './lib/employers.ts'
import { parseSearch, withoutToken } from './lib/search.ts'
import {
  loadJob,
  prefetchJobIds,
  prefetchJobs,
  readJob,
} from './lib/jobsCache.ts'
import {
  BOARD_VIEWS,
  type BoardContext,
  jobsQuery,
  keepListView,
} from './lib/query.ts'
import { fadeUpTransition } from './lib/motion.ts'
import { pluralOffers } from './lib/format.ts'
import { readDevFlags } from './lib/dev.ts'
import { isOnboarded } from './lib/profile.ts'
import { filtersFromSearch, mergeReading } from './lib/resume.ts'
import { pickHighlights } from './lib/match.ts'
import { toRanking } from './lib/ranking.ts'
import type { Service } from './lib/services.ts'
import { readViewState } from './lib/url.ts'
import {
  EMPTY_FILTERS,
  type Filters,
  type Application,
  type Job,
  type SavedTab,
  type Tag,
  type View,
  applyTagToFilters,
  groupByCategory,
  hasActiveFilters,
  hiddenCount,
  matchesFilters,
  matchesPreferences,
  preferenceCount,
  togglePreferredTag,
} from './lib/types.ts'

const loadOnboarding = () =>
  import('./components/profile/Onboarding.tsx').then((module) => ({
    default: module.Onboarding,
  }))
const loadMarket = () =>
  import('./components/market/Market.tsx').then((module) => ({
    default: module.Market,
  }))
const loadJobModal = () =>
  import('./components/job/JobModal.tsx').then((module) => ({
    default: module.JobModal,
  }))
const loadTracking = () =>
  import('./components/board/Tracking.tsx').then((module) => ({
    default: module.Tracking,
  }))
const loadNews = () =>
  import('./components/news/News.tsx').then((module) => ({
    default: module.News,
  }))
const loadSelfTest = () =>
  import('./components/test/SelfTest.tsx').then((module) => ({
    default: module.SelfTest,
  }))
const loadHelp = () =>
  import('./components/help/HelpPage.tsx').then((module) => ({
    default: module.HelpPage,
  }))
const loadProfile = () =>
  import('./components/profile/ProfilePage.tsx').then((module) => ({
    default: module.ProfilePage,
  }))

const Onboarding = lazy(loadOnboarding)
const Market = lazy(loadMarket)
const JobModal = lazy(loadJobModal)
const Tracking = lazy(loadTracking)
const News = lazy(loadNews)
const SelfTest = lazy(loadSelfTest)
const HelpPage = lazy(loadHelp)
const ProfilePage = lazy(loadProfile)

/**
 * One line under the tabs saying what each list is for. The shortlist and the
 * follow-up looked interchangeable without it, and they are not: one is before
 * applying and the other is after.
 */
const viewHint = (
  view: View,
  savedTab: SavedTab,
  stateOnly: boolean,
): string => {
  if (view === 'all' && stateOnly)
    return 'Llamados públicos de Uruguay Concursa, ordenados por el que cierra primero.'
  if (view !== 'saved') return ''
  return savedTab === 'tracking'
    ? 'Las que ya mandaste, con el estado de cada una. Tocá una para ver la oferta.'
    : 'Las que marcaste para pensar. Cuando te postulás pasan solas a Seguimiento.'
}

/** La ventana del tablero que mira Novedades para recomendar. */
const NEWS_DAYS = 30

export default function App() {
  /** Read once on mount, so a shared link paints its own section on the first
   * render instead of the board and then a jump. */
  const [linked] = useState(readViewState)
  /** `?dev=onboarding` replays the whole first visit over storage that already
   * has answers in it, which is the only way to look at it twice. It ends
   * where the real one ends: finishing hands the app over as always. */
  const [dev] = useState(readDevFlags)
  const [replayingIntro, setReplayingIntro] = useState(dev.onboarding)
  const [filters, setFilters] = useState<Filters>(linked.filters)
  const [view, setView] = useState<View>(linked.view)
  /** A deliberate detour to look at what was discarded, not a display option:
   * discarding means gone, and this is the way back. */
  const [reviewingDiscarded, setReviewingDiscarded] = useState(false)
  const [onlySimilar, setOnlySimilar] = useState(false)
  /** The saved view filters by rubro on the client, over its own chips. */
  const [savedCategory, setSavedCategory] = useState('')
  const [openJob, setOpenJob] = useState<Job | null>(null)
  /** La oferta que se abrió desde "Armar mensaje" de su tarjeta: la ficha
   * arranca en la página de componer en vez de la oferta. */
  const [composeId, setComposeId] = useState<string | null>(null)
  const openComposer = (job: Job) => {
    setComposeId(job.id)
    setOpenJob(job)
  }
  const closeJob = () => {
    setOpenJob(null)
    setComposeId(null)
  }
  const [openService, setOpenService] = useState<Service | null>(null)
  /** La empresa cuyo stand está abierto, si hay alguna. */
  const [openEmployer, setOpenEmployer] = useState<{
    slug: string
    label: string
  } | null>(null)
  /** Guardadas trae dos listas; cuál se mira va en la URL (`&tab=tracking`). */
  const [savedTab, setSavedTab] = useState<SavedTab>(linked.tab)
  /** Opening a tracked application means fetching the offer behind its
   * snapshot; it may be gone, and then the row says so instead. */
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [goneIds, setGoneIds] = useState<Set<string>>(new Set())
  /** La oferta que se acaba de seguir, para abrir el modal de prÃ¡ctica. */
  const [practiceJob, setPracticeJob] = useState<{
    title: string
    category: string
    label: string
  } | null>(null)

  const prefs = useJobPrefs()
  /** Notas y entrevistas: su propia clave, fuera de lo que viaja por la cuenta. */
  const followUp = useFollowUp()
  /** QuiÃ©n estÃ¡ adentro y quÃ© eligiÃ³ sincronizar. Va acÃ¡, arriba de la isla,
   * porque el sync toca las mismas preferencias que el resto del panel. */
  const session = useSession()
  const accountSync = useAccountSync(prefs, session.user, session.ready)
  const meta = useMeta()
  const employers = useEmployers(filters.category)

  /**
   * Los atajos del buscador (`@empresa`, `puesto:`, …) se leen del texto crudo
   * y pisan al filtro manual de su dimensión. La URL guarda el texto crudo, así
   * que el enlace compartido reproduce la búsqueda.
   */
  const search = parseSearch(filters.q)
  const effectiveFilters: Filters = {
    ...filters,
    ...search.filters,
    q: search.text,
    /* Estado filtra Ofertas; en las demás listas no cuenta ni ensucia. */
    stateOnly: view === 'all' && filters.stateOnly,
  }
  /**
   * Read from storage on the first render, so a first visit paints the intro
   * and never the list underneath it. Until it is done the app is not mounted
   * at all: the list used to load behind the questions and have them dropped
   * on top, which read as an interruption rather than a welcome.
   */
  const showIntro = !isOnboarded(prefs.profile) || replayingIntro
  useTheme(prefs.theme)
  useJobLink(openJob, setOpenJob)
  useServiceLink(openService, setOpenService)
  useViewLink(
    view,
    filters,
    savedTab,
    (state) => {
      setView(state.view)
      setSavedTab(state.tab)
      setFilters(state.filters)
      setSavedCategory('')
      setReviewingDiscarded(false)
    },
    !showIntro,
  )

  const savedIds = [...prefs.saved].sort()
  const discardedIds = [...prefs.dismissed].sort()
  const isSavedView = view === 'saved'
  const isTrackingView = isSavedView && savedTab === 'tracking'
  /** Estado ya no es una vista: es el filtro de Ofertas que deja los llamados
   * de Uruguay Concursa. */
  const isStateView = effectiveFilters.stateOnly
  const isMarketView = view === 'market'
  const isServicesView = view === 'services'
  const isNewsView = view === 'news'
  const isTestView = view === 'test'
  const isProfileView = view === 'profile'
  const isHelpView = view === 'help'
  /** Páginas propias: sin pestañas, con su botón para volver al listado. */
  const isPageView = isNewsView || isTestView || isProfileView || isHelpView
  /**
   * The pile is reviewed in one place only. Discarding works anywhere, but the
   * pile is global: offering it inside Estado would show a count of offers most
   * of which that view cannot list, which is the leak this replaced.
   */
  const canReviewDiscarded = view === 'all'
  const reviewing =
    reviewingDiscarded && canReviewDiscarded && discardedIds.length > 0
  const market = useMarket(isMarketView || isNewsView)
  const customFeeds = useCustomFeeds(prefs.feeds)
  const hasPreferences = preferenceCount(prefs.preferences) > 0
  const similarOnly = onlySimilar && hasPreferences

  /**
   * Everything the person told the app, profile included, turned into what
   * should come first. The API sorts on it, so the order holds over the whole
   * board and not just over the page that happens to be loaded; changing the
   * profile changes this object, which changes the query, which refetches.
   */
  const ranking = toRanking(prefs.preferences, prefs.profile)
  /**
   * Todo lo que decide quÃ© ofertas pide una lista. Sale de acÃ¡ y no de cada
   * vista porque la misma cuenta la necesitan dos: la que se estÃ¡ mirando y la
   * que se va a tocar, que se trae de fondo con esta misma consulta.
   */
  const board: BoardContext = {
    filters: effectiveFilters,
    preferences: prefs.preferences,
    ranking,
    savedIds,
    discardedIds,
    sources: prefs.sources,
    myCompanies: prefs.companies,
    similarOnly,
    reviewing,
  }

  /** Mercado y seguimiento no tienen lista: se queda la Ãºltima para no abortar
   * el pedido ni vaciar lo que ya estaba en cachÃ©. */
  const listViewRef = useRef<View>('all')
  const listView = keepListView(view, listViewRef.current)
  listViewRef.current = listView
  const query = jobsQuery(listView, board)
  const sort = query.sort

  const { jobs, total, status, error, hasMore, loadMore } = useJobs(query, true)

  /** Una lista de guardadas vacÃ­a no tiene nada que adelantar: sabemos sin
   * preguntar que vuelve vacÃ­a. */
  const worthPrefetching = (candidate: View): boolean =>
    candidate !== listView && (candidate !== 'saved' || savedIds.length > 0)

  /** Las otras listas, traÃ­das en el rato libre que deja la primera. */
  const asleep = BOARD_VIEWS.filter(worthPrefetching).map((candidate) =>
    jobsQueryKey(jobsQuery(candidate, board)),
  )
  usePrefetchViews(asleep, !showIntro && status === 'ready')

  /** Estado es otra consulta (fuente + cierre) y si espera a que Ofertas
   * termine siempre llega tarde. Se pide en cuanto hay app, en paralelo. */
  const stateKey = jobsQueryKey(
    jobsQuery('all', {
      ...board,
      filters: { ...board.filters, stateOnly: true },
    }),
  )
  useEffect(() => {
    if (showIntro) return
    prefetchJobs(stateKey)
  }, [showIntro, stateKey])

  /** Al apuntar una pestaÃ±a, antes del clic: lo que tarda en bajar el dedo
   * suele alcanzar para que la lista ya estÃ© cuando se suelta. */
  const trackedKey = prefs.applications.map((entry) => entry.id).join(',')

  /**
   * La consulta de Novedades: el tablero reciente ordenado por encaje. Esa
   * pestaña no tiene filtros manuales propios, así que sale sin ellos; lo que
   * la persona busca ya vive en Preferencias.
   */
  const newsBoard: BoardContext = {
    ...board,
    filters: { ...EMPTY_FILTERS, days: NEWS_DAYS },
    similarOnly: false,
    reviewing: false,
  }
  const newsQuery = jobsQuery('all', newsBoard)
  /** Lo que la persona sigue: sus guardadas y sus postulaciones. */
  const followedIds = [
    ...new Set([...savedIds, ...prefs.applications.map((entry) => entry.id)]),
  ]
  const news = useNews(newsQuery, followedIds, isNewsView)

  const prefetchView = (next: View) => {
    if (next === 'news') {
      void loadNews()
      prefetchMarket()
      prefetchJobs(jobsQueryKey(newsQuery))
    } else if (next === 'market') prefetchMarket()
    else if (next === 'all' || next === 'saved') {
      if (worthPrefetching(next))
        prefetchJobs(jobsQueryKey(jobsQuery(next, board)))
    }
  }

  /** Seguimiento vive dentro de Guardadas: su código y las ofertas detrás de
   * cada postulación se traen antes del clic. */
  const prefetchTracking = () => {
    void loadTracking()
    prefetchJobIds(trackedKey.split(',').filter(Boolean))
  }

  /** La ficha es 20 KB: si se pide al abrir, el clic espera el JS. Se trae
   * apenas hay app, no cuando ya se tocÃ³ una tarjeta. */
  useEffect(() => {
    if (showIntro) return
    void loadJobModal()
  }, [showIntro])

  /** Las filas de seguimiento y las ofertas detrÃ¡s. En esa pestaÃ±a no corre
   * useJobs, asÃ­ que no se espera a que el tablero estÃ© listo. */
  useEffect(() => {
    if (showIntro) return
    const warm = (): void => {
      void loadTracking()
      prefetchJobIds(trackedKey.split(',').filter(Boolean))
    }
    if (isTrackingView) {
      warm()
      return
    }
    if (status !== 'ready') return
    return onIdle(warm)
  }, [showIntro, isTrackingView, status, trackedKey])

  const matches = new Set(
    hasPreferences
      ? jobs.flatMap((job) =>
          matchesPreferences(job, prefs.preferences) ? [job.id] : [],
        )
      : [],
  )

  /**
   * Offers from feeds the person added. The API never sees them, so the same
   * filters are applied here, and they stay in their own group rather than
   * being mixed into a ranking computed over a board they are not part of.
   */
  const feedJobs =
    isSavedView || isStateView || isMarketView || isServicesView || reviewing
      ? []
      : customFeeds.jobs.filter(
          (job) =>
            matchesFilters(job, effectiveFilters) &&
            !prefs.preferences.hiddenCategories.includes(job.category) &&
            (job.department === null ||
              !prefs.preferences.hiddenDepartments.includes(job.department)) &&
            !prefs.dismissed.has(job.id),
        )

  const kept = reviewing
    ? jobs
    : jobs.filter((job) => !prefs.dismissed.has(job.id))
  const highlights = pickHighlights(
    [
      ...(openJob ? [openJob] : []),
      ...feedJobs.filter((job) => job.id !== openJob?.id),
      ...kept.filter((job) => job.id !== openJob?.id),
    ],
    prefs.preferences,
    ranking,
    prefs.profile,
  )
  const savedGroups = isSavedView ? groupByCategory(kept) : []
  const visible =
    isSavedView && savedCategory
      ? kept.filter((job) => job.category === savedCategory)
      : kept
  const discardedHere = jobs.length - kept.length
  const isDirty =
    hasActiveFilters(effectiveFilters) || similarOnly || savedCategory !== ''

  const reset = () => {
    setFilters(EMPTY_FILTERS)
    setOnlySimilar(false)
    setSavedCategory('')
  }

  /** Chips act on the list they are in: the rubro of a saved offer narrows the
   * saved view, everything else goes through the filters. */
  const tagActions: TagActions = {
    preferences: prefs.preferences,
    profile: prefs.profile,
    onFilter: (tag: Tag) => {
      if (isSavedView && tag.dimension === 'category')
        return setSavedCategory(tag.value)
      setFilters((current) => applyTagToFilters(current, tag))
    },
    onTogglePreferred: (tag: Tag) =>
      prefs.setPreferences(togglePreferredTag(prefs.preferences, tag)),
  }

  const usage = {
    saved: prefs.saved.size,
    applications: prefs.applications.length,
    interviews: prefs.applications.filter(
      (entry) => entry.status === 'interview',
    ).length,
    closed: prefs.applications.filter((entry) => entry.status === 'closed')
      .length,
    sources: prefs.sources,
  }

  useStats(prefs.profile, usage, prefs.statsSentAt, prefs.markStatsSent)
  useTracking(prefs.profile.shareStats)
  useSearchTracking(effectiveFilters, total, status === 'ready')

  /** Las empresas que la persona cargó como suyas: solo marcan la oferta. */
  const workedSlugs = new Set(prefs.companies)
  const workedAt = (job: Job) => isWorkedAt(job.company, workedSlugs)

  /** Abre el stand de la empresa de una oferta, si tiene una. */
  const openEmployerFor = (job: Job) => {
    if (job.company)
      setOpenEmployer({ slug: employerSlug(job.company), label: job.company })
  }

  /** Confirmar una postulación la suma al seguimiento y, si está pedido, abre
   * el modal para practicar. */
  const handleApplied = (job: Job) => {
    prefs.addApplication(job)
    if (prefs.practiceAlways) {
      setPracticeJob({
        title: job.title,
        category: job.category,
        label: job.category_label,
      })
    }
  }

  const openTracked = (application: Application) => {
    const cached = readJob(application.id)
    if (cached) {
      setOpenJob(cached)
      return
    }

    setOpeningId(application.id)
    loadJob(application.id)
      .then((job) => setOpenJob(job))
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return
        setGoneIds((current) => new Set(current).add(application.id))
      })
      .finally(() => setOpeningId(null))
  }

  const changeView = (next: View) => {
    setView(next)
    setSavedTab('saved')
    setSavedCategory('')
    setReviewingDiscarded(false)
  }

  /* Deliberately not animated as a whole. A transform here would make this
     div the containing block for every fixed child, which put the job sheet
     thousands of pixels down the page on a phone and shifted the island; and
     an entrance that never finished would leave the whole app invisible. The
     intro fades itself out onto this same background, and each section below
     brings its own entrance. */
  return (
    <div className="min-h-svh">
      <DynamicIsland
        count={
          preferenceCount(prefs.preferences) + hiddenCount(prefs.preferences)
        }
        view={view}
        onOpenHelp={() => changeView('help')}
        onOpenNews={() => changeView('news')}
        onOpenProfile={() => changeView('profile')}
        onPrefetchHelp={() => void loadHelp()}
        onPrefetchNews={() => prefetchView('news')}
        onPrefetchProfile={() => void loadProfile()}
      />

      <main className="mx-auto max-w-3xl px-5 pt-24 pb-16 sm:pt-28">
        {/* Perfil, novedades, ayuda y el test son páginas aparte, no pestañas
            más: cada una tiene su enlace, no lleva pestañas y salir (o el botón
            Atrás) lleva al listado. */}
        {isPageView ? null : (
          <>
            <h1 className="sr-only">JobIt: ofertas de trabajo en Uruguay</h1>
            <FadeUp>
              <ViewTabs
                savedCount={prefs.saved.size + prefs.applications.length}
                view={view}
                onChange={changeView}
                onPrefetch={prefetchView}
              />
            </FadeUp>
          </>
        )}

        {isSavedView ? (
          <FadeUp delay={0.02}>
            <SavedTabs
              savedCount={prefs.saved.size}
              tab={savedTab}
              trackedCount={prefs.applications.length}
              onChange={(tab) => {
                setSavedTab(tab)
                setSavedCategory('')
              }}
              onPrefetchTracking={prefetchTracking}
            />
          </FadeUp>
        ) : null}

        {viewHint(view, savedTab, isStateView) ? (
          <FadeUp delay={0.03}>
            <p className="mt-3 px-1 text-xs leading-relaxed text-muted">
              {viewHint(view, savedTab, isStateView)}
            </p>
          </FadeUp>
        ) : null}

        {isProfileView ? (
          <Suspense fallback={<JobListSkeleton />}>
            <ProfilePage
              categories={meta?.categories ?? []}
              counts={{
                saved: prefs.saved.size,
                applications: prefs.applications.length,
                dismissed: prefs.dismissed.size,
              }}
              departments={meta?.departments ?? []}
              feedResults={customFeeds.results}
              feeds={prefs.feeds}
              feedsLoading={customFeeds.loading}
              meta={meta}
              preferences={prefs.preferences}
              profile={prefs.profile}
              resume={prefs.resume}
              session={session}
              sources={prefs.sources}
              sync={accountSync}
              theme={prefs.theme}
              usage={usage}
              onBack={() => changeView('all')}
              onChangePreferences={prefs.setPreferences}
              onChangeProfile={prefs.setProfile}
              onChangeResume={prefs.setResume}
              onChangeSources={prefs.setSources}
              onChangeFeeds={prefs.setFeeds}
              onChangeTheme={prefs.setTheme}
              onEraseEverything={() => {
                prefs.eraseEverything()
                followUp.erase()
              }}
              onImportCv={(nextProfile, nextPreferences, found) => {
                prefs.setProfile(nextProfile)
                prefs.setPreferences(nextPreferences)
                prefs.setResume(mergeReading(prefs.resume, found))
              }}
              onOpenTest={() => changeView('test')}
              onPrefetchTest={() => void loadSelfTest()}
              onSearchBoard={() => {
                changeView('all')
                setFilters(filtersFromSearch(prefs.resume, prefs.preferences))
              }}
            />
          </Suspense>
        ) : isHelpView ? (
          <Suspense fallback={<JobListSkeleton />}>
            <HelpPage onBack={() => changeView('all')} />
          </Suspense>
        ) : isTrackingView ? (
          <div className="mt-6">
            <FadeUp delay={0.05}>
              <Suspense fallback={<JobListSkeleton />}>
                <Tracking
                  applications={prefs.applications}
                  followUp={followUp}
                  goneIds={goneIds}
                  openingId={openingId}
                  onOpen={openTracked}
                  onPractice={(entry) =>
                    setPracticeJob({
                      title: entry.title,
                      category: entry.category,
                      label: entry.categoryLabel,
                    })
                  }
                  onRemove={(id) => {
                    prefs.removeApplication(id)
                    followUp.removeForApplication(id)
                  }}
                  onSetStatus={prefs.setApplicationStatus}
                />
              </Suspense>
            </FadeUp>
          </div>
        ) : isTestView ? (
          <Suspense fallback={<JobListSkeleton />}>
            <SelfTest
              categories={meta?.categories ?? []}
              onBack={() => changeView('all')}
              onExploreCategory={(category) => {
                changeView('all')
                setFilters({ ...EMPTY_FILTERS, category })
              }}
            />
          </Suspense>
        ) : isServicesView ? (
          <Services active={!showIntro} onOpen={setOpenService} />
        ) : isMarketView ? (
          <div className="mt-6">
            {market.status === 'error' ? (
              <ErrorState message="No se pudieron cargar las estadÃ­sticas del mercado." />
            ) : market.report ? (
              <Suspense fallback={<JobListSkeleton />}>
                <Market
                  report={market.report}
                  onExploreCategory={(category) => {
                    setView('all')
                    setFilters({ ...EMPTY_FILTERS, category })
                  }}
                  onSearch={(q) => {
                    setView('all')
                    setFilters({ ...EMPTY_FILTERS, q })
                  }}
                />
              </Suspense>
            ) : (
              <JobListSkeleton />
            )}
          </div>
        ) : isNewsView ? (
          <div className="mt-6">
            <Suspense fallback={<JobListSkeleton />}>
              <News
                followed={news.followed}
                jobs={news.jobs}
                market={market.report}
                preferences={prefs.preferences}
                profile={prefs.profile}
                status={news.status}
                onBack={() => changeView('all')}
                onExplore={(category) => {
                  setView('all')
                  setFilters({ ...EMPTY_FILTERS, category })
                }}
                onOpen={setOpenJob}
              />
            </Suspense>
          </div>
        ) : (
          <>
            <div className="mt-3">
              <FilterBar
                categories={meta?.categories ?? []}
                departments={meta?.departments ?? []}
                employers={employers}
                myCompaniesCount={prefs.companies.length}
                searchTokens={search.tokens}
                onRemoveToken={(raw) =>
                  setFilters((current) => ({
                    ...current,
                    q: withoutToken(current.q, raw),
                  }))
                }
                canReviewDiscarded={canReviewDiscarded}
                discardedCount={prefs.dismissed.size}
                filters={filters}
                hasPreferences={hasPreferences}
                isDirty={isDirty}
                matchCount={similarOnly ? total : matches.size}
                noExperienceCount={meta?.no_experience_count ?? 0}
                onlySimilar={similarOnly}
                reviewingDiscarded={reviewing}
                showCategory={!isSavedView}
                showState={view === 'all'}
                onChange={setFilters}
                onReset={reset}
                onToggleReviewDiscarded={() =>
                  setReviewingDiscarded((current) => !current)
                }
                onToggleSimilar={() => setOnlySimilar((current) => !current)}
              />
            </div>

            {isSavedView && savedGroups.length > 1 ? (
              <div className="mt-3">
                <CategoryChips
                  groups={savedGroups}
                  selected={savedCategory}
                  onSelect={setSavedCategory}
                />
              </div>
            ) : null}

            {filters.category && meta ? (
              <div className="mt-3">
                <FadeUp>
                  <RubroPrep
                    category={filters.category}
                    label={
                      meta.categories.find(
                        (entry) => entry.value === filters.category,
                      )?.label ?? filters.category
                    }
                  />
                </FadeUp>
              </div>
            ) : null}

            {filters.category && meta ? (
              <div className="mt-2">
                <FadeUp>
                  <RubroResources
                    category={filters.category}
                    label={
                      meta.categories.find(
                        (entry) => entry.value === filters.category,
                      )?.label ?? filters.category
                    }
                  />
                </FadeUp>
              </div>
            ) : null}

            <div className="mt-6 mb-3 flex h-5 items-center px-1 text-xs text-muted">
              {status === 'ready' || status === 'loadingMore' ? (
                <m.span
                  key={`${total}-${visible.length}-${discardedHere}-${sort}`}
                  animate={{ opacity: 1 }}
                  initial={{ opacity: 0 }}
                  transition={fadeUpTransition}
                >
                  {pluralOffers(total)}
                  {visible.length < total
                    ? ` · mostrando ${visible.length}`
                    : ''}
                  {discardedHere > 0 ? ` · ${discardedHere} descartadas` : ''}
                  {sort === 'match' ? ' · ordenadas para vos' : ''}
                  {sort === 'closing' ? ' · las que cierran primero' : ''}
                </m.span>
              ) : null}
            </div>

            {reviewing ? (
              <FadeUp>
                <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-sky/60 bg-mist px-3.5 py-2.5">
                  <p className="text-xs leading-relaxed text-soft">
                    {prefs.dismissed.size === 1
                      ? 'EstÃ¡s viendo la oferta que descartaste.'
                      : `EstÃ¡s viendo las ${prefs.dismissed.size} ofertas que descartaste.`}{' '}
                    TocÃ¡ el Ã­cono de deshacer en cualquiera para devolverla a
                    la lista.
                  </p>
                  <button
                    className="ml-auto shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface hover:text-ink"
                    type="button"
                    onClick={() => setReviewingDiscarded(false)}
                  >
                    Volver
                  </button>
                </div>
              </FadeUp>
            ) : null}

            {feedJobs.length > 0 ? (
              <FadeUp>
                <section className="mb-6">
                  <h2 className="mb-3 flex items-baseline gap-2 px-1">
                    <span className="text-sm font-semibold tracking-tight text-ink">
                      De tus fuentes
                    </span>
                    <span className="text-xs text-muted tabular-nums">
                      {feedJobs.length}
                    </span>
                  </h2>
                  <div className="isolate space-y-3">
                    {feedJobs.map((job) => (
                      <JobCard
                        key={job.id}
                        isApplied={prefs.appliedIds.has(job.id)}
                        isDismissed={prefs.dismissed.has(job.id)}
                        isMatch={highlights.has(job.id)}
                        isSaved={prefs.saved.has(job.id)}
                        job={job}
                        tagActions={tagActions}
                        onApplied={handleApplied}
                        onCompose={openComposer}
                        onOpen={setOpenJob}
                        onOpenEmployer={() => openEmployerFor(job)}
                        onToggleDismissed={prefs.toggleDismissed}
                        onToggleSaved={prefs.toggleSaved}
                        worked={workedAt(job)}
                      />
                    ))}
                  </div>
                </section>
              </FadeUp>
            ) : null}

            {status === 'loading' ? <JobListSkeleton /> : null}
            {status === 'error' && error ? (
              <ErrorState message={error} />
            ) : null}

            {status !== 'loading' && status !== 'error' ? (
              visible.length === 0 && feedJobs.length === 0 ? (
                <FadeUp>
                  <EmptyState
                    canReset={isDirty}
                    hidden={hiddenCount(prefs.preferences)}
                    similar={similarOnly}
                    stateOnly={isStateView}
                    view={view}
                    onReset={reset}
                  />
                </FadeUp>
              ) : (
                <>
                  <JobList
                    key={listView}
                    byCategory={isSavedView && savedCategory === ''}
                    jobs={visible}
                    renderJob={(job) => (
                      <JobCard
                        isApplied={prefs.appliedIds.has(job.id)}
                        isDismissed={prefs.dismissed.has(job.id)}
                        isMatch={highlights.has(job.id)}
                        isSaved={prefs.saved.has(job.id)}
                        job={job}
                        tagActions={tagActions}
                        onApplied={handleApplied}
                        onCompose={openComposer}
                        onOpen={setOpenJob}
                        onOpenEmployer={() => openEmployerFor(job)}
                        onToggleDismissed={prefs.toggleDismissed}
                        onToggleSaved={prefs.toggleSaved}
                        worked={workedAt(job)}
                      />
                    )}
                  />

                  {hasMore ? (
                    <div className="mt-6 flex justify-center">
                      <m.button
                        className="inline-flex items-center gap-2 rounded-xl border border-sky/70 bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-mist disabled:opacity-60"
                        disabled={status === 'loadingMore'}
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={loadMore}
                      >
                        {status === 'loadingMore' ? (
                          <Loader2
                            aria-hidden
                            className="size-4 animate-spin"
                          />
                        ) : null}
                        Ver mÃ¡s ofertas
                      </m.button>
                    </div>
                  ) : null}
                </>
              )
            ) : null}
          </>
        )}
      </main>

      {openJob ? (
        <Suspense fallback={null}>
          <JobModal
            key={openJob.id}
            applications={prefs.applications}
            isApplied={prefs.appliedIds.has(openJob.id)}
            isDismissed={prefs.dismissed.has(openJob.id)}
            isMatch={highlights.has(openJob.id)}
            isSaved={prefs.saved.has(openJob.id)}
            job={openJob}
            tagActions={tagActions}
            resume={prefs.resume}
            startComposing={composeId === openJob.id}
            onApplied={handleApplied}
            onChangeResume={prefs.setResume}
            onClose={closeJob}
            onOpenEmployer={() => openEmployerFor(openJob)}
            onToggleDismissed={prefs.toggleDismissed}
            onToggleSaved={prefs.toggleSaved}
            worked={workedAt(openJob)}
          />
        </Suspense>
      ) : null}

      {openEmployer ? (
        <EmployerModal
          slug={openEmployer.slug}
          label={openEmployer.label}
          worked={prefs.companies.includes(openEmployer.slug)}
          onToggleWorked={() => {
            const { slug } = openEmployer
            prefs.setCompanies(
              prefs.companies.includes(slug)
                ? prefs.companies.filter((entry) => entry !== slug)
                : [...prefs.companies, slug],
            )
          }}
          onFilter={() => {
            setFilters({ ...EMPTY_FILTERS, company: openEmployer.slug })
            setOpenEmployer(null)
            closeJob()
          }}
          onClose={() => setOpenEmployer(null)}
        />
      ) : null}

      {practiceJob ? (
        <PracticeDialog
          title={practiceJob.title}
          category={practiceJob.category}
          label={practiceJob.label}
          practiceAlways={prefs.practiceAlways}
          onPracticeAlwaysChange={prefs.setPracticeAlways}
          onClose={() => setPracticeJob(null)}
        />
      ) : null}

      {/* La intro es una capa sobre la app, no una pantalla que la reemplace:
          asÃ­ el tablero se pide y se dibuja igual, y un buscador que entra con
          el storage vacÃ­o ve ofertas y no solo "Bienvenido a JobIt". */}
      {showIntro ? (
        <Suspense fallback={null}>
          <Onboarding
            categories={meta?.categories ?? []}
            departments={meta?.departments ?? []}
            preferences={prefs.preferences}
            profile={prefs.profile}
            showWelcome={prefs.introSeenAt === '' || replayingIntro}
            onFinish={(profile, preferences) => {
              setReplayingIntro(false)
              prefs.completeOnboarding(profile, preferences)
            }}
            onWelcomeSeen={prefs.markIntroSeen}
          />
        </Suspense>
      ) : null}

      {openService ? (
        <ServiceModal
          key={openService.id}
          service={openService}
          onClose={() => setOpenService(null)}
        />
      ) : null}
    </div>
  )
}
