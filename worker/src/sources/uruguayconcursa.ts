import { uruguayconcursaCategory } from "../categories.ts";
import { fetchJson } from "../http.ts";
import type { JobDetail, JobStub, JobType, Salary, Source } from "../types.ts";

const ORIGIN = "https://www.uruguayconcursa.gub.uy";
const LIST_ENDPOINT = `${ORIGIN}/api-backend/llamados/recientes`;
const DETAIL_ENDPOINT = `${ORIGIN}/api-backend/llamados/get/`;
const PAGE_SIZE = 200;
const MAX_PAGES = 10;
const LIST_DELAY_MS = 1500;
const DETAIL_DELAY_MS = 500;

/** A call the site still shows: open for applications, or about to open. */
const LISTED_STATES = new Set(["Abierto", "Próximo"]);

/**
 * Calls run by a body outside the central administration (UdelaR, ANEP and the
 * like) publish nothing in the listing: their text lives in this object, which
 * only the detail endpoint returns.
 */
interface RawDatosOO {
  LLaOOPerDenFun?: string;
  LLaOOPerReqEsp?: string;
  LlaOOPerComInt?: string;
  LlaOOPerTimeContrato?: string;
  LlaOODirRecPos?: string;
  LlaOOLugRecCon?: string;
  LlaOOTelCon?: string;
}

interface RawOrganismo {
  LlaOrgCntPue?: number;
  OrgDsc?: string;
}

interface RawLlamado {
  LlaId: string;
  LlaTit?: string;
  CarNom?: string;
  LlaNum?: string;
  Inciso?: string;
  UnidadEjecutora?: string;
  LlaEstWeb?: string;
  LlaFchApeIns?: string;
  LlaFchCieIns?: string;
  PeriodoInscripciones?: string;
  LlaLugDes?: string;
  LlaCarHor?: string;
  LlaRet?: string;
  LlaReqExc?: string;
  LlaConTra?: string;
  LlaTieCon?: string;
  TipTarDsc?: string;
  TipVinDsc?: string;
  LlaOtrOrg?: boolean;
  DatosOO?: RawDatosOO;
  listaOrganismoCantPuestos?: RawOrganismo[];
}

interface RawListing {
  ListaLlamados?: RawLlamado[];
  cntTotal?: number | string;
}

/** Kept from collect so the mapping never costs a second request. */
const collected = new Map<string, RawLlamado>();

const DEPARTMENTS = [
  "Montevideo",
  "Canelones",
  "Maldonado",
  "Rocha",
  "Treinta y Tres",
  "Cerro Largo",
  "Rivera",
  "Artigas",
  "Salto",
  "Paysandú",
  "Río negro",
  "Soriano",
  "Colonia",
  "San José",
  "Flores",
  "Florida",
  "Durazno",
  "Tacuarembó",
  "Lavalleja",
];

const fold = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * A call names every place it covers. One department is a location; several
 * mean it is nationwide, and the list is better off without a wrong guess.
 */
function singleDepartment(place: string | undefined): string | null {
  if (!place) return null;
  const haystack = fold(place);
  const found = DEPARTMENTS.filter((name) => haystack.includes(fold(name)));
  return found.length === 1 ? (found[0] ?? null) : null;
}

/** The listing leaves every text field empty on these; the detail fills them. */
const isSparse = (llamado: RawLlamado): boolean =>
  llamado.LlaOtrOrg === true || !(llamado.LlaReqExc ?? "").trim();

/** Those records carry HTML in fields the UI renders as plain text. */
function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** "$60.610 nominales a valores de Enero 2026." */
function parseSalary(retribution: string | undefined): Salary | null {
  const match = retribution?.match(/\$\s*([\d.]+)/);
  const amount = match?.[1] ? Number(match[1].replaceAll(".", "")) : Number.NaN;
  return Number.isFinite(amount) && amount > 0 ? { min: amount, max: null, currency: "UYU" } : null;
}

/** "40 horas semanales efectivas de labor.", or "(Esc. G, G°2, 16 hs)". */
function parseJobType(hours: string | undefined): JobType | null {
  const match = hours?.match(/(\d{1,2})\s*(?:horas|hs\b)/i);
  const weekly = match?.[1] ? Number(match[1]) : Number.NaN;
  if (!Number.isFinite(weekly)) return null;
  return weekly >= 35 ? "full_time" : "part_time";
}

