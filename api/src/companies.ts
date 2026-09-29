import { db } from "./db.ts";
import type { Result } from "./types.ts";

export const COMPANY_STATUSES = ["pending", "approved", "suspended"] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

/** Las redes que la ficha sabe dibujar con icono. El resto no se guarda: un
 * enlace a una red que nadie reconoce no aporta nada. */
export const SOCIAL_NETWORKS = [
  "linkedin",
  "instagram",
  "facebook",
  "x",
  "youtube",
  "tiktok",
  "whatsapp",
] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];
export type Socials = Partial<Record<SocialNetwork, string>>;

export interface Company {
  id: string;
  name: string;
  slug: string;
  email: string;
  website: string;
  phone: string;
  /** URL pública del archivo, no la ruta en disco. Vacío es que no hay. */
  logo: string;
  banner: string;
  socials: Socials;
  status: CompanyStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

/** En la base las redes son un JSON; en el dominio, un objeto. */
interface CompanyRow extends Omit<Company, "socials"> {
  socials: string;
}

export interface CompanyInput {
  name: string;
  email?: string;
  website?: string;
  phone?: string;
  socials?: Socials;
  status?: CompanyStatus;
  notes?: string;
}

const MAX_NAME = 120;
const MAX_NOTES = 2000;
const MAX_URL = 300;
const MAX_PHONE = 40;

/** "Frigorífico Ñandú S.A." -> "frigorifico-nandu-sa" */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * El slug entra en una URL pública, así que dos empresas con el mismo nombre no
 * pueden pisarse: la segunda queda como "acme-2".
 */
function uniqueSlug(base: string, excludeId?: string): string {
  const taken = new Set(
    db()
      .query<{ slug: string }, []>("SELECT slug FROM companies")
      .all()
      .map((row) => row.slug),
  );

  if (excludeId) {
    const current = byId(excludeId);
    if (current) taken.delete(current.slug);
  }

  const root = base || "empresa";
  if (!taken.has(root)) return root;

  for (let suffix = 2; suffix < 1000; suffix++) {
    const candidate = `${root}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${root}-${Date.now()}`;
}

const trim = (value: string | undefined, max: number): string => (value ?? "").trim().slice(0, max);

/** Solo http(s): un javascript: en el sitio de una empresa sería un enlace
 * armado desde el panel hacia quien mire la ficha. */
function cleanUrl(value: string | undefined): Result<string> {
  const raw = trim(value, MAX_URL);
  if (!raw) return { ok: true, value: "" };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "el sitio tiene que ser una dirección completa" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "el sitio tiene que empezar con http:// o https://" };
  }
  return { ok: true, value: url.toString() };
}

function cleanEmail(value: string | undefined): Result<string> {
  const raw = trim(value, MAX_URL);
  if (!raw) return { ok: true, value: "" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return { ok: false, error: "el correo no parece válido" };
  }
  return { ok: true, value: raw.toLowerCase() };
}

/** Teléfono, no una máscara: se aceptan espacios, guiones, paréntesis y +. */
function cleanPhone(value: string | undefined): Result<string> {
  const raw = trim(value, MAX_PHONE);
  if (!raw) return { ok: true, value: "" };
  if (!/^[+()\d][\d\s()+-]*$/.test(raw)) {
    return { ok: false, error: "el teléfono solo lleva números y signos de separación" };
  }
  return { ok: true, value: raw };
}

/** Cada red es una URL http(s). Una que no lo sea se descarta sin romper el resto. */
function cleanSocials(value: Socials | undefined): Result<string> {
  const out: Socials = {};
  for (const network of SOCIAL_NETWORKS) {
    const raw = (value?.[network] ?? "").trim().slice(0, MAX_URL);
    if (!raw) continue;

    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return { ok: false, error: `el enlace de ${network} tiene que ser una dirección completa` };
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, error: `el enlace de ${network} tiene que ser http:// o https://` };
    }
    out[network] = url.toString();
  }
  return { ok: true, value: JSON.stringify(out) };
}

function parseSocials(raw: string): Socials {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Socials = {};
    for (const network of SOCIAL_NETWORKS) {
      const value = (parsed as Record<string, unknown>)[network];
      if (typeof value === "string" && value) out[network] = value;
    }
    return out;
  } catch {
    return {};
  }
}

const hydrate = (row: CompanyRow): Company => ({ ...row, socials: parseSocials(row.socials) });

const isStatus = (value: unknown): value is CompanyStatus =>
  (COMPANY_STATUSES as readonly unknown[]).includes(value);

export interface CompanyQuery {
  status?: CompanyStatus;
  q?: string;
}

