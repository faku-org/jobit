import { categoryLabel } from "@jobit/worker/categories";
import { WORK_MODE_LABEL } from "./format.ts";
import type { WorkMode } from "./types.ts";

/**
 * Lo que la sección Servicios sabe de un servicio, que es exactamente lo que
 * la API publica. Nada de esto se guarda en el navegador: la sección se lee,
 * no se colecciona, así que no hay guardadas ni descartadas como en el
 * tablero de ofertas.
 */
export type Currency = "UYU" | "USD";

export interface ServicePrice {
  kind: "base" | "extra";
  label: string;
  amount: number;
  currency: Currency;
  unit: string;
  notes: string;
}

export interface ServiceHour {
  /** 0 es domingo, como en Date.getDay(). */
  weekday: number;
  from: string;
  to: string;
}

/** Sin el id de la cuenta: quién publica se dice con `owner_handle` y
 * `owner_name`, que es lo único que hace falta para contratar. */
export interface Service {
  id: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  category: string;
  department: string;
  city: string;
  remote: string;
  fixed_price: boolean;
  work_style: string;
  experience_years: number | null;
  availability_note: string;
  response_time: string;
  status: string;
  rating_avg: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
  published_at: string;
  skills: string[];
  prices: ServicePrice[];
  hours: ServiceHour[];
  /** Quién está atrás. Nunca el correo: para contratar alcanza con el nombre. */
  owner_handle: string;
  owner_name: string;
}

/** La tasa con la que la API pudo comparar precios entre monedas. */
export interface Rate {
  usd_uyu: number;
  day: string;
  approximate: boolean;
}

export interface ServicesPage {
  total: number;
  offset: number;
  limit: number;
  services: Service[];
  /** Falso cuando no hay tasa: el orden por precio se apaga en vez de mentir. */
  price_sort: boolean;
  rate: Rate | null;
}

export interface ServiceFacet {
  value: string;
  count: number;
}

export interface ServicesMeta {
  count: number;
  categories: ServiceFacet[];
  departments: ServiceFacet[];
  remote: ServiceFacet[];
}

export const SERVICE_SORTS = ["recent", "rating", "price"] as const;
export type ServiceSort = (typeof SERVICE_SORTS)[number];

export const SERVICE_SORT_LABEL: Record<ServiceSort, string> = {
  recent: "Lo último",
  rating: "Mejor calificados",
  price: "Más baratos",
};

/** Lo que ve quien publica sobre lo suyo. "pending" no es "publicado": la
 * moderación es previa y el panel lo dice con esas palabras. */
export const SERVICE_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  pending: "En revisión",
  published: "Publicado",
  suspended: "Suspendido",
};

export const WORK_STYLE_LABEL: Record<string, string> = {
  individual: "Por cuenta propia",
  equipo: "Con equipo",
  empresa: "Empresa",
};

export const RESPONSE_TIME_LABEL: Record<string, string> = {
  "mismo-dia": "Contesta el mismo día",
  "48-horas": "Contesta en 48 horas",
  semana: "Contesta en la semana",
};

export const PRICE_UNIT_LABEL: Record<string, string> = {
  hora: "por hora",
  jornada: "por jornada",
  semana: "por semana",
  mes: "por mes",
  proyecto: "por proyecto",
  unidad: "por unidad",
};

/** Domingo primero, como `Date.getDay()`, que es como viaja el weekday. */
export const WEEKDAY_LABEL = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

export const REPORT_REASONS = ["spam", "enganoso", "inapropiado", "no-es-un-servicio"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  spam: "Es spam o publicidad",
  enganoso: "Engaña sobre lo que ofrece",
  inapropiado: "Tiene contenido inapropiado",
  "no-es-un-servicio": "No es un servicio",
};

export interface ServiceFilters {
  q: string;
  category: string;
  department: string;
  mode: WorkMode | "";
  /** El tope se lee en la moneda elegida; sin tasa, un tope en dólares no se
   * aplica, así que la API contesta la lista entera en vez de recortar mal. */
  priceMax: number | null;
  currency: Currency;
  ratingMin: number | null;
  sort: ServiceSort;
}

export const EMPTY_SERVICE_FILTERS: ServiceFilters = {
  q: "",
  category: "",
  department: "",
  mode: "",
  priceMax: null,
  currency: "UYU",
  ratingMin: null,
  sort: "recent",
};