const EDUCATION_RULES: [RegExp, string][] = [
  [
    /t[ií]tulo\s+(de\s+)?(grado|universitari|licenciad|ingenier|doctor)|licenciatura|egresad[oa]\s+universitari|posgrado|maestr[ií]a/i,
    "Título universitario",
  ],
  [
    /t[ií]tulo\s+t[eé]cnic|t[eé]cnic[oa]\s+(terciari|de\s+UTU)|tecnicatura|formaci[oó]n\s+docente/i,
    "Técnico o terciario",
  ],
  [
    /bachillerato\s+completo|ense[ñn]anza\s+secundaria\s+completa|6[°º]?\s+a[ñn]o.*liceo/i,
    "Bachillerato completo",
  ],
  [/ciclo\s+b[aá]sico\s+completo|3[°º]?\s+a[ñn]o.*(liceo|secundaria)/i, "Ciclo básico completo"],
  [/(educaci[oó]n\s+)?primaria\s+completa|escuela\s+primaria\s+completa/i, "Primaria completa"],
];

/** The schooling the call demands, taken from its excluding requirements. */
function parseEducation(requirements: string | undefined): string | null {
  if (!requirements) return null;
  const rule = EDUCATION_RULES.find(([pattern]) => pattern.test(requirements));
  return rule ? rule[1] : null;
}

function parseExperience(requirements: string | undefined): number | null {
  const match = requirements?.match(/(\d{1,2})\s*(?:\(\d+\)\s*)?a[ñn]os?\s+de\s+experiencia/i);
  const years = match?.[1] ? Number(match[1]) : Number.NaN;
  return Number.isFinite(years) ? years : null;
}

function vacancies(list: RawOrganismo[] | undefined): number | null {
  const total = (list ?? []).reduce((sum, entry) => sum + (entry.LlaOrgCntPue ?? 0), 0);
  return total > 0 ? total : null;
}

const organismOf = (llamado: RawLlamado): string =>
  [llamado.Inciso, llamado.UnidadEjecutora].filter((part) => part && part.trim()).join(" · ");

/** The fields the site shows as a fact sheet, laid out as readable text. */
function describe(llamado: RawLlamado): string {
  const facts = [
    `Organismo: ${organismOf(llamado)}`,
    llamado.TipVinDsc ? `Vínculo: ${llamado.TipVinDsc}` : "",
    llamado.LlaNum ? `Llamado: ${llamado.LlaNum}` : "",
    llamado.LlaLugDes ? `Lugar: ${llamado.LlaLugDes.trim()}` : "",
    llamado.LlaRet ? `Retribución: ${llamado.LlaRet}` : "",
    llamado.PeriodoInscripciones ? `Inscripciones: ${llamado.PeriodoInscripciones}` : "",
  ].filter(Boolean);

  const prose = [llamado.LlaTieCon, llamado.LlaConTra].map((part) => part?.trim()).filter(Boolean);

  return [facts.join("\n"), ...prose].join("\n\n").trim();
}

function describeOtherOrganism(llamado: RawLlamado): string {
  const data = llamado.DatosOO ?? {};

  const facts = [
    `Organismo: ${organismOf(llamado)}`,
    llamado.TipVinDsc ? `Vínculo: ${llamado.TipVinDsc}` : "",
    llamado.LlaNum ? `Llamado: ${llamado.LlaNum}` : "",
    llamado.PeriodoInscripciones ? `Inscripciones: ${llamado.PeriodoInscripciones}` : "",
    data.LlaOOPerTimeContrato ? `Plazo: ${data.LlaOOPerTimeContrato.trim()}` : "",
    data.LlaOOTelCon ? `Teléfono: ${data.LlaOOTelCon.trim()}` : "",
  ].filter(Boolean);

  const prose = [data.LLaOOPerDenFun, data.LlaOOPerComInt, data.LlaOODirRecPos, data.LlaOOLugRecCon]
    .map((part) => (part ? stripHtml(part) : ""))
    .filter(Boolean);

  return [facts.join("\n"), ...prose].join("\n\n").trim();
}

