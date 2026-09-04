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
  /** Departamentos (and the city label, when the CV named one). */
  places: CvPlace[];
  /** How much text was read, so an empty result can be explained. */
  characters: number;
}

/** A place the CV named, in the same vocabulary the board uses for offers. */
export interface CvPlace {
  department: string;
  label: string;
}

export const EMPTY_READING: CvReading = {
  degrees: [],
  courses: [],
  education: "",
  experienceYears: null,
  categories: [],
  places: [],
  characters: 0,
};

export const isEmptyReading = (reading: CvReading): boolean =>
  reading.degrees.length === 0 &&
  reading.courses.length === 0 &&
  reading.education === "" &&
  reading.experienceYears === null &&
  reading.categories.length === 0 &&
  reading.places.length === 0;

/**
 * The parts of a CV. The same word means different things depending on where
 * it sits: "arquitectura" under formación is a título and under proyectos is
 * a way of building software, and a year range under formación is time studying
 * and not time working.
 */
export type CvBlock = "profile" | "education" | "experience" | "projects" | "skills";

/** Anything before the first heading: the name, the headline, the summary. */
const FIRST_BLOCK: CvBlock = "profile";

const HEADINGS: [RegExp, CvBlock][] = [
  [/^(?:perfil|resumen|sobre mi|acerca de|objetivo|presentacion)/, "profile"],
  [/^(?:formacion|educacion|estudios|escolaridad|academic)/, "education"],
  [
    /^(?:experiencia|trayectoria|historial laboral|antecedentes laborales|empleos|work experience)/,
    "experience",
  ],
  [/^(?:proyectos|portfolio|trabajos destacados)/, "projects"],
  [
    /^(?:habilidades|aptitudes|competencias|conocimientos|herramientas|tecnologias|stack|skills|idiomas|cursos|certificaci|capacitaci|otros estudios)/,
    "skills",
  ],
];

/** A heading is a line on its own. A sentence that happens to start with
 * "experiencia en atención al cliente" is not one. */
const MAX_HEADING = 60;

function headingOf(line: string): CvBlock | "" {
  /** Bullets, emoji and the rules some templates draw are not part of it. */
  const bare = line.replace(/[^a-z0-9\s]+/g, " ").trim();
  if (bare === "" || bare.length > MAX_HEADING) return "";
  const found = HEADINGS.find(([pattern]) => pattern.test(bare));
  return found ? found[1] : "";
}

/** Folded text in, folded blocks out. Every line belongs to the last heading
 * seen, which is how a CV reads to a person too. */
export function splitCv(folded: string): Record<CvBlock, string> {
  const lines: Record<CvBlock, string[]> = {
    profile: [],
    education: [],
    experience: [],
    projects: [],
    skills: [],
  };
  let current = FIRST_BLOCK;

  for (const line of folded.split(/\r?\n/)) {
    const heading = headingOf(line);
    if (heading === "") lines[current].push(line);
    else current = heading;
  }

  return {
    profile: lines.profile.join("\n"),
    education: lines.education.join("\n"),
    experience: lines.experience.join("\n"),
    projects: lines.projects.join("\n"),
    skills: lines.skills.join("\n"),
  };
}

/** Education levels named outright, for a CV that lists no specific título. */
const EDUCATION_PHRASES: [RegExp, EducationLevel][] = [
  [/posgrado|maestria|master\b|doctorado|\bphd\b|mba\b/, "postgrad"],
  [/universitari|licenciatur|licenciad|ingenier|arquitect|contador publico|abogac/, "university"],
  /** UTU is left out on purpose: it gives bachilleratos as well as tecnicaturas,
   * so the school alone says nothing about the level. */
  [/terciari|tecnicatur|tecnico superior|instituto tecnologico/, "technical"],
  [/bachillerato|secundaria completa|liceo completo|educacion media/, "secondary"],
  [/ciclo basico/, "secondary_basic"],
  [/primaria completa|escuela primaria/, "primary"],
];

