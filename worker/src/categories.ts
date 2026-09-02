export interface Category {
  slug: string;
  label: string;
}

/**
 * The rubros the UI filters by. Sources publish finer-grained taxonomies
 * (BuscoJobs has 34 subcanales); each one is folded into a rubro here and the
 * original label is kept on the job as category_raw.
 */
export const CATEGORIES: Category[] = [
  { slug: "ventas", label: "Ventas y comercial" },
  { slug: "atencion-cliente", label: "Atención al cliente" },
  { slug: "administracion", label: "Administración y gestión" },
  { slug: "oficios", label: "Oficios y construcción" },
  { slug: "produccion", label: "Producción e industria" },
  { slug: "logistica", label: "Logística y distribución" },
  { slug: "contabilidad-finanzas", label: "Contabilidad y finanzas" },
  { slug: "tecnologia", label: "Tecnología" },
  { slug: "datos-analisis", label: "Análisis e investigación" },
  { slug: "salud", label: "Salud" },
  { slug: "ingenieria", label: "Ingeniería" },
  { slug: "marketing", label: "Marketing y publicidad" },
  { slug: "rrhh", label: "Recursos humanos" },
  { slug: "educacion", label: "Educación" },
  { slug: "diseno", label: "Diseño y creatividad" },
  { slug: "otros", label: "Otros" },
];

const LABEL_BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c.label]));

export const categoryLabel = (slug: string): string => LABEL_BY_SLUG.get(slug) ?? "Otros";

/** BuscoJobs subcanal id to rubro slug. */
const BUSCOJOBS_SUBCANAL: Record<string, string> = {
  "1030": "ventas",
  "1006": "ventas",
  "1014": "ventas",
  "1003": "marketing",
  "1021": "marketing",
  "1026": "atencion-cliente",
  "1008": "atencion-cliente",
  "1002": "administracion",
  "1019": "administracion",
  "1025": "administracion",
  "1023": "administracion",
  "1018": "administracion",
  "1037": "oficios",
  "1036": "oficios",
  "1024": "produccion",
  "1020": "produccion",
  "1028": "produccion",
  "1010": "logistica",
  "1027": "logistica",
  "1033": "logistica",
  "1001": "contabilidad-finanzas",
  "1013": "contabilidad-finanzas",
  "1017": "tecnologia",
  "1004": "datos-analisis",
  "1031": "datos-analisis",
  "1029": "datos-analisis",
  "1015": "salud",
  "1012": "ingenieria",
  "1016": "rrhh",
  "1034": "rrhh",
  "1011": "educacion",
  "1009": "diseno",
  "1005": "diseno",
  "1022": "otros",
  "33": "otros",
};

export const buscojobsCategory = (subcanalId: string): string =>
  BUSCOJOBS_SUBCANAL[subcanalId] ?? "otros";

/**
 * Uruguay Concursa publishes a task family (TipTarDsc) that is too coarse on
 * its own: "Profesionales" covers doctors, lawyers and engineers alike. The
 * title decides first and the family is the fallback.
 */
const UC_TITLE_RULES: [RegExp, string][] = [
  [/docent|profesor|maestr|educador|ayudante de clase|adscript/i, "educacion"],
  [/m[eé]dic|enfermer|odont|psic[oó]log|nutricion|farmac|fisioterap|partera|salud/i, "salud"],
  [/ingenier|arquitect|agr[oó]nom/i, "ingenieria"],
  [/contad|contab|financier|finanzas|tesorer|econom|auditor/i, "contabilidad-finanzas"],
  [
    /inform[aá]tic|sistemas|programador|desarrollador|soporte t[eé]cnico|redes|ciberseg|datos/i,
    "tecnologia",
  ],
  [/analista|investigac|estad[ií]stic/i, "datos-analisis"],
  [/comunicaci|prensa|marketing|publicid/i, "marketing"],
  [/dise[ñn]|audiovisual|fot[oó]graf/i, "diseno"],
  [/recursos humanos|rrhh|gesti[oó]n humana/i, "rrhh"],
  [/chofer|conductor|log[ií]stic|dep[oó]sito|almacen/i, "logistica"],
  [/albañil|electricist|sanitari|carpinter|pintor|herrer|mec[aá]nic|obra|oficial de/i, "oficios"],
  [/administrativ|secretari|recepcion|gestor/i, "administracion"],
  [/atenci[oó]n al p[uú]blico|cajer/i, "atencion-cliente"],
];

const UC_TASK_FAMILY: Record<string, string> = {
  Docentes: "educacion",
  Administrativas: "administracion",
  "Administrativas con supervisión": "administracion",
  Dirección: "administracion",
  "Operativas de oficio": "oficios",
  "Operativa oficio con supervisión": "oficios",
  "Operativas de servicio": "otros",
  "Operativa servicio con supervisión": "otros",
  "Asistente/Auxiliar": "administracion",
};

export function uruguayconcursaCategory(taskFamily: string, title: string): string {
  const rule = UC_TITLE_RULES.find(([pattern]) => pattern.test(title));
  if (rule) return rule[1];
  return UC_TASK_FAMILY[taskFamily] ?? "otros";
}
