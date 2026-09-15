import { CATEGORIES, categoryLabel } from "@jobit/worker/categories";
import { db } from "./db.ts";
import type { Result } from "./types.ts";

/**
 * Lo que alguien ofrece hacer, que no es una oferta de empleo y no entra en
 * /api/jobs: `filterJobs`, el ranking y las facetas están escritos para
 * ofertas, y mezclarlos ensucia el tablero y las métricas.
 *
 * Lo que sí se comparte es el vocabulario. Un servicio se clasifica con los
 * mismos rubros que una oferta, para que "Programador FullStack" se cuente
 * igual acá que en Mercado.
 */
export const SERVICE_STATUSES = ["draft", "pending", "published", "suspended"] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

/** Se guarda lo que la persona puso y no se convierte nunca al guardar: un
 * precio convertido es un precio que nadie publicó. */
export const CURRENCIES = ["UYU", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const PRICE_KINDS = ["base", "extra"] as const;
export const PRICE_UNITS = ["hora", "dia", "jornada", "proyecto", "mes", "unidad"] as const;
export const WORK_STYLES = ["proyecto", "hora", "jornada", "mixto"] as const;
export const RESPONSE_TIMES = ["mismo_dia", "24h", "48h", "semana"] as const;

/**
 * Por dónde contactar. Es una lista y no texto libre porque cada una se valida
 * distinto, y porque un "contacto" que acepta cualquier cosa termina siendo un
 * enlace armado por un tercero hacia quien mire la ficha.
 */
export const CONTACT_KINDS = ["whatsapp", "email", "web", "telegram", "instagram"] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

const CATEGORY_SLUGS = CATEGORIES.map((category) => category.slug);

/** Tope por cuenta: publicar es gratis, pero una cuenta no es un tablón. */
export const MAX_PER_USER = 5;

const MAX_TITLE = 120;
const MAX_SUMMARY = 240;
const MAX_DESCRIPTION = 8_000;
const MAX_SHORT = 120;
const MAX_NOTE = 240;
const MAX_SKILLS = 12;
const MAX_SKILL = 40;
const MAX_PRICES = 10;
const MAX_PRICE_LABEL = 60;
const MAX_PRICE_NOTES = 200;
const MAX_AMOUNT = 100_000_000;
const MAX_HOURS = 21;
const MAX_EXPERIENCE = 60;

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
  remote: number;
  fixed_price: number;
  work_style: string;
  experience_years: number | null;
  availability_note: string;
  response_time: string;
  contact_kind: string;
  contact_value: string;
  status: ServiceStatus;
  rating_avg: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
  published_at: string;
}

export interface ServicePrice {
  kind: (typeof PRICE_KINDS)[number];
  label: string;
  amount: number;
  currency: Currency;
  unit: (typeof PRICE_UNITS)[number];
  notes: string;
}

export interface ServiceHours {
  /** 0 es domingo, como en Date.getDay(). */
  weekday: number;
  starts_at: string;
  ends_at: string;
}

export interface Service extends Omit<ServiceRow, "remote" | "fixed_price"> {
  remote: boolean;
  fixed_price: boolean;
  category_label: string;
  skills: string[];
  prices: ServicePrice[];
  hours: ServiceHours[];
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
  remote?: boolean;
  fixed_price?: boolean;
  work_style?: string;
  experience_years?: number | null;
  availability_note?: string;
  response_time?: string;
  contact_kind?: string;
  contact_value?: string;
  /** El dueño solo puede pedir draft o pending. Ver `askedStatus`. */
  status?: string;
  skills?: string[];
  prices?: Partial<ServicePrice>[];
  hours?: Partial<ServiceHours>[];
}

const trim = (value: string | undefined, max: number): string => (value ?? "").trim().slice(0, max);

const oneOf = <T extends string>(value: string | undefined, allowed: readonly T[]): T | "" =>
  allowed.find((option) => option === value) ?? "";

