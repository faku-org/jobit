import { CATEGORIES, categoryLabel } from "@jobit/worker/categories";
import { db } from "./db.ts";
import type { Job, JobType, Level, Remote, Result } from "./types.ts";

/** La fuente con la que salen las ofertas propias, al lado de las scrapeadas. */
export const OWN_SOURCE = "jobit";

export const OFFER_STATUSES = ["draft", "published", "archived"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

const LEVELS: Level[] = ["entry", "mid", "senior"];
const REMOTES: Remote[] = ["remote", "hybrid"];
const JOB_TYPES: JobType[] = ["full_time", "part_time", "internship"];
const CATEGORY_SLUGS = CATEGORIES.map((category) => category.slug);

/** Como vive en la base: los opcionales viajan en "" en vez de NULL, para que
 * leer una fila no obligue a chequear nulos por todos lados. */
interface OfferRow {
  id: string;
  company_id: string;
  title: string;
  description: string;
  requirements: string;
  category: string;
  department: string;
  city: string;
  level: string;
  remote: string;
  job_type: string;
  salary_min: number | null;
  salary_max: number | null;
  no_experience: number;
  experience_years_min: number | null;
  closes_at: string;
  apply_url: string;
  status: OfferStatus;
  created_at: string;
  updated_at: string;
  published_at: string;
}

export interface Offer extends Omit<OfferRow, "no_experience"> {
  no_experience: boolean;
  company_name: string;
  company_status: string;
}

export interface OfferInput {
  company_id: string;
  title: string;
  description?: string;
  requirements?: string;
  category?: string;
  department?: string;
  city?: string;
  level?: string;
  remote?: string;
  job_type?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  no_experience?: boolean;
  closes_at?: string;
  apply_url?: string;
  status?: OfferStatus;
}

const MAX_TITLE = 160;
const MAX_TEXT = 20_000;
const MAX_SHORT = 120;
const MAX_SALARY = 100_000_000;

const trim = (value: string | undefined, max: number): string => (value ?? "").trim().slice(0, max);

const oneOf = (value: string | undefined, allowed: string[]): string =>
  allowed.find((option) => option === value) ?? "";

const money = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.min(Math.round(value), MAX_SALARY)
    : null;

/** Solo http(s), igual que el sitio de la empresa: el enlace de postulación
 * termina en un href que se le sirve a quien busca trabajo. */
function cleanApplyUrl(value: string | undefined): Result<string> {
  const raw = trim(value, 500);
  if (!raw) return { ok: true, value: "" };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "el enlace de postulación tiene que ser una dirección completa" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "el enlace tiene que empezar con http:// o https://" };
  }
  return { ok: true, value: url.toString() };
}

/** Una fecha sola (YYYY-MM-DD) o nada. */
function cleanClosesAt(value: string | undefined): Result<string> {
  const raw = trim(value, 10);
  if (!raw) return { ok: true, value: "" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) {
    return { ok: false, error: "la fecha de cierre tiene que ser AAAA-MM-DD" };
  }
  return { ok: true, value: raw };
}

const SELECT = `
  SELECT o.*, c.name AS company_name, c.status AS company_status
    FROM offers o
    JOIN companies c ON c.id = o.company_id
`;

const hydrate = (row: OfferRow & { company_name: string; company_status: string }): Offer => ({
  ...row,
  no_experience: row.no_experience === 1,
});

export interface OfferQuery {
  company_id?: string;
  status?: OfferStatus;
}