const isoDay = (day: string | undefined, endOfDay = false): string | null =>
  day ? `${day}T${endOfDay ? "23:59:59" : "00:00:00"}.000Z` : null;

function toStub(llamado: RawLlamado): JobStub {
  const title = llamado.LlaTit?.trim() || llamado.CarNom?.trim() || "Llamado público";

  return {
    source: "uruguayconcursa",
    source_id: llamado.LlaId,
    title,
    company: llamado.Inciso?.trim() || "Estado uruguayo",
    department: singleDepartment(llamado.LlaLugDes),
    city: null,
    category_raw: uruguayconcursaCategory(llamado.TipTarDsc ?? "", title),
    date_posted: isoDay(llamado.LlaFchApeIns) ?? new Date().toISOString(),
    remote: null,
    job_type: null,
    no_experience: false,
    apply_url: `${ORIGIN}/llamado/${llamado.LlaId}`,
  };
}

const fetchPage = (page: number): Promise<RawListing | null> =>
  fetchJson<RawListing>(LIST_ENDPOINT, LIST_DELAY_MS, {
    body: { PaginadoFiltrosSDT: { PaginaActual: page, CntPorPagina: PAGE_SIZE } },
  });

/**
 * Uruguay Concursa: every public-sector call the Oficina Nacional del Servicio
 * Civil publishes, from a JSON endpoint that needs no key.
 */
export const uruguayconcursa: Source = {
  id: "uruguayconcursa",

  async collect(onProgress) {
    collected.clear();
    const stubs: JobStub[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const listing = await fetchPage(page);
      const items = listing?.ListaLlamados ?? [];
      if (items.length === 0) break;

      for (const llamado of items) {
        if (!llamado.LlaId || !LISTED_STATES.has(llamado.LlaEstWeb ?? "")) continue;
        if (collected.has(llamado.LlaId)) continue;
        collected.set(llamado.LlaId, llamado);
        stubs.push(toStub(llamado));
      }

      onProgress(`  página ${page}: ${stubs.length} llamados vigentes`);
      const total = Number(listing?.cntTotal ?? 0);
      if (!Number.isFinite(total) || page * PAGE_SIZE >= total) break;
    }

    return stubs;
  },

  /**
   * Central-administration calls arrive complete in the listing; the rest need
   * the detail endpoint, which is where their DatosOO block lives.
   */
  async fetchDetail(stub) {
    const listed = collected.get(stub.source_id) ?? null;
    if (listed && !isSparse(listed)) return listed;

    const detail = await fetchJson<RawListing>(
      `${DETAIL_ENDPOINT}?Llaid=${encodeURIComponent(stub.source_id)}`,
      DETAIL_DELAY_MS,
    );
    return detail?.ListaLlamados?.[0] ?? listed;
  },

  parseDetail(raw) {
    if (typeof raw !== "object" || raw === null) return null;
    const llamado = raw as RawLlamado;

    const otherOrganism = llamado.DatosOO !== undefined && isSparse(llamado);
    const role = otherOrganism ? stripHtml(llamado.DatosOO?.LLaOOPerDenFun ?? "") : "";
    const requirements = otherOrganism
      ? stripHtml(llamado.DatosOO?.LLaOOPerReqEsp ?? "")
      : (llamado.LlaReqExc?.trim() ?? "");

    return {
      description: otherOrganism ? describeOtherOrganism(llamado) : describe(llamado),
      department: singleDepartment(`${llamado.LlaLugDes ?? ""} ${role}`),
      requirements: requirements || null,
      salary: parseSalary(llamado.LlaRet),
      experience_years_min: parseExperience(requirements),
      education_level: parseEducation(requirements || role),
      schedule: llamado.LlaCarHor?.trim() || null,
      vacancies: vacancies(llamado.listaOrganismoCantPuestos),
      closes_at: isoDay(llamado.LlaFchCieIns, true),
      no_experience: false,
      job_type: parseJobType(llamado.LlaCarHor || role),
    } satisfies JobDetail;
  },
};