export function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** El slug va en una URL pública, así que dos servicios con el mismo título no
 * pueden pisarse. */
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

/**
 * El contacto se valida según por dónde sea. Un teléfono se guarda en dígitos
 * y una web tiene que ser http(s): un `javascript:` acá sería un enlace armado
 * por quien publica hacia quien mire la ficha.
 */
function cleanContact(kind: string, value: string): Result<{ kind: string; value: string }> {
  const chosen = oneOf(kind, CONTACT_KINDS);
  const raw = trim(value, 200);

  if (!chosen || !raw) return { ok: true, value: { kind: "", value: "" } };

  if (chosen === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      return { ok: false, error: "ese correo de contacto no parece válido" };
    }
    return { ok: true, value: { kind: chosen, value: raw.toLowerCase() } };
  }

  if (chosen === "whatsapp") {
    const digits = raw.replace(/[^\d+]/g, "");
    if (!/^\+?\d{8,15}$/.test(digits)) {
      return { ok: false, error: "el teléfono tiene que ser un número de 8 a 15 dígitos" };
    }
    return { ok: true, value: { kind: chosen, value: digits } };
  }

  if (chosen === "web") {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return { ok: false, error: "el sitio tiene que ser una dirección completa" };
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, error: "el sitio tiene que empezar con http:// o https://" };
    }
    return { ok: true, value: { kind: chosen, value: url.toString() } };
  }

  /** telegram e instagram son nombres de usuario, sin arroba y sin URL. */
  const handle = raw.replace(/^@+/, "");
  if (!/^[A-Za-z0-9._]{2,40}$/.test(handle)) {
    return { ok: false, error: "ese usuario de contacto no parece válido" };
  }
  return { ok: true, value: { kind: chosen, value: handle } };
}

const cleanSkills = (skills: string[] | undefined): string[] => {
  if (!skills) return [];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of skills) {
    const skill = trim(raw, MAX_SKILL);
    const key = skill.toLowerCase();
    if (!skill || seen.has(key)) continue;
    seen.add(key);
    out.push(skill);
    if (out.length >= MAX_SKILLS) break;
  }
  return out;
};

function cleanPrices(prices: Partial<ServicePrice>[] | undefined): Result<ServicePrice[]> {
  if (!prices) return { ok: true, value: [] };

  const out: ServicePrice[] = [];
  for (const price of prices.slice(0, MAX_PRICES)) {
    const amount = Number(price.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: "cada precio tiene que ser un número mayor que cero" };
    }

    out.push({
      kind: oneOf(price.kind, PRICE_KINDS) || "base",
      label: trim(price.label, MAX_PRICE_LABEL),
      amount: Math.min(Math.round(amount), MAX_AMOUNT),
      currency: oneOf(price.currency, CURRENCIES) || "UYU",
      unit: oneOf(price.unit, PRICE_UNITS) || "proyecto",
      notes: trim(price.notes, MAX_PRICE_NOTES),
    });
  }
  return { ok: true, value: out };
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function cleanHours(hours: Partial<ServiceHours>[] | undefined): Result<ServiceHours[]> {
  if (!hours) return { ok: true, value: [] };

  const out: ServiceHours[] = [];
  for (const block of hours.slice(0, MAX_HOURS)) {
    const weekday = Number(block.weekday);
    const starts = trim(block.starts_at, 5);
    const ends = trim(block.ends_at, 5);

    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return { ok: false, error: "el día de la semana va de 0 a 6" };
    }
    if (!HHMM.test(starts) || !HHMM.test(ends)) {
      return { ok: false, error: "los horarios van en formato HH:MM" };
    }
    if (starts >= ends) {
      return { ok: false, error: "cada tramo tiene que terminar después de empezar" };
    }
    out.push({ weekday, starts_at: starts, ends_at: ends });
  }
  return { ok: true, value: out };
}

