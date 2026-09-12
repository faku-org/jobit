import { CATEGORIES } from "@jobit/worker/categories";
import { departmentOf } from "@jobit/worker/departments";
import { slugify } from "./companies.ts";
import { db } from "./db.ts";
import type { Result } from "./types.ts";

/**
 * Un servicio es lo que alguien ofrece hacer, no una oferta de empleo. No
 * entra en /api/jobs: `filterJobs`, el ranking y las facetas están escritos
 * para ofertas, y mezclarlos ensucia el tablero y las métricas.
 *
 * Lo que sí se comparte es el vocabulario, para que "Programador FullStack" se
 * cuente igual acá que en Mercado.
 */
export const SERVICE_STATUSES = ["draft", "pending", "published", "suspended"] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

/** Lo que puede poner quien publica. Publicar y suspender los decide la
 * moderación, que es previa: nada se ve hasta que se aprueba. */
export const OWNER_STATUSES = ["draft", "pending"] as const;
export type OwnerStatus = (typeof OWNER_STATUSES)[number];

export const CURRENCIES = ["UYU", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const PRICE_KINDS = ["base", "extra"] as const;
export type PriceKind = (typeof PRICE_KINDS)[number];

export const PRICE_UNITS = ["hora", "jornada", "semana", "mes", "proyecto", "unidad"] as const;

/** El mismo vocabulario que las ofertas, para que el filtro diga lo mismo. */
export const WORK_MODES = ["onsite", "remote", "hybrid"] as const;

/** Quién está atrás del servicio: una persona, su equipo o una empresa. */
export const WORK_STYLES = ["individual", "equipo", "empresa"] as const;

export const RESPONSE_TIMES = ["mismo-dia", "48-horas", "semana"] as const;

const CATEGORY_SLUGS = CATEGORIES.map((category) => category.slug);

export interface ServicePrice {
  kind: PriceKind;
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

interface ServiceRow {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  category: string;
  department: string;
  city: string;
  remote: string;
  fixed_price: number;
  work_style: string;
  experience_years: number | null;
  availability_note: string;
  response_time: string;
  status: ServiceStatus;
  rating_avg: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
  published_at: string;
}

export interface Service extends Omit<ServiceRow, "fixed_price"> {
  fixed_price: boolean;
  skills: string[];
  prices: ServicePrice[];
  hours: ServiceHour[];
  /** Quién está atrás. Nunca el correo ni nada que no haga falta para contratar. */
  owner_handle: string;
  owner_name: string;
}

export interface ServiceInput {
  title: string;
  summary?: string;
  description?: string;
  category?: string;
  department?: string;
  city?: string;
  remote?: string;
  fixed_price?: boolean;
  work_style?: string;
  experience_years?: number | null;
  availability_note?: string;
  response_time?: string;
  status?: OwnerStatus;
  skills?: string[];
  prices?: ServicePrice[];
  hours?: ServiceHour[];
}

const MAX_TITLE = 120;
const MAX_SUMMARY = 200;
const MAX_DESCRIPTION = 8000;
const MAX_CITY = 80;
const MAX_NOTE = 300;
const MAX_SKILLS = 20;
const MAX_SKILL = 40;
const MAX_PRICES = 12;
const MAX_LABEL = 80;
const MAX_AMOUNT = 100_000_000;
const MAX_HOURS = 21;
const MAX_EXPERIENCE = 60;

/** Un tope por cuenta: publicar es gratis, pero no es un tablón de anuncios. */
export const MAX_SERVICES_PER_USER = 10;

const trim = (value: string | undefined, max: number): string => (value ?? "").trim().slice(0, max);

const oneOf = (value: string | undefined, allowed: readonly string[]): string =>
  allowed.find((option) => option === value) ?? "";

/** La descripción se muestra como texto: el HTML crudo se saca, no se escapa,
 * porque nadie lo escribió para que se leyera como etiquetas. */
const stripHtml = (value: string): string =>
  value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const HOUR = /^([01]\d|2[0-3]):[0-5]\d$/;

const day = (now: Date): string => now.toISOString().slice(0, 10);

/**
 * El slug entra en la URL de la ficha, así que dos servicios con el mismo
 * título no pueden pisarse.
 */
function uniqueSlug(base: string, excludeId?: string): string {
  const taken = new Set(
    db()
      .query<{ slug: string; id: string }, []>("SELECT slug, id FROM services")
      .all()
      .filter((row) => row.id !== excludeId)
      .map((row) => row.slug),
  );

  const root = base || "servicio";
  if (!taken.has(root)) return root;

  for (let suffix = 2; suffix < 1000; suffix++) {
    const candidate = `${root}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${root}-${Date.now()}`;
}

function cleanSkills(skills: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of skills ?? []) {
    const skill = trim(raw, MAX_SKILL);
    const key = skill.toLowerCase();
    if (!skill || seen.has(key)) continue;

    seen.add(key);
    out.push(skill);
    if (out.length >= MAX_SKILLS) break;
  }

  return out;
}

/**
 * El monto se guarda como la persona lo puso, en la moneda que eligió, y no
 * se convierte nunca al guardar: un precio convertido es un precio que nadie
 * publicó. La conversión aparece solo para ordenar, y se dice que es
 * aproximada.
 */
function cleanPrices(prices: ServicePrice[] | undefined): Result<ServicePrice[]> {
  const out: ServicePrice[] = [];

  for (const raw of (prices ?? []).slice(0, MAX_PRICES)) {
    const amount = Number(raw?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: "cada precio tiene que ser un número mayor que cero" };
    }

    const currency = oneOf(raw?.currency, CURRENCIES);
    if (!currency) return { ok: false, error: "la moneda tiene que ser UYU o USD" };

    out.push({
      kind: (oneOf(raw?.kind, PRICE_KINDS) || "base") as PriceKind,
      label: trim(raw?.label, MAX_LABEL),
      amount: Math.min(Math.round(amount), MAX_AMOUNT),
      currency: currency as Currency,
      unit: oneOf(raw?.unit, PRICE_UNITS),
      notes: trim(raw?.notes, MAX_NOTE),
    });
  }

  return { ok: true, value: out };
}

function cleanHours(hours: ServiceHour[] | undefined): Result<ServiceHour[]> {
  const out: ServiceHour[] = [];
  const seen = new Set<string>();

  for (const raw of (hours ?? []).slice(0, MAX_HOURS)) {
    const weekday = Number(raw?.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return { ok: false, error: "el día tiene que ir de 0 a 6" };
    }

    const from = trim(raw?.from, 5);
    const to = trim(raw?.to, 5);
    if (!HOUR.test(from) || !HOUR.test(to)) {
      return { ok: false, error: "las horas van como HH:MM" };
    }
    if (from >= to) return { ok: false, error: "la hora de inicio va antes que la de fin" };

    const key = `${weekday}-${from}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ weekday, from, to });
  }

  return { ok: true, value: out };
}

const SELECT = `
  SELECT s.*, u.handle AS owner_handle, u.display_name AS owner_name
    FROM services s
    JOIN users u ON u.id = s.user_id
`;

type JoinedRow = ServiceRow & { owner_handle: string; owner_name: string };

function hydrate(row: JoinedRow): Service {
  const skills = db()
    .query<{ skill: string }, [string]>(
      "SELECT skill FROM service_skills WHERE service_id = ? ORDER BY position",
    )
    .all(row.id)
    .map((skill) => skill.skill);

  const prices = db()
    .query<ServicePrice, [string]>(
      `SELECT kind, label, amount, currency, unit, notes
         FROM service_prices WHERE service_id = ? ORDER BY position`,
    )
    .all(row.id);

  const hours = db()
    .query<ServiceHour, [string]>(
      `SELECT weekday, from_time AS "from", to_time AS "to"
         FROM service_hours WHERE service_id = ? ORDER BY weekday, from_time`,
    )
    .all(row.id);

  return { ...row, fixed_price: row.fixed_price === 1, skills, prices, hours };
}

export interface ServiceQuery {
  user_id?: string;
  status?: ServiceStatus;
}

export function list(query: ServiceQuery = {}): Service[] {
  const where: string[] = [];
  const params: string[] = [];

  if (query.user_id) {
    where.push("s.user_id = ?");
    params.push(query.user_id);
  }
  if (query.status) {
    where.push("s.status = ?");
    params.push(query.status);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  return db()
    .query<JoinedRow, string[]>(`${SELECT} ${clause} ORDER BY s.updated_at DESC, s.title`)
    .all(...params)
    .map(hydrate);
}

export function byId(id: string): Service | null {
  const row = db().query<JoinedRow, [string]>(`${SELECT} WHERE s.id = ?`).get(id);
  return row ? hydrate(row) : null;
}

export function bySlug(slug: string): Service | null {
  const row = db().query<JoinedRow, [string]>(`${SELECT} WHERE s.slug = ?`).get(slug);
  return row ? hydrate(row) : null;
}

export const countByUser = (userId: string): number =>
  db()
    .query<{ n: number }, [string]>("SELECT COUNT(*) AS n FROM services WHERE user_id = ?")
    .get(userId)?.n ?? 0;

export function counts(): Record<ServiceStatus, number> {
  const rows = db()
    .query<{ status: ServiceStatus; n: number }, []>(
      "SELECT status, COUNT(*) AS n FROM services GROUP BY status",
    )
    .all();

  const out = { draft: 0, pending: 0, published: 0, suspended: 0 };
  for (const row of rows) if (row.status in out) out[row.status] = row.n;
  return out;
}

/** Las tres tablas hijas se escriben juntas: son parte del mismo servicio. */
function writeChildren(
  id: string,
  skills: string[],
  prices: ServicePrice[],
  hours: ServiceHour[],
): void {
  db().run("DELETE FROM service_skills WHERE service_id = ?", [id]);
  db().run("DELETE FROM service_prices WHERE service_id = ?", [id]);
  db().run("DELETE FROM service_hours WHERE service_id = ?", [id]);

  skills.forEach((skill, position) => {
    db().run("INSERT INTO service_skills (service_id, skill, position) VALUES (?, ?, ?)", [
      id,
      skill,
      position,
    ]);
  });

  prices.forEach((price, position) => {
    db().run(
      `INSERT INTO service_prices (service_id, kind, label, amount, currency, unit, notes, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        price.kind,
        price.label,
        price.amount,
        price.currency,
        price.unit,
        price.notes,
        position,
      ],
    );
  });

  for (const hour of hours) {
    db().run(
      "INSERT OR REPLACE INTO service_hours (service_id, weekday, from_time, to_time) VALUES (?, ?, ?, ?)",
      [id, hour.weekday, hour.from, hour.to],
    );
  }
}

