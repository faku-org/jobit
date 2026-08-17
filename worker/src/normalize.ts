import { createHash } from "node:crypto";
import { categoryLabel } from "./categories.ts";
import type { Job, JobDetail, JobStub, Level } from "./types.ts";

const SENIOR_HINTS = /\b(senior|sr\.?|lead|jefe|gerente|encargad[oa]|responsable|arquitect[oa])\b/i;
const MID_HINTS = /\b(semi\s?senior|ssr\.?|semi-?sr|analista|oficial)\b/i;
const ENTRY_HINTS =
  /\b(junior|jr\.?|trainee|pasant[ei]a?|practicante|aprendiz|ayudante|auxiliar|primer empleo|sin experiencia)\b/i;

function inferLevel(title: string, experienceYears: number | null): Level | null {
  if (experienceYears !== null) {
    if (experienceYears <= 1) return "entry";
    if (experienceYears <= 4) return "mid";
    return "senior";
  }
  if (ENTRY_HINTS.test(title)) return "entry";
  if (SENIOR_HINTS.test(title)) return "senior";
  if (MID_HINTS.test(title)) return "mid";
  return null;
}

/** Offers explicitly open to people with no prior experience. */
function noExperience(stub: JobStub, detail: JobDetail | null, description: string): boolean {
  if (stub.no_experience) return true;
  if (detail?.no_experience) return true;
  if (detail?.experience_years_min === 0) return true;
  return /\b(sin experiencia|no requiere experiencia|primer empleo|se entrena|te capacitamos)\b/i.test(
    `${stub.title} ${description}`,
  );
}

/**
 * Sources publish escaped markdown; the UI renders plain text, so the markers
 * are stripped here rather than baked into the cache.
 */
export function plainText(value: string): string {
  return value
    .replace(/\\([\\`*_{}[\]()#+\-.!])/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\s)[*_](\S[^*_]*?)[*_](?=\s|$)/g, "$1$2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function jobId(source: string, sourceId: string): string {
  return createHash("sha256").update(`${source}:${sourceId}`).digest("hex").slice(0, 12);
}

export function toJob(stub: JobStub, detail: JobDetail | null): Job {
  const description = plainText(detail?.description ?? "");
  const experience = detail?.experience_years_min ?? null;

  return {
    id: jobId(stub.source, stub.source_id),
    source: stub.source,
    source_id: stub.source_id,
    title: stub.title,
    company: stub.company,
    department: stub.department,
    city: stub.city,
    category: stub.category_raw,
    category_label: categoryLabel(stub.category_raw),
    category_raw: stub.category_raw,
    date_posted: stub.date_posted,
    level: inferLevel(stub.title, experience),
    remote: stub.remote,
    job_type: detail?.job_type ?? stub.job_type,
    salary: detail?.salary ?? null,
    experience_years_min: experience,
    no_experience: noExperience(stub, detail, description),
    education_level: detail?.education_level ?? null,
    vacancies: detail?.vacancies ?? null,
    description,
    requirements: detail?.requirements ? plainText(detail.requirements) : null,
    apply_url: stub.apply_url,
    duplicates: [],
  };
}