/** The rubros a CV points at, from the words it uses for the work itself. */
const CATEGORY_HINTS: [RegExp, string][] = [
  [
    /desarroll\w*\s+(?:de\s+)?(?:software|web|movil|aplicaciones|sistemas)|full ?stack|programaci|javascript|typescript|python\b|\bjava\b|\breact\b|backend|frontend|devops|\bqa\b|base de datos|\bsql\b|soporte tecnico|help ?desk|redes y|ciberseguridad/,
    "tecnologia",
  ],
  [
    /analisis de datos|power ?bi|data science|ciencia de datos|\bestadistica\b|analisis estadistico|investigacion de mercado/,
    "datos-analisis",
  ],
  [
    /contabilidad|contador|auditoria (?:contable|interna|externa|financiera|de gestion)|liquidacion de sueldos|conciliaci|balance (?:general|contable)|impuestos|finanzas/,
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
    /logistic|deposito|\balmacen(?:es|ero|era)?\b|distribucion|reparto|chofer|autoelevador|inventario|picking/,
    "logistica",
  ],
  /** Not a bare "producción": a CV that puts an API "en producción" is talking
   * about deploying software, not about a planta. */
  [
    /planta industrial|manufactura|operari[oa]|linea de produccion|control de calidad|envasado|produccion industrial|produccion en planta/,
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

/** The 19 departments, written as a CV writes them. */
const DEPARTMENTS: { value: string; pattern: RegExp }[] = [
  { value: "Artigas", pattern: /\bartigas\b/ },
  { value: "Canelones", pattern: /\bcanelones\b/ },
  { value: "Cerro Largo", pattern: /\bcerro largo\b/ },
  { value: "Colonia", pattern: /\bcolonia(?: del sacramento)?\b/ },
  { value: "Durazno", pattern: /\bdurazno\b/ },
  { value: "Flores", pattern: /\bflores\b/ },
  { value: "Florida", pattern: /\bflorida\b/ },
  { value: "Lavalleja", pattern: /\blavalleja\b/ },
  { value: "Maldonado", pattern: /\bmaldonado\b/ },
  { value: "Montevideo", pattern: /\bmontevideo\b|\bmvd\b/ },
  { value: "Paysandú", pattern: /\bpaysandu\b/ },
  { value: "Río Negro", pattern: /\brio negro\b/ },
  { value: "Rivera", pattern: /\brivera\b/ },
  { value: "Rocha", pattern: /\brocha\b/ },
  { value: "Salto", pattern: /\bsalto\b/ },
  { value: "San José", pattern: /\bsan jose\b/ },
  { value: "Soriano", pattern: /\bsoriano\b/ },
  { value: "Tacuarembó", pattern: /\btacuarembo\b/ },
  { value: "Treinta y Tres", pattern: /\btreinta y tres\b/ },
];

/** Cities that name a department the board actually filters by. */
const CITIES: { pattern: RegExp; department: string; label: string }[] = [
  { pattern: /ciudad de la costa/, department: "Canelones", label: "Ciudad de la Costa" },
  { pattern: /\bel pinar\b/, department: "Canelones", label: "El Pinar" },
  { pattern: /\bsolymar\b/, department: "Canelones", label: "Solymar" },
  { pattern: /\bshangrila\b|\bshangri-?la\b/, department: "Canelones", label: "Shangrilá" },
  { pattern: /\blasc?\s*piedras\b/, department: "Canelones", label: "Las Piedras" },
  { pattern: /\bpando\b/, department: "Canelones", label: "Pando" },
  { pattern: /\batlantida\b/, department: "Canelones", label: "Atlántida" },
  { pattern: /\bsalinas\b/, department: "Canelones", label: "Salinas" },
  { pattern: /\bbarros blancos\b/, department: "Canelones", label: "Barros Blancos" },
  { pattern: /\bla paz\b/, department: "Canelones", label: "La Paz" },
  { pattern: /\bpaso carrasco\b/, department: "Canelones", label: "Paso Carrasco" },
  { pattern: /\bpunta del este\b/, department: "Maldonado", label: "Punta del Este" },
  { pattern: /\bpiriapolis\b/, department: "Maldonado", label: "Piriápolis" },
  { pattern: /\bciudad del plata\b/, department: "San José", label: "Ciudad del Plata" },
  { pattern: /\bcarmelo\b/, department: "Colonia", label: "Carmelo" },
  { pattern: /\bfray bentos\b/, department: "Río Negro", label: "Fray Bentos" },
  { pattern: /\bmelo\b/, department: "Cerro Largo", label: "Melo" },
  { pattern: /\bminas\b/, department: "Lavalleja", label: "Minas" },
  { pattern: /\bchuy\b/, department: "Rocha", label: "Chuy" },
  { pattern: /\bla paloma\b/, department: "Rocha", label: "La Paloma" },
];

function readPlaces(folded: string): CvPlace[] {
  const byDept = new Map<string, string>();

  for (const city of CITIES) {
    if (city.pattern.test(folded)) byDept.set(city.department, city.label);
  }
  for (const dep of DEPARTMENTS) {
    if (!dep.pattern.test(folded) || byDept.has(dep.value)) continue;
    byDept.set(dep.value, dep.value);
  }

  return [...byDept.entries()].map(([department, label]) => ({
    department,
    label: label === department ? department : `${label} (${department})`,
  }));
}

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

const GENERIC_BACHILLERATO = "bach-generico";

/** That entry reads "otra orientación": next to the orientation it names, it is
 * not another título, it is the same one listed twice. */
function withoutGenericBachillerato(degrees: string[]): string[] {
  const named = degrees.some((id) => id.startsWith("bach-") && id !== GENERIC_BACHILLERATO);
  return named ? degrees.filter((id) => id !== GENERIC_BACHILLERATO) : degrees;
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

  const blocks = splitCv(folded);
  /** A CV with no headings the reader recognises is read whole, which is what
   * this did for every CV before the blocks existed. */
  const scope = (...names: CvBlock[]): string => {
    const parts = names.map((name) => blocks[name]).filter((part) => part.trim() !== "");
    return parts.length === 0 ? folded : parts.join("\n");
  };

  /** Títulos and level come from where somebody lists what they studied. */
  const studied = scope("education", "profile");
  /** Cursos too, plus the skills and languages block. What a job or a project
   * happened to involve is not a course somebody took. */
  const learned = scope("education", "skills", "profile");
  /** Years worked, never years enrolled: the dates under formación are the
   * length of a degree. */
  const worked = scope("experience", "profile");
  /** The rubro comes from the work itself. Somebody with no jobs yet says what
   * they do through their projects instead. */
  const doing =
    blocks.experience.trim() === "" ? scope("projects", "profile") : scope("experience", "profile");
  /** Location lives in the header. If there is no profile block, the whole
   * text is searched, which is how a one-line CV still names a city. */
  const where = blocks.profile.trim() === "" ? folded : blocks.profile;

  const degrees = withoutGenericBachillerato(
    DEGREES.filter((entry) => matches(catalogPattern(entry), studied)).map((entry) => entry.id),
  );
  const courses = COURSES.filter((entry) => matches(catalogPattern(entry), learned)).map(
    (entry) => entry.id,
  );

  /** The títulos found imply a level; a bare mention fills in when they do not. */
  const implied = levelFromDegrees(degrees);
  const stated = statedEducation(studied);
  const education =
    implied === "" || (stated !== "" && EDUCATION_RANK[stated] > EDUCATION_RANK[implied])
      ? stated
      : implied;

  const categories = CATEGORY_HINTS.flatMap(([pattern, slug]) =>
    pattern.test(doing) ? [slug] : [],
  );

  return {
    degrees,
    courses,
    education,
    experienceYears: readExperience(worked, thisYear),
    categories: [...new Set(categories)],
    places: readPlaces(where),
    characters: text.trim().length,
  };
}