/**
 * Lo único que el dueño puede pedir. `published` y `suspended` los pone la
 * moderación: si cualquiera pudiera pedirlos, la cola de #29 sería decorativa.
 */
const askedStatus = (value: string | undefined): "draft" | "pending" =>
  value === "pending" ? "pending" : "draft";

const hydrate = (row: ServiceRow & { owner_handle: string; owner_name: string }): Service => ({
  ...row,
  remote: row.remote === 1,
  fixed_price: row.fixed_price === 1,
  category_label: categoryLabel(row.category),
  skills: db()
    .query<{ skill: string }, [string]>(
      "SELECT skill FROM service_skills WHERE service_id = ? ORDER BY position",
    )
    .all(row.id)
    .map((skill) => skill.skill),
  prices: db()
    .query<ServicePrice, [string]>(
      `SELECT kind, label, amount, currency, unit, notes
         FROM service_prices WHERE service_id = ? ORDER BY position`,
    )
    .all(row.id),
  hours: db()
    .query<ServiceHours, [string]>(
      `SELECT weekday, starts_at, ends_at
         FROM service_hours WHERE service_id = ? ORDER BY weekday, starts_at`,
    )
    .all(row.id),
});

const SELECT = `
  SELECT s.*, u.handle AS owner_handle, u.display_name AS owner_name
    FROM services s
    JOIN users u ON u.id = s.user_id
`;

export function byId(id: string): Service | null {
  const row = db()
    .query<ServiceRow & { owner_handle: string; owner_name: string }, [string]>(
      `${SELECT} WHERE s.id = ?`,
    )
    .get(id);
  return row ? hydrate(row) : null;
}

export function bySlug(slug: string): Service | null {
  const row = db()
    .query<ServiceRow & { owner_handle: string; owner_name: string }, [string]>(
      `${SELECT} WHERE s.slug = ?`,
    )
    .get(slug);
  return row ? hydrate(row) : null;
}

export function listByUser(userId: string): Service[] {
  return db()
    .query<ServiceRow & { owner_handle: string; owner_name: string }, [string]>(
      `${SELECT} WHERE s.user_id = ? ORDER BY s.updated_at DESC`,
    )
    .all(userId)
    .map(hydrate);
}

export function listByStatus(status: ServiceStatus): Service[] {
  return db()
    .query<ServiceRow & { owner_handle: string; owner_name: string }, [string]>(
      `${SELECT} WHERE s.status = ? ORDER BY s.updated_at ASC`,
    )
    .all(status)
    .map(hydrate);
}

export function counts(): Record<ServiceStatus, number> {
  const rows = db()
    .query<{ status: ServiceStatus; n: number }, []>(
      "SELECT status, COUNT(*) AS n FROM services GROUP BY status",
    )
    .all();

  const out: Record<ServiceStatus, number> = {
    draft: 0,
    pending: 0,
    published: 0,
    suspended: 0,
  };
  for (const row of rows) {
    if ((SERVICE_STATUSES as readonly string[]).includes(row.status)) out[row.status] = row.n;
  }
  return out;
}

export function countByUser(userId: string): Record<ServiceStatus, number> {
  const rows = db()
    .query<{ status: ServiceStatus; n: number }, [string]>(
      "SELECT status, COUNT(*) AS n FROM services WHERE user_id = ? GROUP BY status",
    )
    .all(userId);

  const out: Record<ServiceStatus, number> = {
    draft: 0,
    pending: 0,
    published: 0,
    suspended: 0,
  };
  for (const row of rows) {
    if ((SERVICE_STATUSES as readonly string[]).includes(row.status)) out[row.status] = row.n;
  }
  return out;
}

interface Normalised {
  row: Omit<ServiceRow, "id" | "user_id" | "rating_avg" | "rating_count">;
  skills: string[];
  prices: ServicePrice[];
  hours: ServiceHours[];
}