export function list(query: OfferQuery = {}): Offer[] {
  const where: string[] = [];
  const params: string[] = [];

  if (query.company_id) {
    where.push("o.company_id = ?");
    params.push(query.company_id);
  }
  if (query.status) {
    where.push("o.status = ?");
    params.push(query.status);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  return db()
    .query<OfferRow & { company_name: string; company_status: string }, string[]>(
      `${SELECT} ${clause} ORDER BY o.updated_at DESC`,
    )
    .all(...params)
    .map(hydrate);
}

export function byId(id: string): Offer | null {
  const row = db()
    .query<OfferRow & { company_name: string; company_status: string }, [string]>(
      `${SELECT} WHERE o.id = ?`,
    )
    .get(id);
  return row ? hydrate(row) : null;
}

export function counts(): Record<OfferStatus, number> {
  const rows = db()
    .query<{ status: OfferStatus; n: number }, []>(
      "SELECT status, COUNT(*) AS n FROM offers GROUP BY status",
    )
    .all();

  const out = { draft: 0, published: 0, archived: 0 };
  for (const row of rows) if (row.status in out) out[row.status] = row.n;
  return out;
}

function normalise(input: Partial<OfferInput>, base?: Offer): Result<Omit<OfferRow, "id">> {
  const title = input.title === undefined ? (base?.title ?? "") : trim(input.title, MAX_TITLE);
  if (!title) return { ok: false, error: "la oferta necesita un título" };

  const applyUrl =
    input.apply_url === undefined
      ? { ok: true as const, value: base?.apply_url ?? "" }
      : cleanApplyUrl(input.apply_url);
  if (!applyUrl.ok) return applyUrl;

  const closesAt =
    input.closes_at === undefined
      ? { ok: true as const, value: base?.closes_at ?? "" }
      : cleanClosesAt(input.closes_at);
  if (!closesAt.ok) return closesAt;

  if (input.status !== undefined && !OFFER_STATUSES.includes(input.status)) {
    return { ok: false, error: "ese estado no existe" };
  }

  const salaryMin =
    input.salary_min === undefined ? (base?.salary_min ?? null) : money(input.salary_min);
  const salaryMax =
    input.salary_max === undefined ? (base?.salary_max ?? null) : money(input.salary_max);
  if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
    return { ok: false, error: "el sueldo mínimo no puede ser mayor que el máximo" };
  }

  const stamp = new Date().toISOString();
  const status = input.status ?? base?.status ?? "draft";

  return {
    ok: true,
    value: {
      company_id: input.company_id ?? base?.company_id ?? "",
      title,
      description:
        input.description === undefined
          ? (base?.description ?? "")
          : trim(input.description, MAX_TEXT),
      requirements:
        input.requirements === undefined
          ? (base?.requirements ?? "")
          : trim(input.requirements, MAX_TEXT),
      category:
        input.category === undefined
          ? (base?.category ?? "otros")
          : oneOf(input.category, CATEGORY_SLUGS) || "otros",
      department:
        input.department === undefined
          ? (base?.department ?? "")
          : trim(input.department, MAX_SHORT),
      city: input.city === undefined ? (base?.city ?? "") : trim(input.city, MAX_SHORT),
      level: input.level === undefined ? (base?.level ?? "") : oneOf(input.level, LEVELS),
      remote: input.remote === undefined ? (base?.remote ?? "") : oneOf(input.remote, REMOTES),
      job_type:
        input.job_type === undefined ? (base?.job_type ?? "") : oneOf(input.job_type, JOB_TYPES),
      salary_min: salaryMin,
      salary_max: salaryMax,
      no_experience:
        input.no_experience === undefined
          ? base?.no_experience
            ? 1
            : 0
          : input.no_experience
            ? 1
            : 0,
      experience_years_min: base?.experience_years_min ?? null,
      closes_at: closesAt.value,
      apply_url: applyUrl.value,
      status,
      created_at: base?.created_at ?? stamp,
      updated_at: stamp,
      /** La primera publicación fija la fecha con la que entra al feed; volver
       * a publicar algo archivado no la reescribe. */
      published_at:
        status === "published" ? base?.published_at || stamp : (base?.published_at ?? ""),
    },
  };
}

const COLUMNS = [
  "company_id",
  "title",
  "description",
  "requirements",
  "category",
  "department",
  "city",
  "level",
  "remote",
  "job_type",
  "salary_min",
  "salary_max",
  "no_experience",
  "experience_years_min",
  "closes_at",
  "apply_url",
  "status",
  "created_at",
  "updated_at",
  "published_at",
] as const;

const values = (row: Omit<OfferRow, "id">): (string | number | null)[] =>
  COLUMNS.map((column) => row[column]);

