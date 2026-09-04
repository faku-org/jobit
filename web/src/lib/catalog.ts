import type { EducationLevel } from "./profile.ts";

/**
 * Closed lists for the two things people used to type by hand. A free-text box
 * invites "bachillerato", "Bachiller", "bto" and "asd" to mean the same thing,
 * and none of them can be matched against what an offer asks for. Everything
 * here is picked from a list instead, so a título is one value the app can
 * reason about.
 */
export interface CatalogEntry {
  /** Stable key stored in the browser; the label can be reworded freely. */
  id: string;
  label: string;
  /** The heading the entry sits under in the picker. */
  group: string;
  /** Extra words the search matches, for names people use in conversation. */
  aliases?: string[];
  /**
   * How this entry is recognised inside free text: a CV, or the description of
   * an offer. Left out on entries whose label already reads the way people
   * write them, which is most of them; `catalogPattern` derives one from the
   * label and the aliases in that case.
   */
  match?: RegExp;
}

export interface DegreeEntry extends CatalogEntry {
  /** The education level this título implies, used to keep the two in sync. */
  level: EducationLevel;
}

const secondary = (id: string, label: string, aliases?: string[], match?: RegExp): DegreeEntry => ({
  id,
  label,
  group: "Bachillerato",
  level: "secondary",
  ...(aliases ? { aliases } : {}),
  ...(match ? { match } : {}),
});

const technical = (id: string, label: string, aliases?: string[], match?: RegExp): DegreeEntry => ({
  id,
  label,
  group: "Técnico y terciario",
  level: "technical",
  ...(aliases ? { aliases } : {}),
  ...(match ? { match } : {}),
});

const university = (
  id: string,
  label: string,
  aliases?: string[],
  match?: RegExp,
): DegreeEntry => ({
  id,
  label,
  group: "Universitario",
  level: "university",
  ...(aliases ? { aliases } : {}),
  ...(match ? { match } : {}),
});

const postgrad = (id: string, label: string, aliases?: string[], match?: RegExp): DegreeEntry => ({
  id,
  label,
  group: "Posgrado",
  level: "postgrad",
  ...(aliases ? { aliases } : {}),
  ...(match ? { match } : {}),
});

/**
 * A bachillerato is named by its orientación, and the words around it change
 * with the school: "Bachillerato en Informática", "Bachillerato Tecnológico en
 * Informática", "Bachillerato - opción Informática", "Bachiller Informática".
 * Matching the label word for word recognised only the first of the four.
 */
const BACHILLERATO =
  /bachiller(?:ato)?[\s:.\-–—·|]*(?:tecnologico|profesional|general)?[\s:.\-–—·|]*(?:en|de|orientacion|opcion)?[\s:.\-–—·|]*/
    .source;

const oriented =
  (id: string, label: string, aliases?: string[]) =>
  (orientation: RegExp): DegreeEntry =>
    secondary(id, label, aliases, new RegExp(`${BACHILLERATO}(?:${orientation.source})`, "g"));

