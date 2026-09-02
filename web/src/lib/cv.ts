import { COURSES, DEGREES, catalogPattern, fold } from "./catalog.ts";
import { EDUCATION_RANK, type EducationLevel, levelFromDegrees } from "./profile.ts";

/**
 * What a CV said, in the app's own vocabulary. Nothing here is a guess about
 * the person: every entry is a catalog id, which is what makes it usable for
 * ordering offers. Free text that matched nothing is dropped rather than
 * stored, and the whole read happens in this browser.
 */
export interface CvReading {
  degrees: string[];
  courses: string[];
  education: EducationLevel | "";
  experienceYears: number | null;
  /** Rubros the CV points at, offered as a starting preference. */
  categories: string[];
  /** How much text was read, so an empty result can be explained. */
  characters: number;
}

export const EMPTY_READING: CvReading = {
  degrees: [],
  courses: [],
  education: "",
  experienceYears: null,
  categories: [],
  characters: 0,
};

export const isEmptyReading = (reading: CvReading): boolean =>
  reading.degrees.length === 0 &&
  reading.courses.length === 0 &&
  reading.education === "" &&
  reading.experienceYears === null &&
  reading.categories.length === 0;

/** Education levels named outright, for a CV that lists no specific título. */
const EDUCATION_PHRASES: [RegExp, EducationLevel][] = [
  [/posgrado|maestria|master\b|doctorado|\bphd\b|mba\b/, "postgrad"],
  [/universitari|licenciatur|licenciad|ingenier|arquitect|contador publico|abogac/, "university"],
  [/terciari|tecnicatur|\butu\b|tecnico superior|instituto tecnologico/, "technical"],
  [/bachillerato|secundaria completa|liceo completo|educacion media/, "secondary"],
  [/ciclo basico/, "secondary_basic"],
  [/primaria completa|escuela primaria/, "primary"],
];

/** The rubros a CV points at, from the words it uses for the work itself. */
const CATEGORY_HINTS: [RegExp, string][] = [
  [
    /desarroll(?:o|ador) de software|programaci|javascript|typescript|python\b|\bjava\b|\breact\b|backend|frontend|devops|\bqa\b|base de datos|\bsql\b|soporte tecnico|help ?desk|redes y|ciberseguridad/,
    "tecnologia",
  ],
  [
    /analisis de datos|power ?bi|data science|ciencia de datos|estadistic|investigacion de mercado/,
    "datos-analisis",
  ],
  [
    /contabilidad|contador|auditori|liquidacion de sueldos|conciliaci|balance|impuestos|finanzas/,
    "contabilidad-finanzas",
  ],
  [
    /marketing|publicidad|community manager|redes sociales|\bseo\b|comunicacion institucional/,
    "marketing",
  ],
  [
    /recursos humanos|\brrhh\b|seleccion de personal|reclutamiento|capacitacion de personal/,
    "rrhh",
  ],
  [
    /diseno grafico|diseno ux|ilustracion|photoshop|illustrator|figma|audiovisual|fotografia/,
    "diseno",
  ],
  [
    /ventas|vendedor|comercial|atencion al cliente|cajer|telemarketing|call ?center|mostrador/,
    "ventas",
  ],
  [
    /recepcion|secretari|administrativ|back ?office|asistente de gerencia|archivo/,
    "administracion",
  ],
  [
    /logistic|deposito|almacen|distribucion|reparto|chofer|autoelevador|inventario|picking/,
    "logistica",
  ],
  [
    /produccion|planta industrial|manufactura|operario|linea de produccion|control de calidad|envasado/,
    "produccion",
  ],
  [
    /electricista|sanitaria|plomer|soldadura|carpinter|albanil|construccion|obra|refrigeracion|mecanic/,
    "oficios",
  ],
  [
    /enfermer|medic|farmac|odontolog|nutricion|fisioterap|laboratorio clinico|paciente|cuidado de adultos/,
    "salud",
  ],
  [/docente|profesor|maestr|educacion inicial|dictado de clases|tallerista/, "educacion"],
  [
    /ingenieria (?:civil|industrial|electrica|mecanica|quimica)|calculo estructural|proyecto de obra/,
    "ingenieria",
  ],
  [/atencion al publico|servicio al cliente|mesa de ayuda|postventa/, "atencion-cliente"],
];