function normalise(input: ServiceInput, current: Service | null, now: Date): Result<Normalised> {
  const title = trim(input.title ?? current?.title, MAX_TITLE);
  if (!title) return { ok: false, error: "el servicio necesita un título" };

  const contact = cleanContact(
    input.contact_kind ?? current?.contact_kind ?? "",
    input.contact_value ?? current?.contact_value ?? "",
  );
  if (!contact.ok) return contact;

  const prices = cleanPrices(input.prices ?? current?.prices);
  if (!prices.ok) return prices;

  const hours = cleanHours(input.hours ?? current?.hours);
  if (!hours.ok) return hours;

  const status = askedStatus(input.status ?? current?.status);

  /** Un borrador puede estar a medio llenar; algo que va a la cola, no. Pedir
   * esto recién acá deja guardar sin terminar, que es como se escribe. */
  if (status === "pending") {
    if (!contact.value.kind) {
      return { ok: false, error: "para publicar hace falta decir por dónde te contactan" };
    }
    if (trim(input.summary ?? current?.summary, MAX_SUMMARY).length < 20) {
      return { ok: false, error: "el resumen necesita al menos 20 caracteres" };
    }
    if (prices.value.length === 0) {
      return { ok: false, error: "para publicar hace falta al menos un precio" };
    }
  }

  const experience =
    input.experience_years === undefined
      ? (current?.experience_years ?? null)
      : input.experience_years === null || !Number.isFinite(Number(input.experience_years))
        ? null
        : Math.min(Math.max(Math.round(Number(input.experience_years)), 0), MAX_EXPERIENCE);

  const stamp = now.toISOString();

  return {
    ok: true,
    value: {
      row: {
        title,
        slug:
          current && title === current.title
            ? current.slug
            : uniqueSlug(slugify(title), current?.id),
        summary: trim(input.summary ?? current?.summary, MAX_SUMMARY),
        description: trim(input.description ?? current?.description, MAX_DESCRIPTION),
        category: oneOf(input.category ?? current?.category, CATEGORY_SLUGS) || "otros",
        department: trim(input.department ?? current?.department, MAX_SHORT),
        city: trim(input.city ?? current?.city, MAX_SHORT),
        remote: (input.remote ?? current?.remote) ? 1 : 0,
        fixed_price: (input.fixed_price ?? current?.fixed_price) ? 1 : 0,
        work_style: oneOf(input.work_style ?? current?.work_style, WORK_STYLES),
        experience_years: experience,
        availability_note: trim(input.availability_note ?? current?.availability_note, MAX_NOTE),
        response_time: oneOf(input.response_time ?? current?.response_time, RESPONSE_TIMES),
        contact_kind: contact.value.kind,
        contact_value: contact.value.value,
        status,
        created_at: current?.created_at ?? stamp,
        updated_at: stamp,
        /** Se fija cuando la moderación publica, no cuando el dueño guarda. */
        published_at: current?.published_at ?? "",
      },
      skills: cleanSkills(input.skills ?? current?.skills),
      prices: prices.value,
      hours: hours.value,
    },
  };
}

const COLUMNS = [
  "user_id",
  "title",
  "slug",
  "summary",
  "description",
  "category",
  "department",
  "city",
  "remote",
  "fixed_price",
  "work_style",
  "experience_years",
  "availability_note",
  "response_time",
  "contact_kind",
  "contact_value",
  "status",
  "created_at",
  "updated_at",
  "published_at",
] as const;

