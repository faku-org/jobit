/**
 * The puestos the board actually publishes, so "los más solicitados" can be
 * counted. Titles are written freely ("BUSCAMOS VENDEDOR SENIOR PARA
 * IMPORTADORA…"), so counting raw titles counts nothing: each one is matched
 * against this list instead and reported under the role it names.
 */
export interface Role {
  slug: string;
  label: string;
  pattern: RegExp;
}

/**
 * Order is priority: a title matches the first role that fits. "Auxiliar de
 * limpieza" is a cleaning job before it is an auxiliar, so the roles that say
 * something specific come first and the catch-all ranks (auxiliar, asistente,
 * encargado…) come last.
 */
export const ROLES: Role[] = [
  { slug: "vendedor", label: "Vendedor / a", pattern: /vendedor|vendedora/ },
  { slug: "cajero", label: "Cajero / a", pattern: /cajer[oa]/ },
  { slug: "repositor", label: "Repositor / a", pattern: /repositor|reponedor|gondoler/ },
  { slug: "promotor", label: "Promotor / a", pattern: /promotor/ },
  {
    slug: "asesor-comercial",
    label: "Asesor comercial",
    pattern: /asesor.{0,12}(comercial|venta)/,
  },
  {
    slug: "ejecutivo-cuentas",
    label: "Ejecutivo de cuentas",
    pattern: /ejecutiv[oa].{0,15}cuenta/,
  },
  {
    slug: "call-center",
    label: "Call center / telemarketing",
    pattern: /call center|telemarket|teleoperador/,
  },
  {
    slug: "atencion-cliente",
    label: "Atención al cliente",
    pattern: /atencion al (cliente|publico)|servicio al cliente/,
  },
  { slug: "recepcionista", label: "Recepcionista", pattern: /recepcionista|recepcion / },

  { slug: "chofer", label: "Chofer / repartidor", pattern: /chofer|conductor|repartidor|delivery/ },
  {
    slug: "deposito",
    label: "Depósito y logística",
    pattern: /deposit|almacen|logistic|picking|autoelevador|montacarg/,
  },

  { slug: "cocinero", label: "Cocinero / a", pattern: /cocinero|chef|cocina/ },
  {
    slug: "mozo",
    label: "Mozo / a y barra",
    pattern: /mozo|moza|camarer|barman|bartender|barista/,
  },
  {
    slug: "panadero",
    label: "Panadero y pastelero",
    pattern: /panader|pastelero|reposter|confiter/,
  },
  { slug: "carnicero", label: "Carnicero / a", pattern: /carnicer|fiambrer/ },

  { slug: "limpieza", label: "Limpieza", pattern: /limpieza|mucama|maestranza/ },
  { slug: "seguridad", label: "Seguridad y vigilancia", pattern: /seguridad|vigilan|guardia/ },
  { slug: "cuidados", label: "Cuidados y acompañamiento", pattern: /cuidador|acompanante|ninera/ },

  { slug: "enfermeria", label: "Enfermería", pattern: /enfermer/ },
  {
    slug: "especialista-medico",
    label: "Especialidades médicas",
    pattern:
      /\besp\b.{0,25}(anestesiolog|pediatr|cardiolog|neurolog|ginecolog|cirug|psiquiatr|traumatolog|dermatolog|oftalmolog|urolog|oncolog|hematolog|nefrolog|endocrinolog|reumatolog|geriatr|intensiv|emergenc|infectolog|neumolog|patolog)/,
  },
  {
    slug: "imagenologia",
    label: "Imagenología y radiología",
    pattern: /imagenolog|radiolog|ecograf|tomograf/,
  },
  { slug: "nutricion", label: "Nutrición", pattern: /nutricion|nutricionista/ },
  {
    slug: "fisioterapia",
    label: "Fisioterapia y rehabilitación",
    pattern: /fisioterap|kinesiolog|fonoaudiolog|terapia ocupacional/,
  },
  { slug: "medico", label: "Médico / a", pattern: /medico|medica |doctor|\bmed\b/ },
  { slug: "farmacia", label: "Farmacia", pattern: /farmac/ },
  { slug: "laboratorio", label: "Laboratorio", pattern: /laboratori|bioquimic/ },
  { slug: "odontologia", label: "Odontología", pattern: /odontolog|dentista/ },

  {
    slug: "docente",
    label: "Docente y profesor",
    pattern: /docente|profesor|\bprof\b|maestr[oa] |educador|tallerista/,
  },
  {
    slug: "auxiliar-docente",
    label: "Auxiliar docente",
    pattern: /auxiliar.{0,12}(docente|educa)/,
  },

  {
    slug: "desarrollador",
    label: "Desarrollo de software",
    pattern: /desarrollad|programador|developer|full ?stack|backend|frontend/,
  },
  {
    slug: "soporte-ti",
    label: "Soporte técnico y help desk",
    pattern: /soporte (tecnico|ti|it)|help ?desk|mesa de ayuda/,
  },
  {
    slug: "infraestructura",
    label: "Redes e infraestructura",
    pattern: /infraestructura|sysadmin|redes |devops|ciberseguridad/,
  },
  { slug: "qa", label: "QA y testing", pattern: /\bqa\b|tester|testing/ },
  {
    slug: "datos",
    label: "Datos y BI",
    pattern: /\bbi\b|power bi|cientific[oa] de datos|data |analista de datos/,
  },

  { slug: "contador", label: "Contador / a", pattern: /contador|contadora/ },
  {
    slug: "administrativo-contable",
    label: "Administrativo contable",
    pattern: /administrativ.{0,15}contable|contable/,
  },
  { slug: "auditor", label: "Auditoría", pattern: /auditor/ },
  { slug: "cobranzas", label: "Cobranzas", pattern: /cobranza|creditos/ },

  {
    slug: "rrhh",
    label: "Recursos humanos",
    pattern: /recursos humanos|\brrhh\b|seleccion de personal|reclutad|talento/,
  },
  {
    slug: "marketing",
    label: "Marketing y redes",
    pattern: /marketing|community manager|redes sociales|publicidad/,
  },
  { slug: "disenador", label: "Diseño", pattern: /disenador|diseno grafico|\bux\b|\bui\b/ },
  {
    slug: "comercio-exterior",
    label: "Comercio exterior",
    pattern: /comercio exterior|importacion|exportacion|despachant/,
  },
  {
    slug: "compras",
    label: "Compras y abastecimiento",
    pattern: /compras|abastecimiento|proveedores/,
  },

  { slug: "electricista", label: "Electricista", pattern: /electricista|electrotecni/ },
  { slug: "sanitario", label: "Sanitaria y plomería", pattern: /sanitari|plomer/ },
  { slug: "soldador", label: "Soldador", pattern: /soldador|soldadura/ },
  { slug: "mecanico", label: "Mecánico / a", pattern: /mecanic/ },
  { slug: "carpintero", label: "Carpintero / a", pattern: /carpinter/ },
  { slug: "albanil", label: "Albañil y construcción", pattern: /albanil|construccion|\bobra\b/ },
  { slug: "pintor", label: "Pintor / a", pattern: /pintor/ },
  {
    slug: "refrigeracion",
    label: "Refrigeración y clima",
    pattern: /refrigeracion|aire acondicionado|climatiza/,
  },
  { slug: "mantenimiento", label: "Mantenimiento", pattern: /mantenimiento/ },
  {
    slug: "operario",
    label: "Operario / a de producción",
    pattern: /operari|produccion|planta |manufactura/,
  },
  { slug: "control-calidad", label: "Control de calidad", pattern: /control de calidad|calidad/ },

  { slug: "peluquero", label: "Peluquería y barbería", pattern: /peluquer|barber|estilista/ },
  { slug: "estetica", label: "Estética", pattern: /estetic|cosmetolog|manicur|depilacion/ },
  { slug: "jardinero", label: "Jardinería", pattern: /jardiner|paisajis/ },
  {
    slug: "agro",
    label: "Agro y campo",
    pattern: /agronom|peon rural|tambo|agricol|ganader|forestal/,
  },

  { slug: "arquitecto", label: "Arquitectura", pattern: /arquitect/ },
  { slug: "ingeniero", label: "Ingeniería", pattern: /ingenier/ },
  { slug: "abogado", label: "Abogacía y notarial", pattern: /abogad|escriban|notarial|juridic/ },
  { slug: "psicologo", label: "Psicología", pattern: /psicolog|psicopedagog/ },
  { slug: "trabajo-social", label: "Trabajo social", pattern: /trabajador social|trabajo social/ },
  { slug: "veterinario", label: "Veterinaria", pattern: /veterinari/ },

  {
    slug: "pasante",
    label: "Pasantías",
    pattern: /pasante|pasantia|practicante|estudiante|becari|\bbeca\b/,
  },
  { slug: "supervisor", label: "Supervisor / a", pattern: /supervisor/ },
  {
    slug: "encargado",
    label: "Encargado / a",
    pattern: /encargad|responsable de|jefe|gerente|coordinador|lider|director/,
  },
  { slug: "analista", label: "Analista", pattern: /analista/ },
  { slug: "tecnico", label: "Técnico / a", pattern: /tecnic/ },
  {
    slug: "administrativo",
    label: "Administrativo / a",
    pattern: /administrativ|secretari|back ?office/,
  },
  { slug: "asistente", label: "Asistente", pattern: /asistente/ },
  { slug: "auxiliar", label: "Auxiliar", pattern: /auxiliar|\baux\b|ayudante|oficial/ },
];

const fold = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** The role a title names, or null when it names none of them. */
export function roleOf(title: string): Role | null {
  const needle = ` ${fold(title).replace(/[^a-z0-9/]+/g, " ")} `;
  return ROLES.find((role) => role.pattern.test(needle)) ?? null;
}
