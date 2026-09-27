import { BellRing, CalendarClock, GraduationCap, MapPin, Sparkles, TrendingUp } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { closesIn, pluralOffers, relativeDate } from "../../lib/format.ts";
import { type MarketReport, formatPesos, formatShare } from "../../lib/market.ts";
import { type NewsMatch, buildNews, isEntryProfile } from "../../lib/news.ts";
import type { Profile } from "../../lib/profile.ts";
import { type Job, type Preferences, preferenceCount } from "../../lib/types.ts";
import { chipClass } from "../../lib/styles.ts";
import { FadeUp } from "../ui/FadeUp.tsx";

interface NewsProps {
  jobs: Job[];
  followed: Job[];
  preferences: Preferences;
  profile: Profile;
  market: MarketReport | null;
  status: "loading" | "loadingMore" | "ready" | "error";
  onOpen: (job: Job) => void;
  /** Llevar al tablero filtrado por el rubro de una tendencia. */
  onExplore: (category: string) => void;
}

/** Una tarjeta con su título y su bajada, como las de Mercado. */
function Block({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: typeof Sparkles;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-sky/50 bg-surface p-5">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-mist text-brand">
          <Icon aria-hidden className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
          {hint ? <p className="mt-0.5 text-xs leading-relaxed text-muted">{hint}</p> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Una oferta recomendada: título, datos y por qué encaja. */
function MatchRow({ entry, onOpen }: { entry: NewsMatch; onOpen: (job: Job) => void }) {
  const { job, reasons, fresh } = entry;

  return (
    <button
      className="w-full rounded-xl border border-sky/50 bg-canvas px-3.5 py-3 text-left transition-colors hover:border-brand hover:bg-mist"
      type="button"
      onClick={() => onOpen(job)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-medium text-ink">{job.title}</span>
        <span className="shrink-0 text-xs text-muted">{relativeDate(job.date_posted)}</span>
      </div>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
        {job.company ? <span className="truncate">{job.company}</span> : null}
        {job.department ? (
          <span className="inline-flex items-center gap-1">
            <MapPin aria-hidden className="size-3" />
            {job.department}
          </span>
        ) : null}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {fresh ? <span className={`${chipClass} bg-sky text-ink`}>Nueva</span> : null}
        {reasons.map((reason) => (
          <span key={reason} className={`${chipClass} bg-wash text-soft`}>
            {reason}
          </span>
        ))}
      </div>
    </button>
  );
}

function ClosingRow({
  job,
  daysLeft,
  onOpen,
}: {
  job: Job;
  daysLeft: number;
  onOpen: (job: Job) => void;
}) {
  return (
    <button
      className="flex w-full items-center gap-3 rounded-xl border border-sky/50 bg-canvas px-3.5 py-3 text-left transition-colors hover:border-brand hover:bg-mist"
      type="button"
      onClick={() => onOpen(job)}
    >
      <CalendarClock aria-hidden className="size-4 shrink-0 text-brand" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{job.title}</span>
        {job.company ? (
          <span className="block truncate text-xs text-muted">{job.company}</span>
        ) : null}
      </span>
      <span
        className={`shrink-0 text-xs font-medium tabular-nums ${
          daysLeft <= 3 ? "text-brand" : "text-muted"
        }`}
      >
        {closesIn(job.closes_at)}
      </span>
    </button>
  );
}

/**
 * Novedades: lo reciente que encaja, las prácticas para quien arranca, los
 * cierres de lo que sigue y la foto del mercado. Todo se calcula acá, sobre
 * datos que ya existen; sin datos no se dibuja el bloque, y sin historial no se
 * inventa una tendencia.
 */
export function News({
  jobs,
  followed,
  preferences,
  profile,
  market,
  status,
  onOpen,
  onExplore,
}: NewsProps) {
  const news = useMemo(
    () => buildNews({ jobs, followed, preferences, market }),
    [jobs, followed, preferences, market],
  );

  const hasPreferences = preferenceCount(preferences) > 0;
  const showStarters = isEntryProfile(profile) && news.starters.length > 0;
  const marketNews = news.market;
  const nothing =
    news.matches.length === 0 && !showStarters && news.closings.length === 0 && !marketNews;

  if (status === "loading" && nothing) {
    return (
      <div className="space-y-3">
        {[0, 1].map((index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-2xl border border-sky/50 bg-surface"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FadeUp>
        <header className="px-1">
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
            <BellRing aria-hidden className="size-4 text-brand" />
            Novedades
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Lo que se movió en el tablero y lo que te puede servir, según lo que contaste.
          </p>
        </header>
      </FadeUp>

      {nothing ? (
        <FadeUp>
          <Block icon={Sparkles} title="Todavía no hay novedades">
            <p className="text-xs leading-relaxed text-soft">
              Cuando el tablero tenga ofertas que encajen con lo que buscás, van a aparecer acá.
            </p>
          </Block>
        </FadeUp>
      ) : null}

      {news.matches.length > 0 ? (
        <FadeUp delay={0.03}>
          <Block
            icon={Sparkles}
            title="Para vos"
            hint="Ofertas recientes del tablero que coinciden con tus preferencias."
          >
            <div className="space-y-2">
              {news.matches.map((entry) => (
                <MatchRow key={entry.job.id} entry={entry} onOpen={onOpen} />
              ))}
            </div>
          </Block>
        </FadeUp>
      ) : hasPreferences && status === "ready" ? (
        <FadeUp delay={0.03}>
          <Block icon={Sparkles} title="Para vos">
            <p className="text-xs leading-relaxed text-soft">
              No hay ofertas nuevas que coincidan con tus preferencias. Probá ampliarlas o volver
              más tarde.
            </p>
          </Block>
        </FadeUp>
      ) : !hasPreferences ? (
        <FadeUp delay={0.03}>
          <Block icon={Sparkles} title="Para vos">
            <p className="text-xs leading-relaxed text-soft">
              Contá qué buscás en <span className="font-medium text-ink">Preferencias</span> y acá
              van a empezar a aparecer ofertas que encajen.
            </p>
          </Block>
        </FadeUp>
      ) : null}

      {showStarters ? (
        <FadeUp delay={0.06}>
          <Block
            icon={GraduationCap}
            title="Para arrancar"
            hint="Pasantías y ofertas que no piden experiencia previa."
          >
            <div className="space-y-2">
              {news.starters.map((entry) => (
                <MatchRow key={entry.job.id} entry={entry} onOpen={onOpen} />
              ))}
            </div>
          </Block>
        </FadeUp>
      ) : null}

      {news.closings.length > 0 ? (
        <FadeUp delay={0.09}>
          <Block
            icon={CalendarClock}
            title="Cierres próximos"
            hint="Llamados que seguís y que se vienen cerrando."
          >
            <div className="space-y-2">
              {news.closings.map((entry) => (
                <ClosingRow
                  key={entry.job.id}
                  daysLeft={entry.daysLeft}
                  job={entry.job}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </Block>
        </FadeUp>
      ) : null}

      {marketNews ? (
        <FadeUp delay={0.12}>
          <Block icon={TrendingUp} title="Del mercado" hint="La foto de hoy del tablero entero.">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-sky/50 bg-canvas px-3 py-2.5">
                <p className="text-lg leading-none font-semibold tracking-tight text-ink tabular-nums">
                  {marketNews.fresh7}
                </p>
                <p className="mt-1 text-xs text-muted">publicadas esta semana</p>
              </div>
              {marketNews.median !== null ? (
                <div className="rounded-xl border border-sky/50 bg-canvas px-3 py-2.5">
                  <p className="text-lg leading-none font-semibold tracking-tight text-ink tabular-nums">
                    {formatPesos(marketNews.median)}
                  </p>
                  <p className="mt-1 text-xs text-muted">sueldo mediano publicado</p>
                </div>
              ) : null}
            </div>

            {marketNews.topCategories.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {marketNews.topCategories.map((category) => (
                  <li key={category.label} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-soft">
                      {category.label}
                    </span>
                    <span className="text-xs text-muted tabular-nums">
                      {pluralOffers(category.count)} ·{" "}
                      {formatShare(category.count, marketNews.total)}
                    </span>
                    <button
                      className="shrink-0 text-xs font-medium text-brand transition-opacity hover:opacity-80"
                      type="button"
                      onClick={() => onExplore(category.value)}
                    >
                      Ver
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {!news.hasHistory ? (
              <p className="mt-3 border-t border-sky/40 pt-3 text-xs leading-relaxed text-faint">
                Todavía no hay una serie de mercado para mostrar cómo cambia en el tiempo. Lo de
                arriba es la foto de hoy, sin tendencia.
              </p>
            ) : null}
          </Block>
        </FadeUp>
      ) : null}
    </div>
  );
}