function writeChildren(id: string, value: Normalised): void {
  db().run("DELETE FROM service_skills WHERE service_id = ?", [id]);
  db().run("DELETE FROM service_prices WHERE service_id = ?", [id]);
  db().run("DELETE FROM service_hours WHERE service_id = ?", [id]);

  const skill = db().prepare(
    "INSERT INTO service_skills (service_id, skill, position) VALUES (?, ?, ?)",
  );
  value.skills.forEach((name, position) => skill.run(id, name, position));

  const price = db().prepare(
    `INSERT INTO service_prices (service_id, kind, label, amount, currency, unit, notes, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  value.prices.forEach((row, position) =>
    price.run(id, row.kind, row.label, row.amount, row.currency, row.unit, row.notes, position),
  );

  const hour = db().prepare(
    "INSERT INTO service_hours (service_id, weekday, starts_at, ends_at) VALUES (?, ?, ?, ?)",
  );
  for (const row of value.hours) hour.run(id, row.weekday, row.starts_at, row.ends_at);
}

export function create(
  userId: string,
  input: ServiceInput,
  now: Date = new Date(),
): Result<Service> {
  const mine = countByUser(userId);
  const total = mine.draft + mine.pending + mine.published + mine.suspended;
  if (total >= MAX_PER_USER) {
    return { ok: false, error: `no se pueden tener más de ${MAX_PER_USER} servicios por cuenta` };
  }

  const normalised = normalise(input, null, now);
  if (!normalised.ok) return normalised;

  const id = crypto.randomUUID();
  const row = { ...normalised.value.row, user_id: userId };

  db().run(
    `INSERT INTO services (id, ${COLUMNS.join(", ")})
     VALUES (?, ${COLUMNS.map(() => "?").join(", ")})`,
    [id, ...COLUMNS.map((column) => row[column])],
  );
  writeChildren(id, normalised.value);

  const created = byId(id);
  return created ? { ok: true, value: created } : { ok: false, error: "no se pudo crear" };
}

/**
 * Editar algo publicado lo devuelve a la cola. Es incómodo y es el precio de
 * que la moderación sea previa: si un servicio aprobado pudiera reescribirse
 * entero sin volver a pasar, aprobar no querría decir nada.
 */
const TEXT_FIELDS = ["title", "summary", "description", "skills", "prices"] as const;

function touchesModeratedText(input: Partial<ServiceInput>): boolean {
  return TEXT_FIELDS.some((field) => input[field] !== undefined);
}

export function update(
  id: string,
  userId: string,
  input: Partial<ServiceInput>,
  now: Date = new Date(),
): Result<Service> {
  const current = byId(id);
  if (!current || current.user_id !== userId) {
    return { ok: false, error: "ese servicio no existe" };
  }

  const normalised = normalise({ ...input, title: input.title ?? current.title }, current, now);
  if (!normalised.ok) return normalised;

  const wasPublic = current.status === "published" || current.status === "suspended";
  const status =
    wasPublic && touchesModeratedText(input)
      ? "pending"
      : wasPublic
        ? current.status
        : normalised.value.row.status;

  const row = { ...normalised.value.row, status, user_id: userId };

  db().run(
    `UPDATE services SET ${COLUMNS.map((column) => `${column} = ?`).join(", ")} WHERE id = ?`,
    [...COLUMNS.map((column) => row[column]), id],
  );
  writeChildren(id, normalised.value);

  const updated = byId(id);
  return updated ? { ok: true, value: updated } : { ok: false, error: "no se pudo guardar" };
}

export function remove(id: string, userId: string): boolean {
  return db().run("DELETE FROM services WHERE id = ? AND user_id = ?", [id, userId]).changes > 0;
}

/**
 * Lo que hace la moderación, que no es el dueño. Publicar fija la fecha con la
 * que el servicio entra a la lista pública; volver a publicar algo suspendido
 * no la reescribe.
 */
export function moderate(
  id: string,
  status: ServiceStatus,
  now: Date = new Date(),
): Result<Service> {
  const current = byId(id);
  if (!current) return { ok: false, error: "ese servicio no existe" };

  const stamp = now.toISOString();
  const publishedAt = status === "published" ? current.published_at || stamp : current.published_at;

  db().run("UPDATE services SET status = ?, published_at = ?, updated_at = ? WHERE id = ?", [
    status,
    publishedAt,
    stamp,
    id,
  ]);

  const updated = byId(id);
  return updated ? { ok: true, value: updated } : { ok: false, error: "no se pudo moderar" };
}
