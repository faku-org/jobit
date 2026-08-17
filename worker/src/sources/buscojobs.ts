import { buscojobsCategory } from "../categories.ts";
import { fetchJson, fetchText } from "../http.ts";
import type { JobDetail, JobStub, JobType, Remote, Salary, Source } from "../types.ts";

const ORIGIN = "https://www.buscojobs.com.uy";
const LIST_DELAY_MS = 1200;
const DETAIL_DELAY_MS = 400;

interface RawListItem {
  IdOferta: number;
  CargoVacante: string;
  NombreEmpresa: string | null;
  Confidencial: number;
  EsPasantia: number;
  PrimerEmpleo: number;
  PermiteTeletrabajo: number;
  PermiteTrabajoHibrido: number;
  FechaInicio: string;
  Departamento: { Nombre: string } | null;
  Ciudad: { Nombre: string } | null;
}

interface RawFacet {
  name: string;
  value: string;
  count: number;
}

interface RawListing {
  pageProps?: {
    resultadosIniciales?: {
      count: number;
      ofertas: RawListItem[];
      facets?: { subcanal?: RawFacet[] };
    };
  };
}

/**
 * Only a subset of these is ever populated: BuscoJobs leaves Requisitos,
 * IdNivelEstudio and AniosExperiencia null on every offer seen so far, while
 * Horario and PrimerEmpleo are reliable. They are all read anyway, since the
 * cache keeps the raw payload and other offers may fill them in.
 */
interface RawOffer {
  Descripcion: string | null;
  DescripcionMarkdown: string | null;
  Requisitos: string | null;
  SueldoDesde: number | null;
  SueldoHasta: number | null;
  AniosExperienciaDesde: number | null;
  IdNivelEstudio: number | null;
  NroPuestosVacantes: number | null;
  PrimerEmpleo: number | null;
  IdJornadaLaboral: number | null;
  IdTipoVacante: number | null;
  Horario: string | null;
}

interface RawDetail {
  pageProps?: { oferta?: RawOffer };
}

const EDUCATION_LEVEL: Record<number, string> = {
  1: "Primaria",
  2: "Ciclo básico",
  3: "Bachillerato",
  4: "Terciario",
  5: "Universitario",
  6: "Posgrado",
};

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function jobType(item: RawListItem): JobType | null {
  return item.EsPasantia === 1 ? "internship" : null;
}

function remote(item: RawListItem): Remote | null {
  if (item.PermiteTeletrabajo === 1) return "remote";
  if (item.PermiteTrabajoHibrido === 1) return "hybrid";
  return null;
}

function applyUrl(item: RawListItem): string {
  const city = item.Ciudad?.Nombre ?? item.Departamento?.Nombre ?? "uruguay";
  return `${ORIGIN}/${slugify(`${item.CargoVacante} en ${city}`)}-ID-${item.IdOferta}`;
}

function toStub(item: RawListItem, categoryRaw: string): JobStub {
  const company = item.Confidencial === 1 ? null : (item.NombreEmpresa?.trim() ?? null);

  return {
    source: "buscojobs",
    source_id: String(item.IdOferta),
    title: item.CargoVacante.trim(),
    company: company || null,
    department: item.Departamento?.Nombre ?? null,
    city: item.Ciudad?.Nombre ?? null,
    category_raw: categoryRaw,
    date_posted: item.FechaInicio,
    remote: remote(item),
    job_type: jobType(item),
    no_experience: item.PrimerEmpleo === 1 || item.EsPasantia === 1,
    apply_url: applyUrl(item),
  };
}

let cachedBuildId: string | null = null;

/** The Next.js build id changes on each deploy; one lookup per run is enough. */
async function buildId(): Promise<string | null> {
  if (cachedBuildId) return cachedBuildId;
  const html = await fetchText(`${ORIGIN}/ofertas`, LIST_DELAY_MS);
  cachedBuildId = html?.match(/"buildId":"([^"]+)"/)?.[1] ?? null;
  return cachedBuildId;
}

interface CategoryPath {
  id: string;
  label: string;
  path: string;
  count: number;
}

/**
 * The rubro list comes from the facets of the unfiltered listing, so a rubro
 * added by the site is picked up without touching this file. The sitemap only
 * publishes half of them, which is why it is not used here.
 */