interface CleanFields {
  title: string;
  summary: string;
  description: string;
  category: string;
  department: string;
  city: string;
  remote: string;
  fixed_price: number;
  work_style: string;
  experience_years: number | null;
  availability_note: string;
  response_time: string;
}

function cleanFields(input: Partial<ServiceInput>, current?: ServiceRow): Result<CleanFields> {
  const title = input.title === undefined ? (current?.title ?? "") : trim(input.title, MAX_TITLE);
  if (!title) return { ok: false, error: "el servicio necesita un título" };

  const department =
    input.department === undefined
      ? (current?.department ?? "")
      : (departmentOf(input.department) ?? "");
  if (input.department?.trim() && !department) {
    return { ok: false, error: "ese departamento no existe" };
  }

  const experience =
    input.experience_years === undefined
      ? (current?.experience_years ?? null)
      : input.experience_years === null || !Number.isFinite(Number(input.experience_years))
        ? null
        : Math.min(Math.max(Math.round(Number(input.experience_years)), 0), MAX_EXPERIENCE);

  return {
    ok: true,
    value: {
      title,
      summary:
        input.summary === undefined ? (current?.summary ?? "") : trim(input.summary, MAX_SUMMARY),
      description:
        input.description === undefined
          ? (current?.description ?? "")
          : stripHtml(trim(input.description, MAX_DESCRIPTION)),
      category:
        input.category === undefined
          ? (current?.category ?? "otros")
          : oneOf(input.category, CATEGORY_SLUGS) || "otros",
      department,
      city: input.city === undefined ? (current?.city ?? "") : trim(input.city, MAX_CITY),
      remote:
        input.remote === undefined ? (current?.remote ?? "") : oneOf(input.remote, WORK_MODES),
      fixed_price:
        input.fixed_price === undefined ? (current?.fixed_price ?? 0) : input.fixed_price ? 1 : 0,
      work_style:
        input.work_style === undefined
          ? (current?.work_style ?? "")
          : oneOf(input.work_style, WORK_STYLES),
      experience_years: experience,
      availability_note:
        input.availability_note === undefined
          ? (current?.availability_note ?? "")
          : trim(input.availability_note, MAX_NOTE),
      response_time:
        input.response_time === undefined
          ? (current?.response_time ?? "")
          : oneOf(input.response_time, RESPONSE_TIMES),
    },
  };
}

