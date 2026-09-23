/**
 * Las habilidades concretas que más se piden, para poder contarlas.
 *
 * Las descripciones las escribe cada empresa como quiere, así que se matchean
 * contra este catálogo y no contra el texto crudo: "Manejo de Excel avanzado" y
 * "Excel intermedio" cuentan igual. Es el mismo mecanismo que roles.ts, con una
 * diferencia: un título nombra un puesto y una descripción menciona varias
 * habilidades, así que acá no se corta en la primera.
 */
export interface Skill {
  slug: string;
  label: string;
  pattern: RegExp;
}

export const SKILLS: Skill[] = [
  { slug: "excel", label: "Excel", pattern: /excel/ },
  { slug: "word", label: "Word", pattern: /\bword\b/ },
  { slug: "office", label: "Paquete Office", pattern: /office/ },
  { slug: "ingles", label: "Inglés", pattern: /ingles/ },
  { slug: "portugues", label: "Portugués", pattern: /portugues/ },

  {
    slug: "atencion-cliente",
    label: "Atención al cliente",
    pattern: /atencion al (cliente|publico)|servicio al cliente/,
  },
  { slug: "caja", label: "Manejo de caja", pattern: /caja registradora|arqueo de caja|manejo de caja/ },
  { slug: "reposicion", label: "Reposición y stock", pattern: /reposicion|reponer|stock|mercaderia/ },
  { slug: "ventas", label: "Ventas", pattern: /ventas|comercializacion/ },
  { slug: "cobranzas", label: "Cobranzas", pattern: /cobranza/ },
  { slug: "recepcion", label: "Recepción y telefonía", pattern: /recepcion|telefonista|centralita/ },

  { slug: "facturacion", label: "Facturación", pattern: /facturaci|e ?factura/ },
  { slug: "contabilidad", label: "Contabilidad", pattern: /contabilid|contable|balance|asiento/ },
  { slug: "sueldos", label: "Liquidación de sueldos", pattern: /liquidacion de sueldos|nomina|sueldos/ },
  { slug: "impuestos", label: "Impuestos y DGI", pattern: /impuestos|\bdgi\b|\biva\b|tributari/ },
  { slug: "sap", label: "SAP", pattern: /\bsap\b/ },
  { slug: "tango", label: "Tango gestión", pattern: /\btango\b/ },

  { slug: "sql", label: "Bases de datos / SQL", pattern: /\bsql\b|base de datos/ },
  { slug: "python", label: "Python", pattern: /python/ },
  { slug: "javascript", label: "JavaScript", pattern: /javascript|typescript/ },
  { slug: "react", label: "React", pattern: /\breact\b/ },
  { slug: "java", label: "Java", pattern: /\bjava\b/ },
  { slug: "php", label: "PHP", pattern: /\bphp\b/ },
  {
    slug: "desarrollo-web",
    label: "Desarrollo web",
    pattern: /desarrollo web|front ?end|back ?end|full ?stack/,
  },
  { slug: "cad", label: "CAD y diseño técnico", pattern: /autocad|\bcad\b|solidworks|revit/ },

  {
    slug: "redes-sociales",
    label: "Redes sociales",
    pattern: /redes sociales|community manager|instagram|facebook/,
  },
  {
    slug: "marketing-digital",
    label: "Marketing digital",
    pattern: /marketing digital|google ads|\bseo\b|\bsem\b/,
  },
  { slug: "diseno-grafico", label: "Diseño gráfico", pattern: /diseno grafico|photoshop|illustrator|corel/ },
  { slug: "edicion-video", label: "Edición de video", pattern: /edicion de video|premiere|after effects/ },

  { slug: "cocina", label: "Cocina", pattern: /cocina|gastronom/ },
  { slug: "manipulacion-alimentos", label: "Manipulación de alimentos", pattern: /manipulacion de alimentos/ },
  { slug: "primeros-auxilios", label: "Primeros auxilios", pattern: /primeros auxilios/ },
  { slug: "enfermeria", label: "Enfermería y cuidados", pattern: /enfermeri|cuidador|cuidado de (ninos|adultos)/ },

  { slug: "electricidad", label: "Electricidad", pattern: /electricid|electricista|instalaciones electricas/ },
  { slug: "soldadura", label: "Soldadura", pattern: /soldadur|soldador/ },
  { slug: "albanileria", label: "Albañilería", pattern: /albanil|mamposteria|construccion/ },
  { slug: "plomeria", label: "Plomería y gas", pattern: /plomeri|sanitari|gasista/ },
  { slug: "mecanica", label: "Mecánica", pattern: /mecanic/ },
  {
    slug: "refrigeracion",
    label: "Refrigeración y climatización",
    pattern: /refrigeracion|climatizacion|aire acondicionado/,
  },
  {
    slug: "conducir",
    label: "Licencia de conducir",
    pattern: /licencia de conducir|libreta de conducir|carnet de conducir|registro de conducir/,
  },
  { slug: "camion", label: "Camión y categoría E", pattern: /camion|categoria e\b/ },
  {
    slug: "autoelevador",
    label: "Autoelevador y grúa",
    pattern: /autoelevador|montacarg|\bgrua\b|pala mecanica/,
  },
  { slug: "seguridad", label: "Vigilancia y portería", pattern: /seguridad privada|vigilancia|portero|sereno/ },
  { slug: "limpieza", label: "Limpieza y aseo", pattern: /limpieza|aseo/ },
  { slug: "mantenimiento", label: "Mantenimiento", pattern: /mantenimiento/ },
  { slug: "calidad", label: "Calidad y normas", pattern: /\bcalidad\b|iso 9001|\bbpm\b/ },
  { slug: "liderazgo", label: "Liderazgo y equipos", pattern: /liderazgo|trabajo en equipo/ },
  { slug: "rrhh", label: "Reclutamiento", pattern: /reclutamiento|seleccion de personal|recursos humanos/ },
];

const fold = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Todas las habilidades que nombra un texto, sin repetir. */
export function skillsOf(value: string): Skill[] {
  const needle = ` ${fold(value).replace(/[^a-z0-9+#/.]+/g, " ")} `;
  return SKILLS.filter((skill) => skill.pattern.test(needle));
}
