import { ShieldCheck, UserRound } from 'lucide-react'
import { type ReactNode, useEffect } from 'react'
import type { AccountSync } from '../../hooks/useAccountSync.ts'
import type { CustomFeed, FeedResult } from '../../lib/feed.ts'
import type { Profile } from '../../lib/profile.ts'
import type { Resume, ResumeFound } from '../../lib/resume.ts'
import type { SessionUser } from '../../lib/session.ts'
import type { Usage } from '../../lib/stats.ts'
import type { Facet, Meta, Preferences, Theme } from '../../lib/types.ts'
import { AccountSection } from '../account/AccountSection.tsx'
import { McpSection } from '../account/McpSection.tsx'
import { PageHeader } from '../page/PageHeader.tsx'
import { PreferencesPanel, SourcesPanel } from './Preferences.tsx'
import {
  AppearanceBlock,
  CvBlock,
  PrivacyBlock,
  ProfileBasics,
  TestEntry,
} from './ProfileBlocks.tsx'

interface ProfilePageProps {
  meta: Meta | null
  categories: Facet[]
  departments: Facet[]
  preferences: Preferences
  sources: string[]
  feeds: CustomFeed[]
  feedResults: FeedResult[]
  feedsLoading: boolean
  theme: Theme
  profile: Profile
  usage: Usage
  /** Lo que la zona de borrado se llevaría, para decirlo antes de hacerlo. */
  counts: { saved: number; applications: number; dismissed: number }
  /** La sesión y el sync se resuelven arriba, en App, así la cuenta y los datos
   * miran el mismo estado. */
  session: {
    user: SessionUser | null
    ready: boolean
    setUser: (user: SessionUser | null) => void
  }
  sync: AccountSync
  resume: Resume
  onChangePreferences: (preferences: Preferences) => void
  onChangeSources: (sources: string[]) => void
  onChangeFeeds: (feeds: CustomFeed[]) => void
  onChangeTheme: (theme: Theme) => void
  onChangeProfile: (profile: Profile) => void
  onChangeResume: (resume: Resume) => void
  onEraseEverything: () => void
  onImportCv: (
    profile: Profile,
    preferences: Preferences,
    found: ResumeFound,
  ) => void
  /** Lleva al tablero con el puesto y la jornada del perfil como filtros. */
  onSearchBoard: () => void
  onOpenTest: () => void
  onPrefetchTest: () => void
  onBack: () => void
}

/** Las secciones de la página, en el orden en que se leen y con el ancla que
 * un enlace puede nombrar (`/?view=profile#cv`). */
const SECTIONS = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'cv', label: 'CV' },
  { id: 'preferencias', label: 'Preferencias' },
  { id: 'fuentes', label: 'Fuentes' },
  { id: 'autoconocimiento', label: 'Autoconocimiento' },
  { id: 'apariencia', label: 'Apariencia' },
  { id: 'cuenta', label: 'Cuenta' },
  { id: 'agentes', label: 'Agentes' },
  { id: 'privacidad', label: 'Privacidad' },
] as const

/**
 * Una sección de la página. Es un panel como el de la isla —los controles de
 * cada bloque están hechos para ese fondo—, así que cada tarjeta lo conserva y
 * la página se lee de corrido, sin acordeones ni pestañas adentro.
 */
