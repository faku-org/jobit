import {
  Banknote,
  Briefcase,
  Download,
  Gauge,
  MapPin,
  Search,
  Sparkles,
  TrendingUp,
  Wrench,
  X,
} from "lucide-react";
import { m } from "motion/react";
import { type ReactNode, useMemo, useState } from "react";
import {
  JOB_TYPE_LABEL,
  LEVEL_LABEL,
  SOURCE_LABEL,
  WORK_MODE_LABEL,
  formatScrapedAt,
} from "../../lib/format.ts";
import {
  type Breakdown,
  type MarketReport,
  type SalarySummary,
  formatBand,
  formatPesos,
  formatShare,
} from "../../lib/market.ts";
import { fadeUpTransition } from "../../lib/motion.ts";
import { chipClass, fieldClass } from "../../lib/styles.ts";
import type { JobType, Level, WorkMode } from "../../lib/types.ts";
import { Chart, type ChartKind, type ChartRow, ChartSwitch } from "./Chart.tsx";
import { FadeUp } from "../ui/FadeUp.tsx";

interface MarketProps {
  report: MarketReport;
  /** A number is only useful if it can be turned back into the offers behind it. */
  onExploreCategory: (value: string) => void;
  onSearch: (term: string) => void;
}

type SectionId = "resumen" | "puestos" | "habilidades" | "sueldos" | "zonas" | "modalidad";

const SECTIONS: { id: SectionId; label: string; icon: typeof Briefcase }[] = [
  { id: "resumen", label: "Resumen", icon: Gauge },
  { id: "puestos", label: "Puestos", icon: Briefcase },
  { id: "habilidades", label: "Habilidades", icon: Wrench },
  { id: "sueldos", label: "Sueldos", icon: Banknote },
  { id: "zonas", label: "Zonas", icon: MapPin },
  { id: "modalidad", label: "Cómo se trabaja", icon: TrendingUp },
];

const fold = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** A section that has been opened stays mounted: switching tabs would
 * otherwise remount the charts and play the entrance again. */
function Section({
  id,
  current,
  seen,
  children,
}: {
  id: SectionId;
  current: SectionId;
  seen: ReadonlySet<SectionId>;
  children: ReactNode;
}) {
  if (!seen.has(id)) return null;
  return <div hidden={id !== current}>{children}</div>;
}

function Panel({
  title,
  hint,
  aside,
  children,
}: {
  title: string;
  hint?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-sky/50 bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
          {hint ? <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p> : null}
        </div>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-sky/50 bg-surface px-4 py-3.5">
      <p className="text-xl leading-none font-semibold tracking-tight text-ink tabular-nums">
        {value}
      </p>
      <p className="mt-1.5 text-xs leading-snug text-muted">{label}</p>
    </div>
  );
}

/** The quartiles as a bar: where the middle half of the offers actually sits. */
function SalaryBand({ salary }: { salary: SalarySummary }) {
  const span = Math.max(salary.max - salary.min, 1);
  const at = (value: number) => ((value - salary.min) / span) * 100;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm text-soft">La mitad de las ofertas paga entre</span>
        <span className="text-sm font-semibold text-ink tabular-nums">{formatBand(salary)}</span>
      </div>

      <div className="relative mt-3 h-2 rounded-full bg-mist">
        <m.div
          animate={{ opacity: 1 }}
          className="absolute inset-y-0 rounded-full bg-sky"
          initial={{ opacity: 0 }}
          style={{ left: `${at(salary.p25)}%`, right: `${100 - at(salary.p75)}%` }}
          transition={fadeUpTransition}
        />
        <div
          className="absolute inset-y-[-3px] w-0.5 rounded-full bg-brand"
          style={{ left: `${at(salary.median)}%` }}
        />
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-faint tabular-nums">
        <span>{formatPesos(salary.min)}</span>
        <span className="font-medium text-brand">mediana {formatPesos(salary.median)}</span>
        <span>{formatPesos(salary.max)}</span>
      </div>
    </div>
  );
}

const downloadClass = `${chipClass} border border-sky/60 text-muted transition-colors hover:border-brand hover:text-ink`;