async function categoryPaths(id: string): Promise<CategoryPath[]> {
  const url = `${ORIGIN}/_next/data/${id}/ofertas/1.json`;
  const data = await fetchJson<RawListing>(url, LIST_DELAY_MS);
  const facets = data?.pageProps?.resultadosIniciales?.facets?.subcanal ?? [];

  return facets.map((facet) => ({
    id: facet.value,
    label: facet.name,
    count: facet.count,
    path: `ofertas/ts${facet.value}/trabajo-de-${slugify(facet.name)}`,
  }));
}

/** Walks one listing path page by page, adding every offer it has not seen. */
async function paginate(
  buildIdValue: string,
  path: string,
  rubro: string,
  stubs: Map<string, JobStub>,
): Promise<{ seen: number; total: number }> {
  let page = 1;
  let total = Infinity;
  let seen = 0;

  while (seen < total && page <= 300) {
    const url = `${ORIGIN}/_next/data/${buildIdValue}/${path}/${page}.json`;
    const data = await fetchJson<RawListing>(url, LIST_DELAY_MS);
    const results = data?.pageProps?.resultadosIniciales;
    if (!results || results.ofertas.length === 0) break;

    total = results.count;
    seen += results.ofertas.length;
    for (const item of results.ofertas) {
      if (!stubs.has(String(item.IdOferta))) {
        stubs.set(String(item.IdOferta), toStub(item, rubro));
      }
    }
    page++;
  }

  return { seen, total: total === Infinity ? 0 : total };
}

async function collect(onProgress: (message: string) => void): Promise<JobStub[]> {
  const id = await buildId();
  if (!id) {
    onProgress("no se pudo leer el buildId de BuscoJobs");
    return [];
  }

  const categories = await categoryPaths(id);
  onProgress(`${categories.length} rubros detectados (buildId ${id.slice(0, 8)})`);

  const stubs = new Map<string, JobStub>();

  for (const category of categories) {
    const rubro = buscojobsCategory(category.id);
    const { seen, total } = await paginate(id, category.path, rubro, stubs);
    onProgress(`  ${category.label}: ${seen}/${total}`);
  }

  const tagged = stubs.size;
  const sweep = await paginate(id, "ofertas/tc33/trabajo-de-otros", "otros", stubs);
  onProgress(`  sin rubro asignado: ${stubs.size - tagged} (de ${sweep.total} totales)`);

  return [...stubs.values()];
}

function salary(from: number | null, to: number | null): Salary | null {
  if (!from && !to) return null;
  return { min: from || null, max: to || null, currency: "UYU" };
}

function detailJobType(jornada: number | null, tipoVacante: number | null): JobType | null {
  if (tipoVacante === 2) return "internship";
  if (jornada === 1) return "full_time";
  if (jornada !== null && jornada >= 3) return "part_time";
  return null;
}

async function fetchDetail(stub: JobStub): Promise<unknown | null> {
  const id = await buildId();
  if (!id) return null;

  const url = `${ORIGIN}/_next/data/${id}/oferta-ID-${stub.source_id}.json`;
  const data = await fetchJson<RawDetail>(url, DETAIL_DELAY_MS);
  return data?.pageProps?.oferta ?? null;
}

function parseDetail(raw: unknown): JobDetail | null {
  if (typeof raw !== "object" || raw === null) return null;
  const offer = raw as RawOffer;
  const experience = offer.AniosExperienciaDesde;

  return {
    description: (offer.DescripcionMarkdown || offer.Descripcion || "").trim(),
    requirements: offer.Requisitos?.trim() || null,
    salary: salary(offer.SueldoDesde, offer.SueldoHasta),
    experience_years_min: experience,
    education_level: offer.IdNivelEstudio ? (EDUCATION_LEVEL[offer.IdNivelEstudio] ?? null) : null,
    schedule: offer.Horario?.trim() || null,
    vacancies: offer.NroPuestosVacantes,
    no_experience: offer.PrimerEmpleo === 1 || experience === 0,
    job_type: detailJobType(offer.IdJornadaLaboral, offer.IdTipoVacante),
  };
}

export const buscojobs: Source = { id: "buscojobs", collect, fetchDetail, parseDetail };
