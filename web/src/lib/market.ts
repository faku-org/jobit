/**
 * The board seen from above: what it publishes, where, and for how much. The
 * shapes mirror what api/src/market.ts computes; nothing here is about the
 * person looking at it.
 */
export interface SalarySummary {
  count: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
}

export interface RoleStat {
  slug: string;
  label: string;
  count: number;
  category: string;
  categoryLabel: string;
  noExperience: number;
  salary: SalarySummary | null;
}

export interface CategoryStat {
  value: string;
  label: string;
  count: number;
  noExperience: number;
  salary: SalarySummary | null;
}

export interface DepartmentStat {
  value: string;
  count: number;
  salary: SalarySummary | null;
}

export interface Breakdown {
  value: string;
  count: number;
}

export interface MarketReport {
  count: number;
  scraped_at: string;
  fresh7: number;
  fresh30: number;
  noExperience: number;
  withSalary: number;
  salary: SalarySummary | null;
  sources: Breakdown[];
  roles: RoleStat[];
  categories: CategoryStat[];
  departments: DepartmentStat[];
  levels: Breakdown[];
  modes: Breakdown[];
  jobTypes: Breakdown[];
  entryFriendly: { value: string; label: string; count: number; share: number }[];
}

const pesos = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("es-UY", { style: "percent", maximumFractionDigits: 0 });

export const formatPesos = (value: number): string => `$ ${pesos.format(value)}`;

export const formatShare = (part: number, whole: number): string =>
  whole === 0 ? "0%" : percent.format(part / whole);

/** "$ 30.000 a $ 50.000", the range most of the offers sit in. */
export const formatBand = (salary: SalarySummary): string =>
  `${formatPesos(salary.p25)} a ${formatPesos(salary.p75)}`;