export function list(query: CompanyQuery = {}): Company[] {
  const where: string[] = [];
  const params: string[] = [];

  if (query.status) {
    where.push("status = ?");
    params.push(query.status);
  }
  if (query.q?.trim()) {
    where.push("(name LIKE ? OR email LIKE ?)");
    const like = `%${query.q.trim()}%`;
    params.push(like, like);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  return db()
    .query<CompanyRow, string[]>(
      `SELECT * FROM companies ${clause} ORDER BY
         CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
         name COLLATE NOCASE`,
    )
    .all(...params)
    .map(hydrate);
}

export function byId(id: string): Company | null {
  const row = db().query<CompanyRow, [string]>("SELECT * FROM companies WHERE id = ?").get(id);
  return row ? hydrate(row) : null;
}

export function bySlug(slug: string): Company | null {
  const normalised = slug.trim().toLowerCase();
  const row = db()
    .query<CompanyRow, [string]>("SELECT * FROM companies WHERE slug = ?")
    .get(normalised);
  return row ? hydrate(row) : null;
}

export function byEmail(email: string): Company | null {
  const normalised = email.trim().toLowerCase();
  if (!normalised) return null;
  const row = db()
    .query<CompanyRow, [string]>("SELECT * FROM companies WHERE email = ? LIMIT 1")
    .get(normalised);
  return row ? hydrate(row) : null;
}

/**
 * Cómo entra una empresa: con el correo o con el slug de su URL. Los dos son
 * únicos; el correo se guarda en minúsculas y el slug ya lo está.
 */
export function byEmailOrSlug(identifier: string): Company | null {
  const value = identifier.trim().toLowerCase();
  if (!value) return null;

  return byEmail(value) ?? bySlug(value);
}

export function counts(): Record<CompanyStatus, number> {
  const rows = db()
    .query<{ status: CompanyStatus; n: number }, []>(
      "SELECT status, COUNT(*) AS n FROM companies GROUP BY status",
    )
    .all();

  const out = { pending: 0, approved: 0, suspended: 0 };
  for (const row of rows) if (isStatus(row.status)) out[row.status] = row.n;
  return out;
}

export function create(input: CompanyInput, now: Date = new Date()): Result<Company> {
  const name = trim(input.name, MAX_NAME);
  if (!name) return { ok: false, error: "la empresa necesita un nombre" };

  const email = cleanEmail(input.email);
  if (!email.ok) return email;
  const website = cleanUrl(input.website);
  if (!website.ok) return website;
  const phone = cleanPhone(input.phone);
  if (!phone.ok) return phone;
  const socials = cleanSocials(input.socials);
  if (!socials.ok) return socials;

  const stamp = now.toISOString();
  const company: Company = {
    id: crypto.randomUUID(),
    name,
    slug: uniqueSlug(slugify(name)),
    email: email.value,
    website: website.value,
    phone: phone.value,
    logo: "",
    banner: "",
    socials: input.socials ?? {},
    status: isStatus(input.status) ? input.status : "pending",
    notes: trim(input.notes, MAX_NOTES),
    created_at: stamp,
    updated_at: stamp,
  };

  db().run(
    `INSERT INTO companies
       (id, name, slug, email, website, phone, logo, banner, socials, status, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, ?, ?)`,
    [
      company.id,
      company.name,
      company.slug,
      company.email,
      company.website,
      company.phone,
      socials.value,
      company.status,
      company.notes,
      company.created_at,
      company.updated_at,
    ],
  );

  const stored: CompanyRow = { ...company, socials: socials.value };
  return { ok: true, value: hydrate(stored) };
}

export function update(
  id: string,
  input: Partial<CompanyInput>,
  now: Date = new Date(),
): Result<Company> {
  const current = byId(id);
  if (!current) return { ok: false, error: "esa empresa no existe" };

  const name = input.name === undefined ? current.name : trim(input.name, MAX_NAME);
  if (!name) return { ok: false, error: "la empresa necesita un nombre" };

  const email =
    input.email === undefined
      ? { ok: true as const, value: current.email }
      : cleanEmail(input.email);
  if (!email.ok) return email;
  const website =
    input.website === undefined
      ? { ok: true as const, value: current.website }
      : cleanUrl(input.website);
  if (!website.ok) return website;
  const phone =
    input.phone === undefined ? { ok: true as const, value: current.phone } : cleanPhone(input.phone);
  if (!phone.ok) return phone;
  const socials =
    input.socials === undefined
      ? { ok: true as const, value: JSON.stringify(current.socials) }
      : cleanSocials(input.socials);
  if (!socials.ok) return socials;

  if (input.status !== undefined && !isStatus(input.status)) {
    return { ok: false, error: "ese estado no existe" };
  }

  const next: Company = {
    ...current,
    name,
    /** El slug sigue al nombre, porque es lo que se ve en la URL. */
    slug: name === current.name ? current.slug : uniqueSlug(slugify(name), id),
    email: email.value,
    website: website.value,
    phone: phone.value,
    socials: input.socials === undefined ? current.socials : (JSON.parse(socials.value) as Socials),
    status: input.status ?? current.status,
    notes: input.notes === undefined ? current.notes : trim(input.notes, MAX_NOTES),
    updated_at: now.toISOString(),
  };

  db().run(
    `UPDATE companies
        SET name = ?, slug = ?, email = ?, website = ?, phone = ?, socials = ?,
            status = ?, notes = ?, updated_at = ?
      WHERE id = ?`,
    [
      next.name,
      next.slug,
      next.email,
      next.website,
      next.phone,
      socials.value,
      next.status,
      next.notes,
      next.updated_at,
      id,
    ],
  );

  return { ok: true, value: next };
}

/** La ruta del archivo la fija el servidor después de guardarlo, nunca el cliente. */
export function setMedia(
  id: string,
  kind: "logo" | "banner",
  value: string,
  now: Date = new Date(),
): Result<Company> {
  const current = byId(id);
  if (!current) return { ok: false, error: "esa empresa no existe" };

  const column = kind === "logo" ? "logo" : "banner";
  db().run(`UPDATE companies SET ${column} = ?, updated_at = ? WHERE id = ?`, [
    value.slice(0, MAX_URL),
    now.toISOString(),
    id,
  ]);
  return { ok: true, value: byId(id) ?? current };
}

export function remove(id: string): boolean {
  return db().run("DELETE FROM companies WHERE id = ?", [id]).changes > 0;
}