function Section({
  id,
  title,
  hint,
  children,
}: {
  id: (typeof SECTIONS)[number]['id']
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 rounded-3xl bg-panel p-5 text-onpanel shadow-[var(--shadow-panel)] sm:p-6"
      id={id}
    >
      <h2
        className="text-base font-semibold tracking-tight text-onpanel"
        id={`${id}-title`}
      >
        {title}
      </h2>
      {hint ? (
        <p className="mt-1 text-xs leading-relaxed text-onpanel-muted">
          {hint}
        </p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  )
}

/**
 * Todo lo que la app sabe de la persona y de cómo busca, en una página con su
 * propio enlace en vez de un panel con submenús dentro de la isla. Cada tema
 * tiene su título y su ancla; el viejo botón de Preferencias lleva acá.
 */
export function ProfilePage({
  meta,
  categories,
  departments,
  preferences,
  sources,
  feeds,
  feedResults,
  feedsLoading,
  theme,
  profile,
  usage,
  counts,
  session,
  sync,
  resume,
  onChangePreferences,
  onChangeSources,
  onChangeFeeds,
  onChangeTheme,
  onChangeProfile,
  onChangeResume,
  onEraseEverything,
  onImportCv,
  onSearchBoard,
  onOpenTest,
  onPrefetchTest,
  onBack,
}: ProfilePageProps) {
  /* Un enlace con ancla llega antes de que la página exista (se carga bajo
     demanda): cuando por fin se dibuja, el navegador ya no la busca solo. */
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id) document.getElementById(id)?.scrollIntoView()
  }, [])

  return (
    <div className="mt-6 space-y-5">
      <PageHeader
        icon={<UserRound aria-hidden className="size-5" />}
        lead={
          <>
            Lo que cargás acá ordena el listado y arma tu CV. Vive en este
            navegador: no se sube a ningún lado salvo que prendas la
            sincronización de tu cuenta.
          </>
        }
        title="Perfil y preferencias"
        onBack={onBack}
      />

      <nav aria-label="Secciones de la página" className="-mx-5 px-5">
        <ul className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden">
          {SECTIONS.map((section) => (
            <li key={section.id} className="shrink-0">
              <a
                className="inline-flex min-h-9 items-center rounded-full border border-sky/50 bg-surface px-3 text-xs font-medium text-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                href={`#${section.id}`}
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
        <ShieldCheck
          aria-hidden
          className="mt-0.5 size-3.5 shrink-0 text-brand"
        />
        Nada de lo que escribís acá sale de tu navegador. Tu perfil solo se usa
        para ordenar las ofertas y para completar tu CV.
      </p>

      <Section
        hint="Tus estudios y tu experiencia: ordenan el listado y avisan cuando una oferta pide más."
        id="perfil"
        title="Perfil"
      >
        <ProfileBasics profile={profile} onChange={onChangeProfile} />
      </Section>

      <Section
        hint="Importá un CV que ya tengas o completá los datos que se parecen a uno."
        id="cv"
        title="Tu CV"
      >
        <CvBlock
          categories={categories}
          preferences={preferences}
          profile={profile}
          resume={resume}
          onChangePreferences={onChangePreferences}
          onChangeResume={onChangeResume}
          onImportCv={onImportCv}
          onSearchBoard={onSearchBoard}
        />
      </Section>

      <Section
        hint="Cómo se ordena el listado y qué rubros y zonas te interesan."
        id="preferencias"
        title="Preferencias de búsqueda"
      >
        <PreferencesPanel
          categories={categories}
          departments={departments}
          meta={meta}
          preferences={preferences}
          onChange={onChangePreferences}
        />
      </Section>

      <Section
        hint="De dónde salen las ofertas, y fuentes propias si querés sumar una."
        id="fuentes"
        title="Fuentes"
      >
        <SourcesPanel
          feedResults={feedResults}
          feeds={feeds}
          feedsLoading={feedsLoading}
          meta={meta}
          sources={sources}
          onChangeFeeds={onChangeFeeds}
          onChangeSources={onChangeSources}
        />
      </Section>

      <Section id="autoconocimiento" title="Autoconocimiento">
        <TestEntry onOpenTest={onOpenTest} onPrefetchTest={onPrefetchTest} />
      </Section>

      <Section id="apariencia" title="Apariencia">
        <AppearanceBlock theme={theme} onChangeTheme={onChangeTheme} />
      </Section>

      <Section
        hint="Es lo único de la app que vive en el servidor, y es opcional."
        id="cuenta"
        title="Cuenta y sincronización"
      >
        <AccountSection
          ready={session.ready}
          sync={sync}
          user={session.user}
          onUser={session.setUser}
        />
      </Section>

      <Section
        hint="Conectá un agente (Claude, Cursor o cualquier cliente MCP) a la búsqueda."
        id="agentes"
        title="Agentes"
      >
        <McpSection />
      </Section>

      <Section
        hint="Qué se guarda, qué se comparte y cómo borrarlo todo."
        id="privacidad"
        title="Privacidad y borrado"
      >
        <PrivacyBlock
          counts={counts}
          profile={profile}
          usage={usage}
          onChange={onChangeProfile}
          onEraseEverything={onEraseEverything}
        />
      </Section>
    </div>
  )
}