/** Títulos as they are named in Uruguay: secundaria, UTU, terciario, posgrado. */
export const DEGREES: DegreeEntry[] = [
  {
    id: "primaria",
    label: "Primaria completa",
    group: "Educación básica",
    level: "primary",
    match: /primaria completa/g,
  },
  {
    id: "ciclo-basico",
    label: "Ciclo básico completo",
    group: "Educación básica",
    level: "secondary_basic",
    aliases: ["liceo", "1ero a 3ero"],
    match: /ciclo b[aá]sico/g,
  },

  oriented("bach-ciencias-biologicas", "Bachillerato en Ciencias Biológicas", ["biológico"])(
    /ciencias biologicas|biologico/,
  ),
  oriented(
    "bach-ciencias-sociales",
    "Bachillerato en Ciencias Sociales y Humanidades",
  )(/ciencias sociales|humanidades/),
  oriented("bach-derecho", "Bachillerato en Derecho")(/derecho/),
  oriented(
    "bach-economia",
    "Bachillerato en Economía y Administración",
  )(/economia(?: y administracion)?/),
  oriented("bach-ingenieria", "Bachillerato en Ingeniería")(/ingenieria/),
  oriented(
    "bach-arquitectura",
    "Bachillerato en Arquitectura y Diseño",
  )(/arquitectura(?: y diseno)?/),
  oriented("bach-medicina", "Bachillerato en Ciencias Biológicas orientación Medicina")(/medicina/),
  secondary("bach-agrario", "Bachillerato Agrario"),
  secondary("bach-artistico", "Bachillerato Artístico"),
  oriented("bach-informatica", "Bachillerato en Informática")(/informatica|computacion/),
  oriented(
    "bach-deporte",
    "Bachillerato en Educación Física y Deporte",
  )(/educacion fisica|deporte/),
  oriented("bach-turismo", "Bachillerato en Turismo")(/turismo/),
  secondary(
    "bach-generico",
    "Bachillerato completo (otra orientación)",
    ["secundaria completa"],
    /bachillerato(?: completo)?|secundaria completa|liceo completo/g,
  ),

  technical("emt-informatica", "EMT Informática (UTU)", ["utu informática"]),
  technical("emt-administracion", "EMT Administración (UTU)"),
  technical("emt-electrotecnia", "EMT Electrotecnia (UTU)", ["electricidad"]),
  technical("emt-electronica", "EMT Electrónica (UTU)"),
  technical("emt-mecanica-automotriz", "EMT Mecánica Automotriz (UTU)"),
  technical("emt-mecanica-industrial", "EMT Mecánica Industrial (UTU)"),
  technical("emt-construccion", "EMT Construcción (UTU)"),
  technical("emt-gastronomia", "EMT Gastronomía (UTU)", ["cocina"]),
  technical("emt-turismo", "EMT Turismo y Hotelería (UTU)"),
  technical("emt-agraria", "EMT Agraria (UTU)"),
  technical("emt-quimica", "EMT Química (UTU)"),
  technical("emt-vestimenta", "EMT Diseño y Vestimenta (UTU)"),
  technical("emt-comunicacion", "EMT Comunicación Visual (UTU)"),
  technical("emt-deporte", "EMT Deporte y Recreación (UTU)"),
  technical(
    "tec-desarrollo-software",
    "Tecnicatura en Desarrollo de Software",
    ["programación"],
    /tecnicatura en desarrollo de software|desarrollo de software/g,
  ),
  technical("tec-redes", "Tecnicatura en Redes y Telecomunicaciones"),
  technical("tec-analista-sistemas", "Analista en Tecnologías de la Información"),
  technical("tec-logistica", "Tecnicatura en Logística"),
  technical("tec-comercio-exterior", "Tecnicatura en Comercio Exterior"),
  technical("tec-marketing", "Tecnicatura en Marketing"),
  technical("tec-rrhh", "Tecnicatura en Recursos Humanos"),
  technical("tec-contabilidad", "Tecnicatura en Contabilidad"),
  technical("tec-administracion-empresas", "Tecnicatura en Administración de Empresas"),
  technical(
    "tec-auxiliar-enfermeria",
    "Auxiliar de Enfermería",
    undefined,
    /auxiliar de enfermer[ií]a/g,
  ),
  technical("tec-auxiliar-farmacia", "Auxiliar de Farmacia", undefined, /auxiliar de farmacia/g),
  technical("tec-radiologia", "Tecnicatura en Radiología"),
  technical("tec-laboratorio-clinico", "Tecnicatura en Laboratorio Clínico"),
  technical("tec-higiene-dental", "Higienista en Odontología"),
  technical("tec-gastronomia", "Tecnicatura en Gastronomía"),
  technical("tec-turismo", "Tecnicatura en Turismo y Hotelería"),
  technical("tec-diseno-grafico", "Tecnicatura en Diseño Gráfico"),
  technical("tec-audiovisual", "Tecnicatura en Producción Audiovisual"),
  technical("tec-agropecuaria", "Tecnicatura Agropecuaria"),
  technical("tec-seguridad-laboral", "Tecnicatura en Seguridad e Higiene Laboral"),
  technical(
    "magisterio",
    "Magisterio",
    ["maestro", "maestra"],
    /magisterio|maestr[oa] de (?:primaria|escuela)/g,
  ),
  technical(
    "profesorado",
    "Profesorado (IPA / CERP)",
    ["docente"],
    /profesorado|\bipa\b|\bcerp\b/g,
  ),

  university("lic-administracion", "Licenciatura en Administración", ["contador público"]),
  university("contador-publico", "Contador Público", undefined, /contador p[uú]blico|\bcpa\b/g),
  university("lic-economia", "Licenciatura en Economía"),
  university("lic-contabilidad", "Licenciatura en Contabilidad"),
  university(
    "abogacia",
    "Abogacía / Doctor en Derecho",
    ["derecho"],
    /abogac[ií]a|abogad[oa]|doctor en derecho/g,
  ),
  university(
    "escribania",
    "Escribanía Pública",
    ["notariado"],
    /escriban[ií]a|escriban[oa]|notariado/g,
  ),
  university("lic-psicologia", "Licenciatura en Psicología"),
  university("lic-comunicacion", "Licenciatura en Comunicación"),
  university("lic-trabajo-social", "Licenciatura en Trabajo Social"),
  university("lic-sociologia", "Licenciatura en Sociología"),
  university("lic-ciencia-politica", "Licenciatura en Ciencia Política"),
  university("lic-relaciones-internacionales", "Licenciatura en Relaciones Internacionales"),
  university("lic-rrhh", "Licenciatura en Recursos Humanos"),
  university("lic-marketing", "Licenciatura en Marketing"),
  university("lic-negocios-internacionales", "Licenciatura en Negocios Internacionales"),
  university(
    "lic-informatica",
    "Licenciatura en Informática",
    ["sistemas"],
    /licenciatura en (?:inform[aá]tica|computaci[oó]n)|analista programador/g,
  ),
  university(
    "ing-sistemas",
    "Ingeniería en Computación / Sistemas",
    ["software"],
    /ingenier[ií]a en (?:computaci[oó]n|sistemas|inform[aá]tica)/g,
  ),
  university("lic-ciencia-datos", "Licenciatura en Ciencia de Datos"),
  university("ing-civil", "Ingeniería Civil"),
  university("ing-industrial", "Ingeniería Industrial"),
  university("ing-electrica", "Ingeniería Eléctrica"),
  university("ing-mecanica", "Ingeniería Mecánica"),
  university("ing-quimica", "Ingeniería Química"),
  university("ing-agronomica", "Ingeniería Agronómica", ["agronomía"]),
  university("ing-alimentos", "Ingeniería en Alimentos"),
  /** "Arquitectura de microservicios", "arquitectura de la información" y
   * "arquitectura de contenido" son maneras de construir software, no el
   * título: sin esto un CV de programación decía carrera universitaria. */
  university(
    "arquitectura",
    "Arquitectura",
    undefined,
    /arquitect[oa]s?|arquitectura(?!\s+(?:de\s+)?(?:software|microservicios|sistemas|contenidos?|datos|informacion|informaci[oó]n|de\s+la\s+informaci[oó]n|hexagonal|limpia|serverless|cloud))/g,
  ),
  university("lic-diseno", "Licenciatura en Diseño (gráfico, industrial, textil)"),
  university("medicina", "Doctor en Medicina", undefined, /doctor en medicina|\bmedicina\b/g),
  university("lic-enfermeria", "Licenciatura en Enfermería"),
  university("odontologia", "Odontología"),
  university("lic-nutricion", "Licenciatura en Nutrición"),
  university("lic-fisioterapia", "Licenciatura en Fisioterapia", ["kinesiología"]),
  university("lic-fonoaudiologia", "Licenciatura en Fonoaudiología"),
  university("quimico-farmaceutico", "Químico Farmacéutico"),
  university(
    "veterinaria",
    "Doctor en Ciencias Veterinarias",
    ["veterinario"],
    /veterinari[oa]|ciencias veterinarias/g,
  ),
  university("lic-biologia", "Licenciatura en Ciencias Biológicas"),
  university("lic-quimica", "Licenciatura en Química"),
  university("lic-matematica", "Licenciatura en Matemática"),
  university("lic-fisica", "Licenciatura en Física"),
  university("lic-educacion-fisica", "Licenciatura en Educación Física"),
  university("lic-turismo", "Licenciatura en Turismo"),
  university("lic-letras", "Licenciatura en Letras / Humanidades"),
  university("lic-historia", "Licenciatura en Historia"),
  university("traductorado", "Traductorado Público"),

  postgrad("diploma-posgrado", "Diploma de posgrado", undefined, /diploma de posgrado|posgrado\b/g),
  postgrad("especializacion", "Especialización", undefined, /especializaci[oó]n\b/g),
  postgrad(
    "mba",
    "MBA / Maestría en Administración de Empresas",
    undefined,
    /\bmba\b|maestr[ií]a en administraci[oó]n/g,
  ),
  postgrad("maestria", "Maestría", undefined, /maestr[ií]a\b|\bmsc\b/g),
  postgrad("doctorado", "Doctorado / PhD", undefined, /doctorado|\bphd\b/g),
];

