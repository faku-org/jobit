import type { CustomFeed } from "./feed.ts";
import { JOB_TYPE_LABEL, LEVEL_LABEL, SOURCE_LABEL, WORK_MODE_LABEL } from "./format.ts";
import type { Facet, Preferences } from "./types.ts";

const pesos = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 });

const join = (parts: string[]): string => parts.filter((part) => part !== "").join(" · ");

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

/** One name when there is one, a count when there are more: "Montevideo" says
 * more than "1 zona", and "4 zonas" says more than four names that do not fit. */
function named(values: string[], facets: Facet[], one: string, many: string): string {
  if (values.length === 0) return "";
  if (values.length > 1) return plural(values.length, one, many);
  const [value] = values;
  if (value === undefined) return "";
  return facets.find((facet) => facet.value === value)?.label ?? value;
}

function salaryLabel(preferences: Preferences): string {
  const { min, max, includeUnknown } = preferences.salary;
  if (min !== null && max !== null) return `$ ${pesos.format(min)} a ${pesos.format(max)}`;
  if (min !== null) return `desde $ ${pesos.format(min)}`;
  if (max !== null) return `hasta $ ${pesos.format(max)}`;
  return includeUnknown ? "" : "con sueldo publicado";
}

/** Rubros and zonas, wanted and hidden. */
export function searchSummary(
  preferences: Preferences,
  categories: Facet[],
  departments: Facet[],
): string {
  const hidden = preferences.hiddenCategories.length + preferences.hiddenDepartments.length;

  return join([
    named(preferences.categories, categories, "rubro", "rubros"),
    named(preferences.departments, departments, "zona", "zonas"),
    hidden > 0 ? plural(hidden, "oculto", "ocultos") : "",
  ]);
}

/** Modalidad, jornada, nivel and pay, in the order the onboarding asks them. */
export function workSummary(preferences: Preferences): string {
  return join([
    salaryLabel(preferences),
    preferences.modes.map((mode) => WORK_MODE_LABEL[mode]).join(", "),
    preferences.jobTypes.map((type) => JOB_TYPE_LABEL[type]).join(", "),
    preferences.levels.map((level) => LEVEL_LABEL[level]).join(", "),
    preferences.noExperience ? "sin experiencia" : "",
  ]);
}

/** An empty source list means every board, which is worth saying out loud. */
export function advancedSummary(
  sources: string[],
  allSources: string[],
  feeds: CustomFeed[],
): string {
  const own = feeds.filter((feed) => feed.enabled).length;
  const chosen =
    sources.length === 0
      ? allSources.length > 0
        ? "todas las fuentes"
        : ""
      : sources.length === 1 && sources[0] !== undefined
        ? (SOURCE_LABEL[sources[0]] ?? sources[0])
        : plural(sources.length, "fuente", "fuentes");

  return join([chosen, own > 0 ? plural(own, "feed propio", "feeds propios") : ""]);
}