export function create(input: OfferInput): Result<Offer> {
  const company = db()
    .query<{ id: string }, [string]>("SELECT id FROM companies WHERE id = ?")
    .get(input.company_id ?? "");
  if (!company) return { ok: false, error: "esa empresa no existe" };

  const row = normalise(input);
  if (!row.ok) return row;

  const id = crypto.randomUUID();
  db().run(
    `INSERT INTO offers (id, ${COLUMNS.join(", ")})
     VALUES (?, ${COLUMNS.map(() => "?").join(", ")})`,
    [id, ...values(row.value)],
  );

  const created = byId(id);
  return created
    ? { ok: true, value: created }
    : { ok: false, error: "no se pudo crear la oferta" };
}

export function update(id: string, input: Partial<OfferInput>): Result<Offer> {
  const current = byId(id);
  if (!current) return { ok: false, error: "esa oferta no existe" };

  const row = normalise({ ...input, company_id: current.company_id }, current);
  if (!row.ok) return row;

  db().run(
    `UPDATE offers SET ${COLUMNS.map((column) => `${column} = ?`).join(", ")} WHERE id = ?`,
    [...values(row.value), id],
  );

  const updated = byId(id);
  return updated ? { ok: true, value: updated } : { ok: false, error: "esa oferta no existe" };
}

export function remove(id: string): boolean {
  return db().run("DELETE FROM offers WHERE id = ?", [id]).changes > 0;
}

/**
 * Cambia cada vez que se toca una oferta o una empresa. El feed cachea la
 * mezcla de scrapeadas y propias, y este número es lo que le avisa que la
 * rearme sin consultar la base en cada petición.
 *
 * Mira las dos tablas y no solo las ofertas porque quién está aprobado decide
 * qué se ve: si mirara solo ofertas, suspender una empresa dejaría las suyas a
 * la vista hasta que algo más cambiara, que es exactamente lo que un portón de
 * moderación no puede hacer.
 *
 * `total_changes()` va adelante porque los `updated_at` tienen resolución de
 * milisegundo: crear una empresa y aprobarla enseguida da dos veces la misma
 * marca, y sin este contador la aprobación no invalidaría nada. Es el número
 * de escrituras de la conexión, así que cambia sí o sí con cada una.
 */
export function version(): string {
  const row = db()
    .query<
      {
        writes: number;
        offers: number;
        offersLast: string | null;
        companies: number;
        companiesLast: string | null;
      },
      []
    >(
      `SELECT
         total_changes()                              AS writes,
         (SELECT COUNT(*) FROM offers)                AS offers,
         (SELECT MAX(updated_at) FROM offers)         AS offersLast,
         (SELECT COUNT(*) FROM companies)             AS companies,
         (SELECT MAX(updated_at) FROM companies)      AS companiesLast`,
    )
    .get();

  if (!row) return "0";
  return [
    row.writes,
    row.offers,
    row.offersLast ?? "",
    row.companies,
    row.companiesLast ?? "",
  ].join(":");
}

/**
 * Las ofertas propias con forma de Job, para que el resto del sistema (filtro,
 * ranking, facetas, la web) no tenga que saber de dónde salió cada una.
 *
 * El portón de moderación está acá y en ningún otro lado: solo sale lo que
 * está publicado Y cuya empresa está aprobada. Suspender una empresa saca sus
 * ofertas del feed sin tocarlas.
 */
export function publishedJobs(): Job[] {
  return list({ status: "published" })
    .filter((offer) => offer.company_status === "approved")
    .map((offer) => ({
      id: offer.id,
      source: OWN_SOURCE,
      source_id: offer.id,
      title: offer.title,
      company: offer.company_name,
      department: offer.department || null,
      city: offer.city || null,
      category: offer.category,
      category_label: categoryLabel(offer.category),
      category_raw: offer.category,
      date_posted: offer.published_at || offer.created_at,
      level: (offer.level || null) as Level | null,
      remote: (offer.remote || null) as Remote | null,
      job_type: (offer.job_type || null) as JobType | null,
      salary:
        offer.salary_min !== null || offer.salary_max !== null
          ? { min: offer.salary_min, max: offer.salary_max, currency: "UYU" }
          : null,
      experience_years_min: offer.experience_years_min,
      no_experience: offer.no_experience,
      education_level: null,
      schedule: null,
      vacancies: null,
      closes_at: offer.closes_at || null,
      description: offer.description,
      requirements: offer.requirements || null,
      apply_url: offer.apply_url,
      duplicates: [],
    }));
}