/**
 * Los mismos números para llevarse. Son dos links y no un botón con fetch: la
 * API ya manda el archivo con su nombre y el navegador ya sabe qué hacer con
 * eso, así que no hay estado de descarga que mantener ni error que mostrar.
 */
function Downloads() {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 px-1">
      <span className="text-[11px] text-faint">Bajar estos datos</span>
      {(["csv", "xlsx"] as const).map((format) => (
        <a
          key={format}
          className={downloadClass}
          download
          href={`/api/market.${format}`}
          title={
            format === "csv"
              ? "Todas las tablas en un archivo de texto"
              : "Una planilla con una pestaña por tabla"
          }
        >
          <Download aria-hidden className="size-3.5" />
          {format.toUpperCase()}
        </a>
      ))}
    </div>
  );
}

const labelled = <T extends string>(rows: Breakdown[], labels: Record<T, string>): ChartRow[] =>
  rows.map((row) => ({
    key: row.value,
    label: labels[row.value as T] ?? row.value,
    value: row.count,
  }));

/**
 * The country's board, not yours. It is split into sections rather than one
 * long scroll: each one answers a single question, and each chart can be read
 * the way the person prefers — comparing, splitting a whole, or exact numbers.
 */
export function Market({ report, onExploreCategory, onSearch }: MarketProps) {
  const [section, setSection] = useState<SectionId>("resumen");
  const [seen, setSeen] = useState<ReadonlySet<SectionId>>(() => new Set(["resumen"]));
  const [query, setQuery] = useState("");
  const [kinds, setKinds] = useState<Record<SectionId, ChartKind>>({
    resumen: "bars",
    puestos: "bars",
    habilidades: "bars",
    sueldos: "bars",
    zonas: "bars",
    modalidad: "donut",
  });

  const setKindOf =
    (id: SectionId) =>
    (next: ChartKind): void =>
      setKinds((current) => ({ ...current, [id]: next }));

  const filter = (rows: ChartRow[]): ChartRow[] => {
    const needle = fold(query.trim());
    return needle ? rows.filter((row) => fold(row.label).includes(needle)) : rows;
  };

  const roleRows = useMemo<ChartRow[]>(
    () =>
      report.roles.map((role) => ({
        key: role.slug,
        label: role.label,
        value: role.count,
        note: role.salary
          ? `${role.count} · ${formatPesos(role.salary.median)}`
          : String(role.count),
        onClick: () => onSearch(role.label.split(" / ")[0] ?? role.label),
      })),
    [report.roles, onSearch],
  );

  const skillRows = useMemo<ChartRow[]>(
    () =>
      report.skills.map((skill) => ({
        key: skill.slug,
        label: skill.label,
        value: skill.count,
        note: skill.salary
          ? `${skill.count} · ${formatPesos(skill.salary.median)}`
          : String(skill.count),
        onClick: () => onSearch(skill.label),
      })),
    [report.skills, onSearch],
  );

  const categoryRows = useMemo<ChartRow[]>(
    () =>
      report.categories.map((category) => ({
        key: category.value,
        label: category.label,
        value: category.count,
        note: category.salary
          ? `${category.count} · ${formatPesos(category.salary.median)}`
          : String(category.count),
        onClick: () => onExploreCategory(category.value),
      })),
    [report.categories, onExploreCategory],
  );

  const departmentRows = useMemo<ChartRow[]>(
    () =>
      report.departments.map((department) => ({
        key: department.value,
        label: department.value,
        value: department.count,
        note: department.salary
          ? `${department.count} · ${formatPesos(department.salary.median)}`
          : String(department.count),
      })),
    [report.departments],
  );

  const paidRoles = useMemo<ChartRow[]>(
    () =>
      report.roles
        .flatMap((role) =>
          role.salary
            ? [
                {
                  key: role.slug,
                  label: role.label,
                  value: role.salary.median,
                  note: formatPesos(role.salary.median),
                  onClick: () => onSearch(role.label.split(" / ")[0] ?? role.label),
                },
              ]
            : [],
        )
        .sort((a, b) => b.value - a.value),
    [report.roles, onSearch],
  );

  const entryRows = useMemo<ChartRow[]>(
    () =>
      report.entryFriendly.map((entry) => ({
        key: entry.value,
        label: entry.label,
        value: Math.round(entry.share * 100),
        note: `${entry.count} de cada ${Math.round(entry.count / Math.max(entry.share, 0.01))}`,
        onClick: () => onExploreCategory(entry.value),
      })),
    [report.entryFriendly, onExploreCategory],
  );

  const searchable =
    section === "puestos" ||
    section === "habilidades" ||
    section === "zonas" ||
    section === "sueldos";

  return (
    <div className="space-y-4">
      <FadeUp>
        <div
          className="flex flex-wrap gap-1 rounded-2xl border border-sky/50 bg-surface p-1 shadow-[var(--shadow-hairline)] sm:flex-nowrap"
          role="tablist"
        >
          {SECTIONS.map((entry) => {
            const active = section === entry.id;
            return (
              <button
                key={entry.id}
                aria-selected={active}
                className={`relative flex min-h-10 grow basis-auto items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors sm:min-h-0 sm:basis-0 sm:py-2 ${
                  active ? "text-onpanel" : "text-muted hover:text-ink"
                }`}
                role="tab"
                type="button"
                onClick={() => {
                  setSection(entry.id);
                  setSeen((current) =>
                    current.has(entry.id) ? current : new Set(current).add(entry.id),
                  );
                  setQuery("");
                }}
              >
                {active ? (
                  <m.span
                    className="absolute inset-0 rounded-xl bg-panel"
                    layoutId="market-tab"
                    transition={fadeUpTransition}
                  />
                ) : null}
                <span className="relative inline-flex items-center gap-1.5">
                  <entry.icon aria-hidden className="size-3.5" />
                  {entry.label}
                </span>
              </button>
            );
          })}
        </div>
      </FadeUp>

      <FadeUp delay={0.03}>
        <Downloads />
      </FadeUp>

      {searchable ? (
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-brand"
            />
            <input
              aria-label="Filtrar lo que se muestra"
              className={`${fieldClass} py-2.5 pr-10 pl-10 placeholder:text-faint`}
              placeholder={
                section === "zonas" ? "Filtrar por departamento" : "Filtrar por puesto o rubro"
              }
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? (
              <button
                aria-label="Limpiar"
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-0.5 text-faint transition-colors hover:text-ink"
                type="button"
                onClick={() => setQuery("")}
              >
                <X aria-hidden className="size-4" />
              </button>
            ) : null}
          </div>
      ) : null}

      <FadeUp delay={0.06}>
        <Section current={section} id="resumen" seen={seen}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Figure label="ofertas publicadas" value={report.count.toLocaleString("es-UY")} />
              <Figure label="de los últimos 7 días" value={report.fresh7.toLocaleString("es-UY")} />
              <Figure
                label="no piden experiencia"
                value={formatShare(report.noExperience, report.count)}
              />
              <Figure
                label="publican el sueldo"
                value={formatShare(report.withSalary, report.count)}
              />
            </div>

            <Panel
              aside={
                <ChartSwitch
                  kind={kinds.resumen}
                  options={["bars", "donut", "table"]}
                  onChange={setKindOf("resumen")}
                />
              }
              hint="Tocá un rubro para ver sus ofertas en la lista."
              title="Rubros que más contratan"
            >
              <Chart kind={kinds.resumen} rows={categoryRows} />
            </Panel>

            {entryRows.length > 0 ? (
              <Panel
                hint="Rubros ordenados por qué proporción de sus avisos no pide experiencia previa."
                title="Dónde entrar sin experiencia"
              >
                <Chart
                  additive={false}
                  kind="bars"
                  rows={entryRows.slice(0, 6)}
                  unit="% sin experiencia"
                />
              </Panel>
            ) : null}
          </div>
        </Section>

        <Section current={section} id="puestos" seen={seen}>
          <Panel
            aside={
              <ChartSwitch
                kind={kinds.puestos}
                options={["bars", "donut", "table"]}
                onChange={setKindOf("puestos")}
              />
            }
            hint="Cada aviso se cuenta bajo el puesto que nombra. Donde hay un monto es la mediana de lo que paga, entre los avisos que lo publican."
            title="Puestos más solicitados"
          >
            <Chart
              empty="Ningún puesto coincide con ese filtro."
              kind={kinds.puestos}
              rows={filter(roleRows).slice(0, kinds.puestos === "donut" ? 10 : 30)}
            />
          </Panel>
        </Section>

        <Section current={section} id="habilidades" seen={seen}>
          <Panel
            aside={
              <ChartSwitch
                kind={kinds.habilidades}
                options={["bars", "donut", "table"]}
                onChange={setKindOf("habilidades")}
              />
            }
            hint="Las habilidades que más se nombran en títulos y descripciones, contadas contra un catálogo para que 'Excel avanzado' y 'Excel intermedio' cuenten igual. Donde hay un monto es la mediana de lo que pagan los avisos que la piden."
            title="Habilidades más pedidas"
          >
            <Chart
              empty="Ninguna habilidad coincide con ese filtro."
              kind={kinds.habilidades}
              rows={filter(skillRows).slice(0, kinds.habilidades === "donut" ? 10 : 30)}
            />
          </Panel>
        </Section>

        <Section current={section} id="sueldos" seen={seen}>
          <div className="space-y-4">
            {report.salary ? (
              <Panel
                hint={`Sobre ${report.salary.count.toLocaleString("es-UY")} avisos que publican un monto mensual en pesos, de ${report.count.toLocaleString("es-UY")} en total.`}
                title="Rango de sueldos de todo el país"
              >
                <SalaryBand salary={report.salary} />
              </Panel>
            ) : null}

            <Panel
              aside={
                <ChartSwitch
                  kind={kinds.sueldos}
                  options={["bars", "table"]}
                  onChange={setKindOf("sueldos")}
                />
              }
              hint="Mediana mensual por puesto, contando solo los avisos que publican el sueldo."
              title="Cuánto paga cada puesto"
            >
              <Chart
                additive={false}
                empty="Ningún puesto con sueldo publicado coincide con ese filtro."
                kind={kinds.sueldos === "donut" ? "bars" : kinds.sueldos}
                rows={filter(paidRoles).slice(0, 25)}
                unit="Mediana"
              />
            </Panel>
          </div>
        </Section>

        <Section current={section} id="zonas" seen={seen}>
          <Panel
            aside={
              <ChartSwitch
                kind={kinds.zonas}
                options={["bars", "donut", "table"]}
                onChange={setKindOf("zonas")}
              />
            }
            hint="Cuántas ofertas hay por departamento, y la mediana de lo que pagan donde se publica."
            title="Dónde está el trabajo"
          >
            <Chart
              empty="Ningún departamento coincide con ese filtro."
              kind={kinds.zonas}
              rows={filter(departmentRows).slice(0, kinds.zonas === "donut" ? 8 : 25)}
            />
          </Panel>
        </Section>

        <Section current={section} id="modalidad" seen={seen}>
          <div className="space-y-4">
            <Panel
              aside={
                <ChartSwitch
                  kind={kinds.modalidad}
                  options={["donut", "bars", "table"]}
                  onChange={setKindOf("modalidad")}
                />
              }
              title="Modalidad"
            >
              <Chart
                kind={kinds.modalidad}
                rows={labelled<WorkMode>(report.modes, WORK_MODE_LABEL)}
              />
            </Panel>
            <Panel title="Jornada">
              <Chart
                kind={kinds.modalidad}
                rows={labelled<JobType>(report.jobTypes, JOB_TYPE_LABEL)}
              />
            </Panel>
            <Panel
              hint="Solo una parte de los avisos declara el nivel del puesto."
              title="Nivel del puesto"
            >
              <Chart kind={kinds.modalidad} rows={labelled<Level>(report.levels, LEVEL_LABEL)} />
            </Panel>
          </div>
        </Section>
      </FadeUp>

      <p className="px-1 pb-2 text-center text-[11px] leading-relaxed text-faint">
        <Sparkles aria-hidden className="mr-1 inline size-3 align-[-1px] text-brand" />
        Calculado sobre {report.count.toLocaleString("es-UY")} avisos de{" "}
        {report.sources.map((source) => SOURCE_LABEL[source.value] ?? source.value).join(" y ")},
        actualizados el {formatScrapedAt(report.scraped_at)}. No es una estadística oficial del
        mercado laboral: es lo que estas fuentes publicaron.
      </p>
    </div>
  );
}