const ownerStatus = (value: string | undefined): OwnerStatus =>
  (oneOf(value, OWNER_STATUSES) || "draft") as OwnerStatus;

export function create(
  userId: string,
  input: ServiceInput,
  now: Date = new Date(),
): Result<Service> {
  if (countByUser(userId) >= MAX_SERVICES_PER_USER) {
    return { ok: false, error: `no se pueden tener más de ${MAX_SERVICES_PER_USER} servicios` };
  }

  const fields = cleanFields(input);
  if (!fields.ok) return fields;

  const prices = cleanPrices(input.prices);
  if (!prices.ok) return prices;
  const hours = cleanHours(input.hours);
  if (!hours.ok) return hours;

  const id = crypto.randomUUID();
  const stamp = day(now);

  db().run(
    `INSERT INTO services (id, user_id, title, slug, summary, description, category, department,
                           city, remote, fixed_price, work_style, experience_years,
                           availability_note, response_time, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      fields.value.title,
      uniqueSlug(slugify(fields.value.title)),
      fields.value.summary,
      fields.value.description,
      fields.value.category,
      fields.value.department,
      fields.value.city,
      fields.value.remote,
      fields.value.fixed_price,
      fields.value.work_style,
      fields.value.experience_years,
      fields.value.availability_note,
      fields.value.response_time,
      ownerStatus(input.status),
      stamp,
      stamp,
    ],
  );

  writeChildren(id, cleanSkills(input.skills), prices.value, hours.value);

  const service = byId(id);
  return service ? { ok: true, value: service } : { ok: false, error: "no se pudo crear" };
}

const rowById = (id: string): ServiceRow | null =>
  db().query<ServiceRow, [string]>("SELECT * FROM services WHERE id = ?").get(id) ?? null;

/**
 * Editar lo publicado lo manda de vuelta a la cola. La moderación es previa:
 * si el texto cambia después de aprobado, lo aprobado ya no es lo que se ve.
 */
export function update(
  id: string,
  userId: string,
  input: Partial<ServiceInput>,
  now: Date = new Date(),
): Result<Service> {
  const current = rowById(id);
  if (!current || current.user_id !== userId) return { ok: false, error: "ese servicio no existe" };

  const fields = cleanFields(input, current);
  if (!fields.ok) return fields;

  const prices = input.prices === undefined ? undefined : cleanPrices(input.prices);
  if (prices && !prices.ok) return prices;
  const hours = input.hours === undefined ? undefined : cleanHours(input.hours);
  if (hours && !hours.ok) return hours;

  const asked = input.status === undefined ? undefined : ownerStatus(input.status);
  const status: ServiceStatus =
    current.status === "suspended"
      ? "suspended"
      : current.status === "published"
        ? "pending"
        : (asked ?? current.status);

  db().run(
    `UPDATE services
        SET title = ?, slug = ?, summary = ?, description = ?, category = ?, department = ?,
            city = ?, remote = ?, fixed_price = ?, work_style = ?, experience_years = ?,
            availability_note = ?, response_time = ?, status = ?, updated_at = ?
      WHERE id = ?`,
    [
      fields.value.title,
      fields.value.title === current.title
        ? current.slug
        : uniqueSlug(slugify(fields.value.title), id),
      fields.value.summary,
      fields.value.description,
      fields.value.category,
      fields.value.department,
      fields.value.city,
      fields.value.remote,
      fields.value.fixed_price,
      fields.value.work_style,
      fields.value.experience_years,
      fields.value.availability_note,
      fields.value.response_time,
      status,
      day(now),
      id,
    ],
  );

  if (input.skills !== undefined || prices || hours) {
    const service = byId(id);
    writeChildren(
      id,
      input.skills === undefined ? (service?.skills ?? []) : cleanSkills(input.skills),
      prices ? prices.value : (service?.prices ?? []),
      hours ? hours.value : (service?.hours ?? []),
    );
  }

  const updated = byId(id);
  return updated ? { ok: true, value: updated } : { ok: false, error: "ese servicio no existe" };
}

/** Solo lo propio: el dueño va en el WHERE y no en un `if` de más arriba. */
export const remove = (id: string, userId: string): boolean =>
  db().run("DELETE FROM services WHERE id = ? AND user_id = ?", [id, userId]).changes > 0;

/**
 * Lo que decide la moderación. `published_at` se escribe la primera vez que
 * algo se publica y no se vuelve a tocar: es la fecha de alta en el tablero.
 */
export function setStatus(id: string, status: ServiceStatus, now: Date = new Date()): boolean {
  const current = rowById(id);
  if (!current) return false;

  const publishedAt =
    status === "published" && !current.published_at ? day(now) : current.published_at;

  return (
    db().run("UPDATE services SET status = ?, published_at = ?, updated_at = ? WHERE id = ?", [
      status,
      publishedAt,
      day(now),
      id,
    ]).changes > 0
  );
}