/** Cursos, certificaciones y carnés: what people list under "otros estudios". */
export const COURSES: CatalogEntry[] = [
  {
    id: "ingles-basico",
    label: "Inglés básico (A1-A2)",
    group: "Idiomas",
    match: /ingl[eé]s[\s:.()|·-]*(?:b[aá]sico|inicial|a1|a2)/g,
  },
  {
    id: "ingles-intermedio",
    label: "Inglés intermedio (B1-B2)",
    group: "Idiomas",
    aliases: ["first"],
    match: /ingl[eé]s[\s:.()|·-]*(?:intermedio|medio|b1|b2)|first certificate/g,
  },
  {
    id: "ingles-avanzado",
    label: "Inglés avanzado (C1-C2)",
    group: "Idiomas",
    aliases: ["proficiency"],
    match: /ingl[eé]s[\s:.()|·-]*(?:avanzado|fluido|c1|c2|biling[uü]e)|proficiency/g,
  },
  { id: "portugues", label: "Portugués", group: "Idiomas", match: /portugu[eé]s/g },
  { id: "italiano", label: "Italiano", group: "Idiomas", match: /italiano/g },
  { id: "frances", label: "Francés", group: "Idiomas", match: /franc[eé]s/g },
  { id: "aleman", label: "Alemán", group: "Idiomas", match: /alem[aá]n/g },
  {
    id: "lengua-senas",
    label: "Lengua de señas uruguaya",
    group: "Idiomas",
    aliases: ["lsu"],
    match: /lengua de se[nñ]as|lsu\b/g,
  },

  {
    id: "excel-basico",
    label: "Excel básico",
    group: "Informática",
    match: /excel\s*(?:b[aá]sico|inicial)/g,
  },
  {
    id: "excel-avanzado",
    label: "Excel avanzado",
    group: "Informática",
    aliases: ["tablas dinámicas"],
    match: /excel\s*avanzado|tablas din[aá]micas|macros/g,
  },
  {
    id: "office",
    label: "Paquete Office",
    group: "Informática",
    aliases: ["word", "powerpoint"],
    match: /paquete office|microsoft office|\boffice\b|\bword\b|powerpoint/g,
  },
  {
    id: "google-workspace",
    label: "Google Workspace",
    group: "Informática",
    aliases: ["sheets"],
    match: /google\s*(?:workspace|suite|sheets|drive)/g,
  },
  {
    id: "informatica-usuario",
    label: "Informática nivel usuario",
    group: "Informática",
    match: /inform[aá]tica (?:nivel )?usuario|manejo de pc/g,
  },
  {
    id: "programacion-web",
    label: "Programación web",
    group: "Informática",
    aliases: ["html", "css"],
    match: /\bhtml\b|\bcss\b|programaci[oó]n web|desarrollo web/g,
  },
  {
    id: "javascript",
    label: "JavaScript / TypeScript",
    group: "Informática",
    match: /javascript|typescript|\bnode\b|\breact\b/g,
  },
  { id: "python", label: "Python", group: "Informática", match: /\bpython\b/g },
  { id: "java", label: "Java", group: "Informática", match: /\bjava\b(?!script)/g },
  {
    id: "sql",
    label: "Bases de datos y SQL",
    group: "Informática",
    match: /\bsql\b|base[s]? de datos|mysql|postgres/g,
  },
  {
    id: "testing-qa",
    label: "Testing / QA",
    group: "Informática",
    match: /\bqa\b|testing|tester|pruebas de software/g,
  },
  {
    id: "soporte-tecnico",
    label: "Soporte técnico y help desk",
    group: "Informática",
    match: /soporte t[eé]cnico|help ?desk|mesa de ayuda/g,
  },
  {
    id: "redes",
    label: "Redes y cableado",
    group: "Informática",
    match: /\bredes\b|cableado estructurado|networking/g,
  },
  {
    id: "ciberseguridad",
    label: "Ciberseguridad",
    group: "Informática",
    match: /ciberseguridad|seguridad inform[aá]tica/g,
  },
  {
    id: "power-bi",
    label: "Power BI / análisis de datos",
    group: "Informática",
    match: /power ?bi|an[aá]lisis de datos|tableau/g,
  },

  {
    id: "contabilidad-basica",
    label: "Contabilidad básica",
    group: "Administración",
    match: /contabilidad(?:\s*b[aá]sica)?/g,
  },
  {
    id: "liquidacion-sueldos",
    label: "Liquidación de sueldos",
    group: "Administración",
    match: /liquidaci[oó]n de (?:sueldos|haberes|jornales)/g,
  },
  {
    id: "facturacion-electronica",
    label: "Facturación electrónica",
    group: "Administración",
    match: /facturaci[oó]n electr[oó]nica|\bcfe\b/g,
  },
  {
    id: "gestion-stock",
    label: "Gestión de stock e inventario",
    group: "Administración",
    match: /gesti[oó]n de stock|control de stock|inventario/g,
  },
  {
    id: "comercio-exterior",
    label: "Comercio exterior",
    group: "Administración",
    match: /comercio exterior|importaci[oó]n|exportaci[oó]n/g,
  },
  {
    id: "atencion-cliente",
    label: "Atención al cliente",
    group: "Administración",
    match: /atenci[oó]n al (?:cliente|p[uú]blico)/g,
  },
  {
    id: "tecnicas-venta",
    label: "Técnicas de venta",
    group: "Administración",
    match: /t[eé]cnicas de venta|\bventas\b/g,
  },
  {
    id: "telemarketing",
    label: "Telemarketing / call center",
    group: "Administración",
    match: /telemarketing|call ?center|teleoperador/g,
  },
  {
    id: "cajero",
    label: "Cajero",
    group: "Administración",
    match: /\bcajer[oa]\b|manejo de caja/g,
  },
  {
    id: "recepcion",
    label: "Recepción y secretariado",
    group: "Administración",
    match: /recepci[oó]n|secretariado|secretari[oa]/g,
  },
  {
    id: "gestion-proyectos",
    label: "Gestión de proyectos",
    group: "Administración",
    match: /gesti[oó]n de proyectos|\bpmp\b|scrum/g,
  },
  {
    id: "marketing-digital",
    label: "Marketing digital",
    group: "Administración",
    aliases: ["redes sociales"],
    match: /marketing digital|redes sociales|\bseo\b/g,
  },
  {
    id: "community-manager",
    label: "Community manager",
    group: "Administración",
    match: /community manager/g,
  },
  {
    id: "diseno-grafico",
    label: "Diseño gráfico",
    group: "Administración",
    aliases: ["photoshop", "illustrator"],
    match: /dise[nñ]o gr[aá]fico|photoshop|illustrator|figma/g,
  },

  {
    id: "carne-salud",
    label: "Carné de salud vigente",
    group: "Certificaciones y carnés",
    match: /carn[eé] de salud/g,
  },
  {
    id: "manipulacion-alimentos",
    label: "Carné de manipulación de alimentos",
    group: "Certificaciones y carnés",
    match: /manipulaci[oó]n de alimentos|carn[eé] de manipulaci[oó]n/g,
  },
  {
    id: "libreta-a",
    label: "Libreta de conducir A (moto)",
    group: "Certificaciones y carnés",
    match: /libreta(?: de conducir)?\s+(?:categor[ií]a\s*|cat\.?\s*)?a\b|libreta de moto/g,
  },
  {
    id: "libreta-b",
    label: "Libreta de conducir B (auto)",
    group: "Certificaciones y carnés",
    match: /libreta(?: de conducir)?(?:\s*(?:categor[ií]a\s*)?b\b)?|carn[eé] de conducir/g,
  },
  {
    id: "libreta-c",
    label: "Libreta de conducir C (camión)",
    group: "Certificaciones y carnés",
    match: /libreta(?: de conducir)?\s+(?:categor[ií]a\s*|cat\.?\s*)?c\b|libreta de cami[oó]n/g,
  },
  {
    id: "libreta-e",
    label: "Libreta de conducir E (profesional)",
    group: "Certificaciones y carnés",
    match: /libreta(?: de conducir)?\s+(?:categor[ií]a\s*|cat\.?\s*)?e\b|libreta profesional/g,
  },
  {
    id: "carne-peon-rural",
    label: "Carné de peón rural",
    group: "Certificaciones y carnés",
    match: /pe[oó]n rural/g,
  },
  {
    id: "carne-guarda-seguridad",
    label: "Habilitación de guardia de seguridad",
    group: "Certificaciones y carnés",
  },
  { id: "yasta", label: "Curso Yo Estudio y Trabajo / Yasta", group: "Certificaciones y carnés" },

  {
    id: "primeros-auxilios",
    label: "Primeros auxilios",
    group: "Salud y seguridad",
    match: /primeros auxilios/g,
  },
  {
    id: "rcp",
    label: "RCP y DEA",
    group: "Salud y seguridad",
    match: /\brcp\b|\bdea\b|reanimaci[oó]n/g,
  },
  {
    id: "seguridad-laboral",
    label: "Seguridad e higiene laboral",
    group: "Salud y seguridad",
    match: /seguridad e higiene|higiene y seguridad|prevencionista/g,
  },
  {
    id: "trabajo-altura",
    label: "Trabajo en altura",
    group: "Salud y seguridad",
    match: /trabajo en altura/g,
  },
  { id: "prevencion-incendios", label: "Prevención de incendios", group: "Salud y seguridad" },
  {
    id: "cuidados-adultos",
    label: "Cuidados de adultos mayores",
    group: "Salud y seguridad",
    match: /cuidado[s]? de (?:adultos|personas mayores)|cuidador[a]? de ancianos/g,
  },
  {
    id: "acompanante-terapeutico",
    label: "Acompañante terapéutico",
    group: "Salud y seguridad",
    match: /acompa[nñ]ante terap[eé]utico/g,
  },
  { id: "primera-infancia", label: "Atención a la primera infancia", group: "Salud y seguridad" },

  {
    id: "electricidad",
    label: "Electricidad domiciliaria",
    group: "Oficios",
    match: /electricidad|electricista/g,
  },
  {
    id: "instalador-electricista",
    label: "Instalador electricista habilitado",
    group: "Oficios",
    match: /instalador electricista|\bure\b/g,
  },
  {
    id: "sanitaria",
    label: "Sanitaria y plomería",
    group: "Oficios",
    match: /sanitaria|plomer[ií]a|plomero/g,
  },
  { id: "soldadura", label: "Soldadura", group: "Oficios", match: /soldadura|soldador/g },
  {
    id: "carpinteria",
    label: "Carpintería",
    group: "Oficios",
    match: /carpinter[ií]a|carpintero/g,
  },
  {
    id: "albanileria",
    label: "Albañilería",
    group: "Oficios",
    match: /alba[nñ]iler[ií]a|alba[nñ]il/g,
  },
  {
    id: "refrigeracion",
    label: "Refrigeración y aire acondicionado",
    group: "Oficios",
    match: /refrigeraci[oó]n|aire acondicionado|climatizaci[oó]n/g,
  },
  {
    id: "mecanica-automotriz",
    label: "Mecánica automotriz",
    group: "Oficios",
    match: /mec[aá]nica automotriz|mec[aá]nico/g,
  },
  {
    id: "autoelevador",
    label: "Manejo de autoelevador",
    group: "Oficios",
    aliases: ["montacargas"],
    match: /autoelevador|montacargas|clark\b/g,
  },
  {
    id: "panaderia",
    label: "Panadería y repostería",
    group: "Oficios",
    match: /panader[ií]a|pasteler[ií]a|reposter[ií]a/g,
  },
  {
    id: "cocina",
    label: "Cocina",
    group: "Oficios",
    aliases: ["gastronomía"],
    match: /\bcocina\b|gastronom[ií]a|cocinero/g,
  },
  { id: "barista", label: "Barista", group: "Oficios", match: /barista/g },
  { id: "bartender", label: "Bartender", group: "Oficios", match: /bartender|barman/g },
  {
    id: "mozo",
    label: "Servicio de sala / mozo",
    group: "Oficios",
    match: /\bmoz[oa]\b|servicio de sala|camarer[oa]/g,
  },
  { id: "peluqueria", label: "Peluquería", group: "Oficios", match: /peluquer[ií]a|peluquer[oa]/g },
  { id: "barberia", label: "Barbería", group: "Oficios", match: /barber[ií]a|barbero/g },
  {
    id: "estetica",
    /** Suelta, "estética" es un adjetivo que aparece en cualquier CV de
     * diseño: el oficio se nombra con su especialidad o con el sustantivo. */
    label: "Estética y cosmetología",
    group: "Oficios",
    match: /est[eé]tica (?:integral|facial|corporal|profesional)|esteticista|cosmetolog[ií]a/g,
  },
  { id: "manicuria", label: "Manicuría", group: "Oficios", match: /manicur[ií]a|manicura/g },
  {
    id: "costura",
    label: "Corte y confección",
    group: "Oficios",
    match: /corte y confecci[oó]n|costura|modister[ií]a/g,
  },
  {
    id: "jardineria",
    label: "Jardinería y paisajismo",
    group: "Oficios",
    match: /jardiner[ií]a|paisajismo/g,
  },
  {
    id: "limpieza-profesional",
    label: "Limpieza profesional",
    group: "Oficios",
    match: /limpieza(?: profesional| industrial)?/g,
  },

  { id: "liderazgo", label: "Liderazgo y trabajo en equipo", group: "Habilidades" },
  { id: "oratoria", label: "Oratoria y comunicación", group: "Habilidades" },
  { id: "negociacion", label: "Negociación", group: "Habilidades" },
  { id: "emprendedurismo", label: "Emprendedurismo", group: "Habilidades" },
  { id: "redaccion", label: "Redacción y ortografía", group: "Habilidades" },
];

