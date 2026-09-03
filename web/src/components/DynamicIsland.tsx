import { Briefcase, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useScrolledPast } from "../hooks/useScrolledPast.ts";
import type { CustomFeed, FeedResult } from "../lib/feed.ts";
import { islandTransition } from "../lib/motion.ts";
import { type Profile, profileCount } from "../lib/profile.ts";
import type { Usage } from "../lib/stats.ts";
import {
  type Facet,
  type Meta,
  type Preferences,
  type Theme,
  hiddenCount,
  preferenceCount,
} from "../lib/types.ts";
import { PreferencesPanel } from "./Preferences.tsx";
import { ProfilePanel } from "./ProfilePanel.tsx";

interface DynamicIslandProps {
  meta: Meta | null;
  categories: Facet[];
  departments: Facet[];
  preferences: Preferences;
  sources: string[];
  feeds: CustomFeed[];
  feedResults: FeedResult[];
  feedsLoading: boolean;
  theme: Theme;
  profile: Profile;
  usage: Usage;
  /** What the danger zone would erase, passed through to the profile sheet. */
  counts: { saved: number; applications: number; dismissed: number; preferences: number };
  onChangePreferences: (preferences: Preferences) => void;
  onChangeSources: (sources: string[]) => void;
  onChangeFeeds: (feeds: CustomFeed[]) => void;
  onChangeTheme: (theme: Theme) => void;
  onChangeProfile: (profile: Profile) => void;
  onRestartOnboarding: () => void;
  onEraseEverything: () => void;
  onImportCv: (profile: Profile, preferences: Preferences) => void;
}

type Tab = "search" | "profile";

/**
 * A floating header, detached from the top of the page: wide at rest, shrunk
 * to a pill once the list scrolls, and expanded into a sheet that holds every
 * setting, from the search preferences to the theme and the sources.
 */
export function DynamicIsland({
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
  onChangePreferences,
  onChangeSources,
  onChangeFeeds,
  onChangeTheme,
  onChangeProfile,
  onRestartOnboarding,
  onEraseEverything,
  onImportCv,
}: DynamicIslandProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("search");
  const condensed = useScrolledPast(24);

  const count = preferenceCount(preferences) + hiddenCount(preferences);
  const studies = profileCount(profile);
  const compact = condensed && !open;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4 sm:top-4">
      <motion.header
        layout
        className={`pointer-events-auto w-full overflow-hidden rounded-[26px] bg-panel text-onpanel shadow-[var(--shadow-panel)] ring-1 ring-onpanel/10 backdrop-blur-xl ${
          compact ? "max-w-md" : "max-w-3xl"
        }`}
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={islandTransition}
      >
        <motion.div layout className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
          <motion.span
            layout
            className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-white"
          >
            <Briefcase aria-hidden className="size-4" />
          </motion.span>

          <motion.div layout className="min-w-0 flex-1">
            <h1 className="text-[15px] leading-tight font-semibold tracking-tight">JobIt</h1>
            <AnimatePresence initial={false} mode="popLayout">
              {compact ? null : (
                <motion.p
                  key="full"
                  animate={{ opacity: 1 }}
                  className="truncate text-xs text-onpanel/60"
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                >
                  Ofertas de trabajo en Uruguay
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.button
            layout
            aria-expanded={open}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              open || count > 0
                ? "bg-sky text-ink hover:bg-sky/80"
                : "bg-onpanel/10 text-onpanel/80 hover:bg-onpanel/20 hover:text-onpanel"
            }`}
            type="button"
            onClick={() => setOpen((current) => !current)}
          >
            <SlidersHorizontal aria-hidden className="size-3.5" />
            <span className="hidden sm:inline">Preferencias</span>
            {count > 0 ? <span>({count})</span> : null}
          </motion.button>
        </motion.div>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              key="panel"
              animate={{ height: "auto", opacity: 1 }}
              className="max-h-[70svh] overflow-y-auto"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              transition={islandTransition}
            >
              <div className="flex gap-1 px-4 pt-1 pb-2">
                {(
                  [
                    ["search", "Búsqueda", count],
                    ["profile", "Perfil", studies],
                  ] as const
                ).map(([value, label, badge]) => (
                  <button
                    key={value}
                    aria-pressed={tab === value}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      tab === value
                        ? "bg-onpanel/15 text-onpanel"
                        : "text-onpanel/55 hover:text-onpanel"
                    }`}
                    type="button"
                    onClick={() => setTab(value)}
                  >
                    {label}
                    {badge > 0 ? <span className="ml-1 tabular-nums">({badge})</span> : null}
                  </button>
                ))}
              </div>

              {tab === "search" ? (
                <PreferencesPanel
                  categories={categories}
                  departments={departments}
                  meta={meta}
                  feedResults={feedResults}
                  feeds={feeds}
                  feedsLoading={feedsLoading}
                  preferences={preferences}
                  sources={sources}
                  theme={theme}
                  onChange={onChangePreferences}
                  onChangeFeeds={onChangeFeeds}
                  onChangeSources={onChangeSources}
                  onChangeTheme={onChangeTheme}
                />
              ) : (
                <ProfilePanel
                  categories={categories}
                  counts={counts}
                  preferences={preferences}
                  profile={profile}
                  usage={usage}
                  onChange={onChangeProfile}
                  onEraseEverything={onEraseEverything}
                  onImportCv={onImportCv}
                  onRestartOnboarding={() => {
                    setOpen(false);
                    onRestartOnboarding();
                  }}
                />
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.header>
    </div>
  );
}