/** "5 años de experiencia", however the sentence is arranged around it. */
const STATED_YEARS = /(\d{1,2})\s*(?:\+\s*)?an?os?\s+(?:de\s+)?experiencia/;

/**
 * "2019 - 2023", "2019 a la fecha", "03/2020 – actualidad". Only the years are
 * read: a CV writes months in a dozen ways and the extra precision changes
 * nothing about which offers should come first.
 */
const DATE_RANGE =
  /(?:\d{1,2}[/.-])?((?:19|20)\d{2})\s*(?:-|–|—|\/|a la fecha|al?|hasta|to)\s*(?:\d{1,2}[/.-])?((?:19|20)\d{2}|actualidad|presente|hoy|actual|current|present)/g;

const MAX_YEARS = 50;

/** Overlapping jobs are one stretch of working life, not two. */
function mergedSpan(ranges: [number, number][]): number {
  if (ranges.length === 0) return 0;
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [start, end] = sorted[0] as [number, number];

  for (const [from, to] of sorted.slice(1)) {
    if (from <= end) end = Math.max(end, to);
    else {
      total += end - start;
      [start, end] = [from, to];
    }
  }
  return total + (end - start);
}

/**
 * Years of work, from what the CV says outright or from the periods it lists.
 * An explicit statement wins: it is the person's own summary of their history.
 */
export function readExperience(folded: string, thisYear = new Date().getFullYear()): number | null {
  const stated = STATED_YEARS.exec(folded);
  if (stated?.[1]) return Math.min(Number(stated[1]), MAX_YEARS);

  const ranges: [number, number][] = [];
  for (const match of folded.matchAll(DATE_RANGE)) {
    const from = Number(match[1]);
    const rawTo = match[2] ?? "";
    const to = /^\d{4}$/.test(rawTo) ? Number(rawTo) : thisYear;
    if (from < 1960 || from > thisYear || to < from || to > thisYear) continue;
    ranges.push([from, to]);
  }

  if (ranges.length === 0) return null;
  return Math.min(mergedSpan(ranges), MAX_YEARS);
}

const matches = (pattern: RegExp, text: string): boolean =>
  new RegExp(pattern.source, pattern.flags.replace("g", "")).test(text);

/** The level the CV names, for when it lists no título the catalog knows. */
function statedEducation(folded: string): EducationLevel | "" {
  const found = EDUCATION_PHRASES.find(([pattern]) => pattern.test(folded));
  return found ? found[1] : "";
}

/**
 * Reads a CV, or a LinkedIn profile saved as PDF, against the same closed
 * lists the profile panel offers. Anything it cannot name in that vocabulary
 * is ignored: a preference the app cannot act on is worse than no preference.
 */
export function readCv(text: string, thisYear = new Date().getFullYear()): CvReading {
  const folded = fold(text);
  if (folded.trim() === "") return EMPTY_READING;

  const degrees = DEGREES.filter((entry) => matches(catalogPattern(entry), folded)).map(
    (entry) => entry.id,
  );
  const courses = COURSES.filter((entry) => matches(catalogPattern(entry), folded)).map(
    (entry) => entry.id,
  );

  /** The títulos found imply a level; a bare mention fills in when they do not. */
  const implied = levelFromDegrees(degrees);
  const stated = statedEducation(folded);
  const education =
    implied === "" || (stated !== "" && EDUCATION_RANK[stated] > EDUCATION_RANK[implied])
      ? stated
      : implied;

  const categories = CATEGORY_HINTS.flatMap(([pattern, slug]) =>
    pattern.test(folded) ? [slug] : [],
  );

  return {
    degrees,
    courses,
    education,
    experienceYears: readExperience(folded, thisYear),
    categories: [...new Set(categories)],
    characters: text.trim().length,
  };
}