const DEGREE_BY_ID = new Map(DEGREES.map((entry) => [entry.id, entry]));
const COURSE_BY_ID = new Map(COURSES.map((entry) => [entry.id, entry]));

export const degreeById = (id: string): DegreeEntry | undefined => DEGREE_BY_ID.get(id);
export const courseById = (id: string): CatalogEntry | undefined => COURSE_BY_ID.get(id);

export const isDegreeId = (id: string): boolean => DEGREE_BY_ID.has(id);
export const isCourseId = (id: string): boolean => COURSE_BY_ID.has(id);

/** Labels for what is stored, skipping ids that a later version dropped. */
export const labelsFor = (ids: string[], lookup: (id: string) => CatalogEntry | undefined) =>
  ids.flatMap((id) => {
    const entry = lookup(id);
    return entry ? [entry.label] : [];
  });

export const fold = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * Folded text alongside, for every folded position, the index it came from in
 * the original. Searching happens on the folded string, but a highlight has to
 * be painted on the text the person is reading, and folding is not always
 * length-preserving: "ß" lowercases to two characters and a ligature expands.
 * Walking code points keeps surrogate pairs intact.
 */
export function foldWithIndex(value: string): { text: string; map: number[] } {
  let text = "";
  const map: number[] = [];
  let at = 0;

  for (const character of value) {
    for (const folded of fold(character)) {
      text += folded;
      map.push(at);
    }
    at += character.length;
  }

  return { text, map };
}

