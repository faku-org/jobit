import { CATEGORIES } from "@jobit/worker/categories";
import { employerSlug } from "./employers.ts";
import type { Filters, JobType, Level, WorkMode } from "./types.ts";

/**
 * Los atajos del buscador: `@empresa` y `clave:valor`. Es para quien los
 * conoce; quien no, usa los filtros de siempre y el texto libre sigue igual.
 *
 * El parseo es puro: toma el texto crudo y devuelve el texto sin atajos, los
 * filtros que imponen y los atajos reconocidos (para mostrarlos como chips).
 * La URL guarda el texto crudo, así el enlace compartido reproduce la búsqueda.
 */
export interface SearchToken {
  /** El texto tal cual se escribió, para poder quitarlo. */
  raw: string;
  /** Etiqueta legible, por ejemplo "empresa: Urudata". */
  label: string;
}

export interface SearchParse {
  text: string;
  /** Pisan al filtro manual de esa dimensión. */
  filters: Partial<Filters>;
  tokens: SearchToken[];
}

const LEVELS: Record<string, Level> = {
  junior: "entry",
  entry: "entry",
  semi: "mid",
  "semi-senior": "mid",
  mid: "mid",
  senior: "senior",
};

const MODES: Record<string, WorkMode> = {
  presencial: "onsite",
  onsite: "onsite",
  oficina: "onsite",
  remoto: "remote",
  remote: "remote",
  hibrido: "hybrid",
  hybrid: "hybrid",
};

const JOB_TYPES: Record<string, JobType> = {
  completa: "full_time",
  completo: "full_time",
  full_time: "full_time",
  medio: "part_time",
  "medio-horario": "part_time",
  part_time: "part_time",
  pasantia: "internship",
  internship: "internship",
};

const KEYS = new Set([
  "puesto",
  "ubicacion",
  "rubro",
  "nivel",
  "modalidad",
  "jornada",
  "sueldo",
  "dias",
]);

const fold = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const rubro = (value: string): string => {
  const needle = fold(value);
  return (
    CATEGORIES.find((category) => category.slug === needle || fold(category.label) === needle)
      ?.slug ?? needle
  );
};

/** Aplica un atajo; devuelve si lo reconoció. */
function apply(key: string, value: string, filters: Partial<Filters>): boolean {
  switch (key) {
    case "puesto":
      filters.title = value;
      return true;
    case "ubicacion":
      filters.place = value;
      return true;
    case "rubro":
      filters.category = rubro(value);
      return true;
    case "nivel": {
      const level = LEVELS[fold(value)];
      if (!level) return false;
      filters.level = level;
      return true;
    }
    case "modalidad": {
      const mode = MODES[fold(value)];
      if (!mode) return false;
      filters.mode = mode;
      return true;
    }
    case "jornada": {
      const type = JOB_TYPES[fold(value)];
      if (!type) return false;
      filters.jobType = type;
      return true;
    }
    case "sueldo": {
      const amount = Number(value.replace(/[^\d]/g, ""));
      if (!Number.isFinite(amount) || amount <= 0) return false;
      filters.salaryMin = amount;
      return true;
    }
    case "dias": {
      const days = Number(value);
      if (!Number.isInteger(days) || days <= 0) return false;
      filters.days = days;
      return true;
    }
    default:
      return false;
  }
}

const tokenLabel = (key: string, value: string): string => {
  switch (key) {
    case "puesto":
      return `puesto: ${value}`;
    case "ubicacion":
      return `ubicación: ${value}`;
    case "rubro":
      return `rubro: ${CATEGORIES.find((category) => category.slug === rubro(value))?.label ?? value}`;
    case "nivel":
      return `nivel: ${value}`;
    case "modalidad":
      return `modalidad: ${value}`;
    case "jornada":
      return `jornada: ${value}`;
    case "sueldo":
      return `sueldo: ${value}`;
    case "dias":
      return `días: ${value}`;
    default:
      return `${key}: ${value}`;
  }
};

export function parseSearch(raw: string): SearchParse {
  const filters: Partial<Filters> = {};
  const tokens: SearchToken[] = [];
  const words: string[] = [];
  const companies: string[] = [];

  for (const word of raw.split(/\s+/)) {
    if (word === "") continue;

    if (word.length > 1 && word.startsWith("@")) {
      const name = word.slice(1);
      companies.push(employerSlug(name));
      tokens.push({ raw: word, label: `empresa: ${name}` });
      continue;
    }

    if (fold(word) === "sin-experiencia") {
      filters.noExperience = true;
      tokens.push({ raw: word, label: "sin experiencia" });
      continue;
    }

    const colon = word.indexOf(":");
    const key = colon > 0 ? fold(word.slice(0, colon)) : "";
    if (KEYS.has(key) && apply(key, word.slice(colon + 1), filters)) {
      tokens.push({ raw: word, label: tokenLabel(key, word.slice(colon + 1)) });
      continue;
    }

    words.push(word);
  }

  if (companies.length > 0) filters.company = companies.join(",");
  return { text: words.join(" "), filters, tokens };
}

/** Saca un atajo del texto, para el botón de la chip. */
export const withoutToken = (query: string, raw: string): string =>
  query
    .split(/\s+/)
    .filter((word) => word !== raw)
    .join(" ")
    .trim();

/** La tabla que muestra la ayuda y el desplegable al escribir `@`. */
export const SHORTCUTS: { syntax: string; what: string }[] = [
  { syntax: "@empresa", what: "Las ofertas de esa empresa." },
  { syntax: "puesto:texto", what: "Solo el título del puesto." },
  { syntax: "ubicacion:texto", what: "Ciudad o departamento." },
  { syntax: "rubro:texto", what: "El rubro." },
  { syntax: "nivel:junior", what: "Junior, semi o senior." },
  { syntax: "modalidad:remoto", what: "Presencial, remoto o híbrido." },
  { syntax: "jornada:completa", what: "Completa, medio horario o pasantía." },
  { syntax: "sueldo:30000", what: "Desde ese sueldo." },
  { syntax: "sin-experiencia", what: "Que no pidan experiencia." },
  { syntax: "dias:7", what: "Publicadas en los últimos N días." },
];
