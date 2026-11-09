import { contentId, type ContentItem, type ContentLevel } from "./types.ts";

/**
 * Los recursos por rubro (issue 5): plataformas de práctica, documentación,
 * cursos, videos y podcasts. Contenido curado y versionado; con el seed ya se
 * ve completo, sin ejecutar una sola petición.
 *
 * Reglas de este archivo:
 *
 * - **Solo URLs que existen.** Cada una se pidió el 2026-11-05 y respondió; las
 *   que no responden a un bot (LeetCode, Khan Academy) están marcadas en
 *   `docs/recursos.md`. `bun run --cwd worker content:verify` las vuelve a
 *   pedir. Nada de enlaces de memoria.
 * - **`sponsored` es obligatorio y explícito** en cada recurso. No hay valor
 *   por defecto: quien agrega uno tiene que decidir. Hoy ninguno es pago; el
 *   día que una plataforma pague por aparecer, se pone `true` y el enlace sale
 *   con `rel="sponsored"` en la web y en `/recursos/<rubro>`, rotulado.
 * - **El pago no cambia el orden.** Se ordena por tipo y título, nunca por
 *   `sponsored`.
 */

/** Los subtipos de un recurso, en el orden en que se muestran. */
export const RESOURCE_TYPES = [
  { id: "plataforma", label: "Plataformas de práctica" },
  { id: "documentacion", label: "Documentación y guías" },
  { id: "curso", label: "Cursos" },
  { id: "video", label: "Videos" },
  { id: "podcast", label: "Podcasts" },
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number]["id"];

export const RESOURCE_TYPE_LABEL: Record<ResourceType, string> = {
  plataforma: "Plataforma de práctica",
  documentacion: "Documentación",
  curso: "Curso",
  video: "Video",
  podcast: "Podcast",
};

const isResourceType = (value: string): value is ResourceType =>
  RESOURCE_TYPES.some((type) => type.id === value);

/** El subtipo vive en `tags` (el primero que coincide), como pide el modelo. */
export function resourceType(item: Pick<ContentItem, "tags">): ResourceType | null {
  return (item.tags.find(isResourceType) as ResourceType | undefined) ?? null;
}

/**
 * El `rel` de un enlace saliente a un recurso. Un enlace que puede ser pago
 * lleva `sponsored` desde el primer día: retrofitearlo sobre un directorio ya
 * monetizado es lo caro, y Google lo exige. `noopener` siempre.
 */
export const externalRel = (sponsored: boolean): string =>
  sponsored ? "sponsored noopener noreferrer" : "noopener noreferrer";

interface ResourceInput {
  type: ResourceType;
  /** Idioma principal del recurso: lo que la persona va a leer o escuchar. */
  lang: "es" | "en";
  /** Slug de la fuente (la plataforma que lo publica). */
  source: string;
  source_label: string;
  title: string;
  body: string;
  url: string;
  categories: string[];
  /** Obligatorio y sin default: hay que decidirlo en cada recurso. */
  sponsored: boolean;
  level?: ContentLevel;
}

/** Fecha en que se verificó que las URLs responden. */
export const RESOURCES_VERIFIED_AT = "2026-11-05";

function resource(input: ResourceInput): ContentItem {
  return {
    id: contentId(input.source, input.url, input.title),
    kind: "resource",
    title: input.title,
    body: input.body,
    url: input.url,
    source: input.source,
    source_label: input.source_label,
    license: null,
    sponsored: input.sponsored,
    categories: input.categories,
    roles: [],
    level: input.level ?? null,
    tags: [input.type, input.lang],
    fetched_at: RESOURCES_VERIFIED_AT,
  };
}

const TECH = ["tecnologia"];
const DATA = ["datos-analisis"];
const TRADES = [
  "oficios",
  "produccion",
  "logistica",
  "administracion",
  "ventas",
  "atencion-cliente",
];