export const hasActiveServiceFilters = (filters: ServiceFilters): boolean =>
  filters.q.trim() !== "" ||
  filters.category !== "" ||
  filters.department !== "" ||
  filters.mode !== "" ||
  filters.priceMax !== null ||
  filters.ratingMin !== null ||
  filters.sort !== "recent";

/** Una página de servicios es más corta que una de ofertas: cada tarjeta dice
 * bastante más y la lista se recorre mirando, no descartando. */
export const SERVICES_PAGE_SIZE = 24;

export function servicesQuery(filters: ServiceFilters, offset = 0): string {
  const params = new URLSearchParams();
  const q = filters.q.trim();

  if (q) params.set("q", q);
  if (filters.category) params.set("category", filters.category);
  if (filters.department) params.set("department", filters.department);
  if (filters.mode) params.set("remote", filters.mode);
  if (filters.priceMax !== null) {
    params.set("price_max", String(filters.priceMax));
    params.set("currency", filters.currency);
  }
  if (filters.ratingMin !== null) params.set("rating_min", String(filters.ratingMin));
  if (filters.sort !== "recent") params.set("sort", filters.sort);

  params.set("limit", String(SERVICES_PAGE_SIZE));
  params.set("offset", String(offset));
  return params.toString();
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`La API respondió ${response.status}`);
  return (await response.json()) as T;
}

export const fetchServices = (query: string, signal?: AbortSignal): Promise<ServicesPage> =>
  getJson<ServicesPage>(`/api/services?${query}`, signal);

export const fetchServicesMeta = (signal?: AbortSignal): Promise<ServicesMeta> =>
  getJson<ServicesMeta>("/api/services/meta", signal);

export const fetchService = (slug: string, signal?: AbortSignal): Promise<Service> =>
  getJson<Service>(`/api/services/${encodeURIComponent(slug)}`, signal);

/** Denunciar no pide cuenta y no manda quién fue: un motivo y nada más. */
export async function reportService(slug: string, reason: ReportReason): Promise<void> {
  const response = await fetch(`/api/services/${encodeURIComponent(slug)}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) throw new Error(`La API respondió ${response.status}`);
}

const money = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 });

/** "$ 1.200 por hora", "US$ 30". */
export function formatPrice(price: ServicePrice): string {
  const symbol = price.currency === "USD" ? "US$" : "$";
  const unit = PRICE_UNIT_LABEL[price.unit];
  return `${symbol} ${money.format(price.amount)}${unit ? ` ${unit}` : ""}`;
}

/** El precio que la tarjeta muestra: el primero de los base, que es el que la
 * persona puso como precio del servicio. Los extras se ven en la ficha. */
export const basePrice = (service: Service): ServicePrice | null =>
  service.prices.find((price) => price.kind === "base") ?? null;

export const extraPrices = (service: Service): ServicePrice[] =>
  service.prices.filter((price) => price.kind === "extra");

export const serviceCategoryLabel = (service: Service): string => categoryLabel(service.category);

export const serviceModeLabel = (service: Service): string =>
  WORK_MODE_LABEL[(service.remote || "onsite") as WorkMode];

export function serviceLocation(service: Service): string {
  const { city, department, remote } = service;
  if (remote === "remote" && !department) return "A distancia";
  if (city && department && city !== department) return `${city}, ${department}`;
  return city || department || "Uruguay";
}

/** Las horas agrupadas por día, que es como se leen: "Lunes 09:00 a 18:00". */
export interface DayHours {
  weekday: number;
  label: string;
  ranges: string[];
}

export function hoursByDay(hours: ServiceHour[]): DayHours[] {
  const days = new Map<number, DayHours>();

  for (const hour of hours) {
    const label = WEEKDAY_LABEL[hour.weekday] ?? "";
    const day = days.get(hour.weekday) ?? { weekday: hour.weekday, label, ranges: [] };
    day.ranges.push(`${hour.from} a ${hour.to}`);
    days.set(hour.weekday, day);
  }

  return [...days.values()].sort((a, b) => a.weekday - b.weekday);
}

const dayFormat = new Intl.DateTimeFormat("es-UY", { day: "numeric", month: "long" });

/** Las fechas de un servicio son días (YYYY-MM-DD) y no instantes. Se leen
 * como hora local: parseadas como UTC, en Uruguay se mostrarían un día antes. */
export function formatServiceDay(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "" : dayFormat.format(date);
}

export const pluralServices = (total: number): string =>
  total === 1 ? "1 servicio" : `${money.format(total)} servicios`;