const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The label without its parenthetical, which is a clarification and not a name. */
const bareLabel = (label: string): string => label.replace(/\s*\([^)]*\)/g, "").trim();

const patterns = new Map<string, RegExp>();

/**
 * Recognises one catalog entry inside free text: a CV, or the description of an
 * offer. Derived from the label alone, so the whole catalog is recognisable
 * without hand-writing 180 regexes; an entry that people write differently sets
 * `match` itself.
 *
 * Aliases are deliberately left out. They exist so "maestro" finds Magisterio
 * in the picker, and a word that loose would light up half of every offer.
 */
export function catalogPattern(entry: CatalogEntry): RegExp {
  const cached = patterns.get(entry.id);
  if (cached) return cached;

  const built =
    entry.match ??
    new RegExp(`\\b${escape(fold(bareLabel(entry.label))).replace(/\s+/g, "\\s+")}\\b`, "g");

  /** A fresh object each call would drop lastIndex handling on the caller. */
  const flagged = new RegExp(
    built.source,
    built.flags.includes("g") ? built.flags : `${built.flags}g`,
  );
  patterns.set(entry.id, flagged);
  return flagged;
}

/** Matches every word of the query against label, group and aliases. */
export function searchCatalog<T extends CatalogEntry>(entries: T[], query: string): T[] {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return entries;

  return entries.filter((entry) => {
    const haystack = fold([entry.label, entry.group, ...(entry.aliases ?? [])].join(" "));
    return terms.every((term) => haystack.includes(term));
  });
}

/** Groups entries in catalog order, so the picker keeps its headings. */
export function groupCatalog<T extends CatalogEntry>(entries: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const bucket = groups.get(entry.group);
    if (bucket) bucket.push(entry);
    else groups.set(entry.group, [entry]);
  }
  return [...groups.entries()];
}