export const RESOURCE_ITEMS: ContentItem[] = [
  /* ---------- Tecnología ---------- */
  resource({
    type: "plataforma",
    lang: "en",
    source: "leetcode",
    source_label: "LeetCode",
    title: "LeetCode",
    body:
      "Problemas de algoritmos y estructuras de datos ordenados por dificultad. Es lo que más " +
      "aparece en las entrevistas técnicas de las empresas grandes.",
    url: "https://leetcode.com/problemset/",
    categories: TECH,
    sponsored: false,
  }),
  resource({
    type: "plataforma",
    lang: "en",
    source: "hackerrank",
    source_label: "HackerRank",
    title: "HackerRank",
    body:
      "Desafíos de programación por lenguaje y certificaciones de habilidades. Varias empresas " +
      "lo usan para filtrar candidatos, así que conviene conocer el formato.",
    url: "https://www.hackerrank.com/",
    categories: TECH,
    sponsored: false,
  }),
  resource({
    type: "plataforma",
    lang: "en",
    source: "codewars",
    source_label: "Codewars",
    title: "Codewars",
    body: "Katas cortos para practicar un lenguaje un rato por día y ver cómo lo resuelve el resto.",
    url: "https://www.codewars.com/",
    categories: TECH,
    sponsored: false,
  }),
  resource({
    type: "plataforma",
    lang: "en",
    source: "exercism",
    source_label: "Exercism",
    title: "Exercism",
    body:
      "Ejercicios en decenas de lenguajes, gratis y con la opción de recibir comentarios de " +
      "mentores voluntarios sobre tu código.",
    url: "https://exercism.org/tracks",
    categories: TECH,
    sponsored: false,
  }),
  resource({
    type: "documentacion",
    lang: "es",
    source: "mdn",
    source_label: "MDN Web Docs",
    title: "MDN: aprende desarrollo web",
    body:
      "La referencia de HTML, CSS y JavaScript, con una ruta de aprendizaje en español. Es la " +
      "primera parada cuando algo de la web no funciona como esperabas.",
    url: "https://developer.mozilla.org/es/docs/Learn_web_development",
    categories: TECH,
    sponsored: false,
  }),
  resource({
    type: "documentacion",
    lang: "en",
    source: "w3schools",
    source_label: "W3Schools",
    title: "W3Schools",
    body:
      "Tutoriales cortos de HTML, CSS, JavaScript, SQL y Python, con ejemplos que se editan y " +
      "se prueban en el mismo navegador.",
    url: "https://www.w3schools.com/",
    categories: [...TECH, ...DATA],
    sponsored: false,
  }),
  resource({
    type: "documentacion",
    lang: "en",
    source: "geeksforgeeks",
    source_label: "GeeksforGeeks",
    title: "GeeksforGeeks",
    body:
      "Explicaciones de algoritmos, estructuras de datos y preguntas de entrevista, con código " +
      "en varios lenguajes.",
    url: "https://www.geeksforgeeks.org/",
    categories: TECH,
    sponsored: false,
  }),
  resource({
    type: "documentacion",
    lang: "en",
    source: "roadmap-sh",
    source_label: "roadmap.sh",
    title: "roadmap.sh: mapas de ruta por rol",
    body:
      "Mapas con lo que hay que saber para cada rol (frontend, backend, DevOps, datos) y en " +
      "qué orden conviene aprenderlo. Sirve para ver qué te falta.",
    url: "https://roadmap.sh/",
    categories: TECH,
    sponsored: false,
  }),
  resource({
    type: "documentacion",
    lang: "en",
    source: "apple-developer",
    source_label: "Apple Developer",
    title: "Apple: tutoriales de SwiftUI",
    body:
      "La guía oficial de Apple para armar apps de iPhone y Mac con SwiftUI, paso a paso y con " +
      "proyectos.",
    url: "https://developer.apple.com/tutorials/swiftui",
    categories: TECH,
    sponsored: false,
    level: "entry",
  }),
  resource({
    type: "documentacion",
    lang: "en",
    source: "apple-developer",
    source_label: "Apple Developer",
    title: "Apple: Human Interface Guidelines",
    body:
      "Las pautas de diseño de Apple para sus plataformas: cómo se espera que se vea y se " +
      "comporte una app en iOS y macOS.",
    url: "https://developer.apple.com/design/human-interface-guidelines/",
    categories: [...TECH, "diseno"],
    sponsored: false,
  }),
  resource({
    type: "curso",
    lang: "es",
    source: "freecodecamp",
    source_label: "freeCodeCamp",
    title: "freeCodeCamp en español",
    body:
      "Currículo gratuito de desarrollo web con proyectos para el portafolio y certificaciones " +
      "al terminar cada bloque.",
    url: "https://www.freecodecamp.org/espanol/learn",
    categories: TECH,
    sponsored: false,
    level: "entry",
  }),
  resource({
    type: "curso",
    lang: "en",
    source: "cs50",
    source_label: "Harvard CS50",
    title: "CS50: introducción a las ciencias de la computación",
    body:
      "El curso abierto de Harvard: fundamentos de programación, algoritmos y bases de datos, " +
      "con clases grabadas y ejercicios.",
    url: "https://cs50.harvard.edu/x/",
    categories: TECH,
    sponsored: false,
    level: "entry",
  }),
  resource({
    type: "curso",
    lang: "en",
    source: "odin-project",
    source_label: "The Odin Project",
    title: "The Odin Project",
    body: "Ruta gratuita de desarrollo web full stack, armada alrededor de proyectos propios.",
    url: "https://www.theodinproject.com/paths",
    categories: TECH,
    sponsored: false,
    level: "entry",
  }),
  resource({
    type: "curso",
    lang: "en",
    source: "web-dev",
    source_label: "web.dev",
    title: "web.dev Learn",
    body:
      "Cursos de Google sobre CSS, accesibilidad, rendimiento y formularios, escritos por el " +
      "equipo de Chrome.",
    url: "https://web.dev/learn",
    categories: TECH,
    sponsored: false,
    level: "mid",
  }),
  resource({
    type: "curso",
    lang: "es",
    source: "platzi",
    source_label: "Platzi",
    title: "Platzi",
    body:
      "Escuela online de cursos de programación, datos y diseño en español, pensada para " +
      "Latinoamérica. Tiene una parte gratuita y una suscripción.",
    url: "https://platzi.com/",
    categories: [...TECH, ...DATA, "diseno", "marketing"],
    sponsored: false,
  }),
  resource({
    type: "video",
    lang: "es",
    source: "youtube-midudev",
    source_label: "midudev",
    title: "midudev",
    body: "Canal en español de JavaScript, React y carrera como programador, con cursos largos.",
    url: "https://www.youtube.com/@midudev",
    categories: TECH,
    sponsored: false,
  }),
  resource({
    type: "video",
    lang: "es",
    source: "youtube-holamundo",
    source_label: "HolaMundo",
    title: "HolaMundo",
    body: "Canal en español con cursos de programación desde cero para varios lenguajes.",
    url: "https://www.youtube.com/@HolaMundoDev",
    categories: TECH,
    sponsored: false,
    level: "entry",
  }),
  resource({
    type: "video",
    lang: "en",
    source: "youtube-freecodecamp",
    source_label: "freeCodeCamp",
    title: "freeCodeCamp en YouTube",
    body: "Cursos completos de varias horas, gratis, sobre casi cualquier tecnología.",
    url: "https://www.youtube.com/@freecodecamp",
    categories: TECH,
    sponsored: false,
  }),
  resource({
    type: "video",
    lang: "en",
    source: "youtube-fireship",
    source_label: "Fireship",
    title: "Fireship",
    body: "Resúmenes de cien segundos de cada tecnología nueva: sirve para saber de qué se habla.",
    url: "https://www.youtube.com/@Fireship",
    categories: TECH,
    sponsored: false,
  }),
  resource({
    type: "podcast",
    lang: "en",
    source: "syntax",
    source_label: "Syntax",
    title: "Syntax",
    body: "Podcast de desarrollo web: herramientas, CSS, JavaScript y cómo trabaja la gente del rubro.",
    url: "https://syntax.fm/",
    categories: TECH,
    sponsored: false,
  }),
  resource({
    type: "podcast",
    lang: "en",
    source: "changelog",
    source_label: "The Changelog",
    title: "The Changelog",
    body: "Entrevistas largas con quienes mantienen software abierto. Para entender el oficio por dentro.",
    url: "https://changelog.com/podcast",
    categories: TECH,
    sponsored: false,
  }),

  /* ---------- Datos y análisis ---------- */
  resource({
    type: "plataforma",
    lang: "en",
    source: "sqlbolt",
    source_label: "SQLBolt",
    title: "SQLBolt",
    body: "Lecciones interactivas de SQL, una consulta por vez, directo en el navegador.",
    url: "https://sqlbolt.com/",
    categories: DATA,
    sponsored: false,
    level: "entry",
  }),
  resource({
    type: "plataforma",
    lang: "en",
    source: "sqlzoo",
    source_label: "SQLZoo",
    title: "SQLZoo",
    body: "Ejercicios de SQL con corrección inmediata, de las consultas básicas a las avanzadas.",
    url: "https://www.sqlzoo.net/wiki/SQL_Tutorial",
    categories: DATA,
    sponsored: false,
  }),
  resource({
    type: "curso",
    lang: "en",
    source: "kaggle",
    source_label: "Kaggle",
    title: "Kaggle Learn",
    body:
      "Microcursos gratuitos de Python, pandas, SQL y machine learning, con ejercicios sobre " +
      "datos reales.",
    url: "https://www.kaggle.com/learn",
    categories: DATA,
    sponsored: false,
    level: "entry",
  }),
  resource({
    type: "curso",
    lang: "en",
    source: "thoughtspot",
    source_label: "ThoughtSpot",
    title: "ThoughtSpot: tutorial de SQL",
    body: "Tutorial de SQL pensado para análisis: de SELECT básico a funciones de ventana.",
    url: "https://www.thoughtspot.com/sql-tutorial",
    categories: DATA,
    sponsored: false,
  }),
  resource({
    type: "documentacion",
    lang: "es",
    source: "python-docs",
    source_label: "Python",
    title: "Tutorial oficial de Python",
    body: "El tutorial de la documentación de Python, traducido al español.",
    url: "https://docs.python.org/es/3/tutorial/",
    categories: [...TECH, ...DATA],
    sponsored: false,
    level: "entry",
  }),
  resource({
    type: "documentacion",
    lang: "en",
    source: "pandas",
    source_label: "pandas",
    title: "pandas: primeros pasos",
    body: "La guía oficial para empezar a trabajar con tablas de datos en Python.",
    url: "https://pandas.pydata.org/docs/getting_started/index.html",
    categories: DATA,
    sponsored: false,
    level: "entry",
  }),

  /* ---------- Diseño ---------- */
  resource({
    type: "documentacion",
    lang: "en",
    source: "material-design",
    source_label: "Material Design",
    title: "Material Design 3",
    body: "El sistema de diseño de Google: componentes, color, tipografía y criterios de accesibilidad.",
    url: "https://m3.material.io/",
    categories: ["diseno", ...TECH],
    sponsored: false,
  }),
  resource({
    type: "documentacion",
    lang: "en",
    source: "laws-of-ux",
    source_label: "Laws of UX",
    title: "Laws of UX",
    body: "Los principios de psicología que explican por qué una interfaz se entiende o no, con ejemplos.",
    url: "https://lawsofux.com/",
    categories: ["diseno"],
    sponsored: false,
  }),
  resource({
    type: "documentacion",
    lang: "en",
    source: "figma",
    source_label: "Figma",
    title: "Figma: biblioteca de recursos",
    body: "Guías de diseño de producto, sistemas de diseño y colaboración, de los autores de la herramienta.",
    url: "https://www.figma.com/resource-library/",
    categories: ["diseno"],
    sponsored: false,
  }),

  /* ---------- Marketing, ventas y atención ---------- */
  resource({
    type: "curso",
    lang: "es",
    source: "hubspot-academy",
    source_label: "HubSpot Academy",
    title: "HubSpot Academy",
    body:
      "Cursos gratuitos con certificado de marketing de contenidos, ventas y atención al " +
      "cliente, en español.",
    url: "https://academy.hubspot.com/es",
    categories: ["marketing", "ventas", "atencion-cliente"],
    sponsored: false,
    level: "entry",
  }),
  resource({
    type: "curso",
    lang: "es",
    source: "google-skillshop",
    source_label: "Google Skillshop",
    title: "Google Skillshop",
    body:
      "Capacitación oficial de Google en Ads, Analytics y Merchant Center, con certificaciones " +
      "gratuitas.",
    url: "https://skillshop.withgoogle.com/",
    categories: ["marketing", "datos-analisis"],
    sponsored: false,
  }),

  /* ---------- Administración, contabilidad y RR. HH. ---------- */
  resource({
    type: "curso",
    lang: "es",
    source: "microsoft-learn",
    source_label: "Microsoft Learn",
    title: "Microsoft Learn: Excel y herramientas de oficina",
    body:
      "Rutas gratuitas en español para trabajar con Excel y el resto de Microsoft 365, de lo " +
      "básico a tablas dinámicas.",
    url: "https://learn.microsoft.com/es-es/training/browse/?products=excel",
    categories: ["administracion", "contabilidad-finanzas", "datos-analisis"],
    sponsored: false,
  }),
  resource({
    type: "curso",
    lang: "en",
    source: "khan-academy",
    source_label: "Khan Academy",
    title: "Khan Academy: finanzas y contabilidad",
    body: "Lecciones gratuitas de contabilidad y de finanzas básicas, con ejercicios corregidos.",
    url: "https://www.khanacademy.org/economics-finance-domain/accounting",
    categories: ["contabilidad-finanzas", "administracion"],
    sponsored: false,
    level: "entry",
  }),
  resource({
    type: "documentacion",
    lang: "en",
    source: "openstax",
    source_label: "OpenStax",
    title: "OpenStax: libros de negocios",
    body: "Libros de texto abiertos y gratuitos de gestión, marketing, contabilidad y comportamiento organizacional.",
    url: "https://openstax.org/subjects/business",
    categories: ["administracion", "contabilidad-finanzas", "rrhh", "marketing", "ventas"],
    sponsored: false,
  }),
  resource({
    type: "documentacion",
    lang: "es",
    source: "mtss",
    source_label: "Ministerio de Trabajo y Seguridad Social",
    title: "MTSS: derechos y trámites laborales",
    body:
      "El sitio oficial del Ministerio: trámites, licencias, consejos de salarios y normativa " +
      "laboral de Uruguay.",
    url: "https://www.gub.uy/ministerio-trabajo-seguridad-social/",
    categories: ["rrhh", "administracion"],
    sponsored: false,
  }),

  /* ---------- Formación para el trabajo, en Uruguay ---------- */
  resource({
    type: "curso",
    lang: "es",
    source: "inefop",
    source_label: "INEFOP",
    title: "INEFOP: capacitación laboral",
    body:
      "El Instituto Nacional de Empleo y Formación Profesional: cursos y programas de " +
      "capacitación para el trabajo en todo el país.",
    url: "https://www.inefop.org.uy/",
    categories: TRADES,
    sponsored: false,
  }),

  /* ---------- Salud, ingeniería y educación ---------- */
  resource({
    type: "documentacion",
    lang: "es",
    source: "medlineplus",
    source_label: "MedlinePlus",
    title: "MedlinePlus en español",
    body: "Información de salud confiable, de la Biblioteca Nacional de Medicina de EE. UU., en español.",
    url: "https://medlineplus.gov/spanish/",
    categories: ["salud"],
    sponsored: false,
  }),
  resource({
    type: "curso",
    lang: "en",
    source: "khan-academy",
    source_label: "Khan Academy",
    title: "Khan Academy: salud y medicina",
    body: "Lecciones gratuitas de fisiología, anatomía y enfermedades, con videos y ejercicios.",
    url: "https://www.khanacademy.org/science/health-and-medicine",
    categories: ["salud"],
    sponsored: false,
  }),
  resource({
    type: "curso",
    lang: "en",
    source: "mit-ocw",
    source_label: "MIT OpenCourseWare",
    title: "MIT OpenCourseWare",
    body: "Los materiales de cursos del MIT, abiertos: ingeniería, matemática y computación, con ejercicios.",
    url: "https://ocw.mit.edu/",
    categories: ["ingenieria", ...TECH, ...DATA],
    sponsored: false,
    level: "mid",
  }),
  resource({
    type: "curso",
    lang: "es",
    source: "khan-academy-es",
    source_label: "Khan Academy en español",
    title: "Khan Academy en español",
    body: "Lecciones gratuitas de matemática, ciencias y más, en español, útiles para quien enseña y para quien aprende.",
    url: "https://es.khanacademy.org/",
    categories: ["educacion"],
    sponsored: false,
  }),
];

/**
 * Los recursos de un rubro, en el orden en que se muestran: por tipo y, dentro
 * del tipo, por título. Un recurso `sponsored` no sube ni baja: el pago no
 * cambia el orden.
 */
export function orderResources(items: ContentItem[]): ContentItem[] {
  const rank = (item: ContentItem): number => {
    const type = resourceType(item);
    const index = RESOURCE_TYPES.findIndex((candidate) => candidate.id === type);
    return index === -1 ? RESOURCE_TYPES.length : index;
  };
  return [...items].sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title, "es"));
}
