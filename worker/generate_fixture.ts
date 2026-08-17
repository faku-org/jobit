/**
 * Generates worker/output/jobs.json with synthetic Uruguayan job offers that
 * match the real scraper's schema. Deterministic: same output on every run.
 * Replace the output file with real scraper output when it is available.
 */
import { createHash } from "node:crypto";

type Level = "entry" | "mid" | "senior" | null;
type Remote = "remote" | "hybrid" | null;

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  date_posted: string;
  level: Level;
  remote: Remote;
  apply_url: string;
}

const ROLES = [
  "Desarrollador Full Stack",
  "Desarrollador Frontend",
  "Desarrollador Backend",
  "Desarrollador React",
  "Desarrollador Node.js",
  "Desarrollador .NET",
  "Desarrollador Java",
  "Desarrollador Python",
  "Ingeniero de Datos",
  "Analista de Datos",
  "Analista QA",
  "Automatizador QA",
  "Ingeniero DevOps",
  "Administrador de Infraestructura",
  "Analista de Soporte IT",
  "Analista Funcional",
  "Product Owner",
  "Scrum Master",
  "Diseñador UX/UI",
  "Especialista en Ciberseguridad",
  "Administrador de Base de Datos",
  "Ingeniero de Machine Learning",
  "Desarrollador Mobile",
  "Technical Lead",
  "Arquitecto de Software",
];

const SENIORITIES: readonly { suffix: string; level: Level }[] = [
  { suffix: "Trainee", level: "entry" },
  { suffix: "Junior", level: "entry" },
  { suffix: "Semi Senior", level: "mid" },
  { suffix: "Ssr", level: "mid" },
  { suffix: "Senior", level: "senior" },
  { suffix: "Sr", level: "senior" },
  { suffix: "", level: null },
];

const COMPANIES = [
  "Globant",
  "Mercado Libre",
  "dLocal",
  "PedidosYa",
  "Infocorp",
  "Genexus Consulting",
  "Tata Consultancy Services",
  "Sabre",
  "Nearsure",
  "Overactive",
  "Handy",
  "Prometeo Open Banking",
  "Bantotal",
  "Quantik",
  "Ceibal",
  "Antel",
  "Banco Itaú Uruguay",
  "Scanntech",
  "Sofis Solutions",
  "Tryolabs",
  "Kimberlite Software",
  "Datalogic Uruguay",
  "Endava",
  "Uruguay IT Group",
  "Netlabs",
];

const LOCATIONS: readonly { label: string; remote: Remote }[] = [
  { label: "Montevideo, Uruguay", remote: null },
  { label: "Montevideo, Uruguay", remote: null },
  { label: "Ciudad de la Costa, Canelones, Uruguay", remote: null },
  { label: "Punta del Este, Maldonado, Uruguay", remote: null },
  { label: "Colonia del Sacramento, Colonia, Uruguay", remote: null },
  { label: "Salto, Uruguay", remote: null },
  { label: "Uruguay", remote: "remote" },
  { label: "Montevideo, Uruguay", remote: "hybrid" },
];

const COUNT = 157;
const SCRAPED_AT = new Date("2026-08-17T09:12:44Z");

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260817);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}

function hashId(seed: string): string {
  return createHash("sha256").update(seed).digest("hex").slice(0, 12);
}

function buildJob(index: number): Job {
  const role = pick(ROLES);
  const seniority = pick(SENIORITIES);
  const company = pick(COMPANIES);
  const location = pick(LOCATIONS);
  const isRemoteTitle = location.remote === "remote" && rand() < 0.6;

  const title = [role, seniority.suffix, isRemoteTitle ? "(Remoto)" : ""].filter(Boolean).join(" ");

  const daysAgo = Math.floor(rand() * 45);
  const posted = new Date(SCRAPED_AT);
  posted.setUTCDate(posted.getUTCDate() - daysAgo);
  posted.setUTCHours(0, 0, 0, 0);

  const id = hashId(`${title}|${company}|${location.label}|${index}`);

  return {
    id,
    title,
    company,
    location: location.label,
    date_posted: posted.toISOString().slice(0, 19),
    level: seniority.level,
    remote: location.remote,
    apply_url: `https://uy.linkedin.com/jobs/view/${id}${index}`,
  };
}

const jobs: Job[] = Array.from({ length: COUNT }, (_, i) => buildJob(i));
jobs.sort((a, b) => b.date_posted.localeCompare(a.date_posted));

const payload = {
  scraped_at: SCRAPED_AT.toISOString(),
  source: "fixture_uy",
  count: jobs.length,
  jobs,
};

const out = new URL("./output/jobs.json", import.meta.url).pathname;
await Bun.write(out, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${jobs.length} jobs to ${out}`);
