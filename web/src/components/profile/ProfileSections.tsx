import type { AccountSync } from '../../hooks/useAccountSync.ts'
import type { CustomFeed, FeedResult } from '../../lib/feed.ts'
import type { Profile } from '../../lib/profile.ts'
import type { Resume, ResumeFound } from '../../lib/resume.ts'
import type { SessionUser } from '../../lib/session.ts'
import type { Usage } from '../../lib/stats.ts'
import type { Facet, Meta, Preferences } from '../../lib/types.ts'
import { AccountSection } from '../account/AccountSection.tsx'
import { McpSection } from '../account/McpSection.tsx'
import { type ProfileSectionId } from './profile-sections.ts'
import { ConfigPanel } from '../settings/ConfigPanel.tsx'
import { PreferencesPanel, SourcesPanel } from './Preferences.tsx'
import {
  CvBlock,
  PrivacyBlock,
  ProfileBasics,
  TestEntry,
} from './ProfileBlocks.tsx'

export interface ProfileProps {
  meta: Meta | null
  categories: Facet[]
  departments: Facet[]
  preferences: Preferences
  sources: string[]
  feeds: CustomFeed[]
  feedResults: FeedResult[]
  feedsLoading: boolean
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
}

const CV_PARTS = {
  cv: {
    part: 'importar',
    title: 'Tu CV',
    hint: 'Importá un CV que ya tengas: se lee en tu navegador y vos elegís qué se usa.',
  },
  'cv-datos': {
    part: 'datos',
    title: 'CV: tus datos',
    hint: 'Foto, dónde vivís, idiomas y links. Quedan en este navegador.',
  },
  'cv-puesto': {
    part: 'puesto',
    title: 'CV: el puesto que buscás',
    hint: 'Con esto el tablero filtra y ordena las ofertas.',
  },
  'cv-extra': {
    part: 'extra',
    title: 'CV: referencias y más',
    hint: 'Referencias y, si querés, discapacidad.',
  },
} as const

/** Una sub-sección de Perfil, en su panel de columnas. */
export function ProfileSection({
  section,
  ...props
}: ProfileProps & { section: ProfileSectionId }) {
  switch (section) {
    case 'perfil':
      return (
        <ConfigPanel
          hint="Tus estudios y tu experiencia: ordenan el listado y avisan cuando una oferta pide más."
          id="perfil"
          title="Perfil"
        >
          <ProfileBasics
            profile={props.profile}
            onChange={props.onChangeProfile}
          />
        </ConfigPanel>
      )
    case 'cv':
    case 'cv-datos':
    case 'cv-puesto':
    case 'cv-extra':
      return (
        <ConfigPanel
          hint={CV_PARTS[section].hint}
          id={section}
          title={CV_PARTS[section].title}
        >
          <CvBlock
            categories={props.categories}
            part={CV_PARTS[section].part}
            preferences={props.preferences}
            profile={props.profile}
            resume={props.resume}
            onChangePreferences={props.onChangePreferences}
            onChangeResume={props.onChangeResume}
            onImportCv={props.onImportCv}
            onSearchBoard={props.onSearchBoard}
          />
        </ConfigPanel>
      )
    case 'busqueda':
      return (
        <ConfigPanel
          hint="Cómo se ordena el listado y qué rubros y zonas te interesan."
          id="busqueda"
          title="Preferencias de búsqueda"
        >
          <PreferencesPanel
            categories={props.categories}
            departments={props.departments}
            meta={props.meta}
            preferences={props.preferences}
            onChange={props.onChangePreferences}
          />
        </ConfigPanel>
      )
    case 'fuentes':
      return (
        <ConfigPanel
          hint="De dónde salen las ofertas, y fuentes propias si querés sumar una."
          id="fuentes"
          title="Fuentes"
        >
          <SourcesPanel
            feedResults={props.feedResults}
            feeds={props.feeds}
            feedsLoading={props.feedsLoading}
            meta={props.meta}
            sources={props.sources}
            onChangeFeeds={props.onChangeFeeds}
            onChangeSources={props.onChangeSources}
          />
        </ConfigPanel>
      )
    case 'autoconocimiento':
      return (
        <ConfigPanel id="autoconocimiento" title="Autoconocimiento">
          <TestEntry
            onOpenTest={props.onOpenTest}
            onPrefetchTest={props.onPrefetchTest}
          />
        </ConfigPanel>
      )
    case 'cuenta':
      return (
        <ConfigPanel
          hint="Es lo único de la app que vive en el servidor, y es opcional."
          id="cuenta"
          title="Cuenta y sincronización"
        >
          <AccountSection
            ready={props.session.ready}
            sync={props.sync}
            user={props.session.user}
            onUser={props.session.setUser}
          />
        </ConfigPanel>
      )
    case 'agentes':
      return (
        <ConfigPanel
          hint="Conectá un agente (Claude, Cursor o cualquier cliente MCP) a la búsqueda."
          id="agentes"
          title="Agentes"
        >
          <McpSection />
        </ConfigPanel>
      )
    case 'privacidad':
      return (
        <ConfigPanel
          hint="Qué se guarda, qué se comparte y cómo borrarlo todo."
          id="privacidad"
          title="Privacidad y borrado"
        >
          <PrivacyBlock
            counts={props.counts}
            profile={props.profile}
            usage={props.usage}
            onChange={props.onChangeProfile}
            onEraseEverything={props.onEraseEverything}
          />
        </ConfigPanel>
      )
  }
}
