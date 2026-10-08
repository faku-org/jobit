import { contentId, type ContentItem, type ContentKind, type ContentLevel } from "./types.ts";

/**
 * El contenido curado que arranca el sistema, versionado acá.
 *
 * La ingesta (ver `ingest.ts`) trae más desde las fuentes base, pero el seed es
 * lo que hace que la función ande desde el primer día y sin red: si el archivo
 * traído falta, la API sirve esto igual. Todo lo del seed es de elaboración
 * propia y no tiene `url` externa; cuando un ítem enlaza a algo ajeno, lleva su
 * fuente y su `sponsored` en vez de esconderlo.
 */

interface SeedInput {
  kind: ContentKind;
  category: string;
  title: string;
  body: string;
  tags?: string[];
  level?: ContentLevel;
}

const SEED_DATE = "2026-09-01";

function seed(input: SeedInput): ContentItem {
  return {
    id: contentId("jobit", null, input.title),
    kind: input.kind,
    title: input.title,
    body: input.body,
    url: null,
    source: "jobit",
    source_label: "JobIt",
    license: null,
    sponsored: false,
    categories: [input.category],
    roles: [],
    level: input.level ?? null,
    tags: input.tags ?? [],
    fetched_at: SEED_DATE,
  };
}

const faq = (category: string, title: string, body: string, tags: string[] = []): ContentItem =>
  seed({ kind: "faq", category, title, body, tags });

const exercise = (category: string, title: string, body: string): ContentItem =>
  seed({ kind: "exercise", category, title, body, tags: ["practica"] });

export const SEED_ITEMS: ContentItem[] = [
  /* ---------- Tecnología ---------- */
  faq(
    "tecnologia",
    "¿Qué es una API y para qué se usa?",
    "Una API es una forma de que dos programas se hablen sin conocer su código interno. " +
      "El que la expone define qué operaciones acepta y con qué formato responde; " +
      "el que la usa solo necesita conocer ese contrato. En una entrevista alcanza con " +
      "mencionar que separa responsabilidades y que permite cambiar un lado sin romper el otro.",
    ["api", "fundamentos"],
  ),
  faq(
    "tecnologia",
    "¿Cuál es la diferencia entre una variable y una constante?",
    "La variable guarda un valor que puede cambiar durante la ejecución; la constante, " +
      "uno que no debería. Decir que es una promesa para quien lee el código, más que una " +
      "restricción del lenguaje, muestra criterio.",
    ["fundamentos"],
  ),
  faq(
    "tecnologia",
    "¿Para qué sirve un control de versiones como Git?",
    "Registra la historia del proyecto: cada cambio queda con quién lo hizo y por qué, así " +
      "que se puede volver atrás, trabajar en paralelo y revisar antes de integrar. No es " +
      "un backup: es la memoria de las decisiones.",
    ["git", "herramientas"],
  ),
  faq(
    "tecnologia",
    "¿Cómo se prueba que un programa funciona?",
    "Con pruebas automáticas para lo que ya se sabe que tiene que pasar (los caminos " +
      "esperados y los bordes) y con pruebas manuales para lo nuevo y lo visual. Lo que " +
      "importa es que la prueba quede escrita: se corre sola la próxima vez.",
    ["testing", "calidad"],
  ),
  faq(
    "tecnologia",
    "¿Qué es una base de datos relacional?",
    "Una forma de guardar datos en tablas que se relacionan entre sí por claves, con reglas " +
      "que evitan inconsistencias. El lenguaje para consultarla es SQL. Conviene poder " +
      "nombrar un ejemplo simple: clientes y pedidos relacionados por el id del cliente.",
    ["bases de datos", "sql"],
  ),
  exercise(
    "tecnologia",
    "Invertir una cadena",
    "Escribí una función que reciba un texto y devuelva el mismo texto al revés, sin usar " +
      "un método que lo haga de una. Después pensá cómo cambia si el texto tiene acentos.",
  ),
  exercise(
    "tecnologia",
    "Contar palabras repetidas",
    "Dado un párrafo, devolvé cuántas veces aparece cada palabra. Ignorá mayúsculas y " +
      "signos. Es un ejercicio clásico porque obliga a elegir una estructura de datos.",
  ),
  exercise(
    "tecnologia",
    "Detectar un palíndromo",
    "Decidí si una frase se lee igual al derecho y al revés, ignorando espacios, " +
      "mayúsculas y acentos. Empezá por el caso simple y después agregá las reglas.",
  ),
  seed({
    kind: "topic",
    category: "tecnologia",
    title: "Trabajo en equipo y revisión de código",
    body:
      "En tecnología se trabaja sobre el código de otros: saber recibir una revisión sin " +
      "tomarla personal y pedir ayuda a tiempo pesa más que memorizar un lenguaje.",
    tags: ["habilidades blandas"],
  }),

  /* ---------- Ventas ---------- */
  faq(
    "ventas",
    "¿Cómo manejás a un cliente enojado?",
    "Primero escuchar sin interrumpir y dejar que se desahogue; después repetir el problema " +
      "con tus palabras para confirmar que entendiste; y recién ahí ofrecer una solución o " +
      "un camino concreto. La mayoría de los enojos bajan cuando alguien se siente escuchado.",
    ["clientes", "objeciones"],
  ),
  faq(
    "ventas",
    "El cliente duda del precio, ¿cómo seguís?",
    "No defiendas el número: volvé al problema que resuelve y a lo que incluye. Compará con " +
      "lo que le cuesta no resolverlo. Si el presupuesto no llega, ofrece una alternativa " +
      "más chica antes que perder el vínculo.",
    ["precio", "objeciones"],
  ),
  faq(
    "ventas",
    "¿Qué diferencia hay entre vender y asesorar?",
    "Vender empuja un producto; asesorar entiende qué necesita la persona y recién ahí " +
      "propone. La segunda vende más a la larga porque construye confianza y recomendación.",
    ["clientes"],
  ),
  faq(
    "ventas",
    "¿Cómo organizás tu cartera de clientes?",
    "Separando por etapa (interesado, cotizado, en negociación, cerrado) y por prioridad de " +
      "contacto. Lo importante es que exista un registro y no depender de la memoria.",
    ["organizacion", "crm"],
  ),
  exercise(
    "ventas",
    "Guion de venta en cinco pasos",
    "Armá un guion corto: apertura, pregunta para entender la necesidad, propuesta, manejo " +
      "de una objeción y cierre. Practicá el guion de memoria en no más de dos minutos.",
  ),
  exercise(
    "ventas",
    "Role-play: objeción de precio",
    "Junto a alguien (o frente al espejo), respondé tres veces «me parece caro» sin bajar el " +
      "precio en las dos primeras. Es el ejercicio que más rápido mejora el cierre.",
  ),

  /* ---------- Atención al cliente ---------- */
  faq(
    "atencion-cliente",
    "¿Qué hacés cuando no sabés la respuesta a una consulta?",
    "Decir la verdad y comprometerse con un plazo: «no lo tengo ahora, lo averiguo y te " +
      "confirmo antes de las cinco». Inventar una respuesta para salir del paso es lo único " +
      "que no se hace.",
    ["clientes"],
  ),
  faq(
    "atencion-cliente",
    "¿Cómo priorizás si hay cola y además suena el teléfono?",
    "Se atiende lo que ya está esperando presencialmente y se contesta el teléfono para " +
      "avisar que se lo llama enseguida; el que está delante ve que se lo tiene en cuenta. " +
      "Nombrar ese criterio vale más que decir «lo hago todo a la vez».",
    ["prioridades"],
  ),
  faq(
    "atencion-cliente",
    "¿Cómo respondés a un reclamo público en redes?",
    "En corto y sin discutir: se reconoce el problema, se pide el contacto por privado y se " +
      "resuelve ahí. El hilo público se contesta una vez; la discusión no.",
    ["redes", "reclamos"],
  ),
  exercise(
    "atencion-cliente",
    "El cliente insiste en algo que no está permitido",
    "Practicá la respuesta en tres partes: reconocer lo que pide, explicar el límite sin " +
      "culpar a nadie y ofrecer la mejor alternativa posible dentro de las reglas.",
  ),

  /* ---------- Administración ---------- */
  faq(
    "administracion",
    "¿Cómo organizás tareas con plazos que se cruzan?",
    "Listando todo con su fecha, marcando lo que depende de otros y avisando temprano si " +
      "algo no llega. Un tablero simple (o una planilla) rinde más que recordar de memoria.",
    ["organizacion", "plazos"],
  ),
  faq(
    "administracion",
    "Detectás un error en un documento que ya se envió, ¿qué hacés?",
    "Se avisa de inmediato a quien corresponda, se corrige y se explica qué pasó. Taparlo " +
      "es siempre peor; los errores se juzgan por cómo se resuelven.",
    ["responsabilidad"],
  ),
  faq(
    "administracion",
    "¿Cómo manejás información confidencial?",
    "Solo se comparte con quien tiene por qué verla, se guarda donde corresponde y no se " +
      "comenta fuera del trabajo. Es una de las preguntas donde importa más el criterio que " +
      "la técnica.",
    ["confidencialidad"],
  ),
  exercise(
    "administracion",
    "Armá un tablero de seguimiento",
    "Con cinco tareas de ejemplo, armá columnas de pendiente, en curso y terminado, con " +
      "responsable y fecha. Explicá en una frase cómo lo actualizarías cada día.",
  ),

  /* ---------- Producción ---------- */
  faq(
    "produccion",
    "¿Por qué importan las normas de seguridad e higiene?",
    "Porque evitan accidentes reales, no por trámite. En una entrevista conviene poder " +
      "nombrar dos o tres de tu puesto (protección, orden, señalización) y decir que se " +
      "avisa cualquier riesgo en vez de acostumbrarse.",
    ["seguridad"],
  ),
  faq(
    "produccion",
    "¿Cómo reportás un desperdicio en la línea?",
    "Lo primero es no esconderlo: se informa al responsable y se anota la causa para que no " +
      "se repita. Medir lo que se pierde es lo que permite mejorarlo.",
    ["calidad"],
  ),
  exercise(
    "produccion",
    "Calculá el tiempo estándar de una tarea",
    "Tomá una tarea simple, cronometrá cinco veces y sacá el promedio. Después sumá un " +
      "margen por descanso y explicá por qué no se usa el tiempo más rápido.",
  ),

  /* ---------- Contabilidad y finanzas ---------- */
  faq(
    "contabilidad-finanzas",
    "¿Cómo se cierra el mes?",
    "Conciliando los movimientos con los extractos, revisando cuentas por cobrar y por " +
      "pagar, y recién ahí armando el informe. El orden importa: sin conciliar, los números " +
      "no significan nada.",
    ["cierre", "conciliacion"],
  ),
  faq(
    "contabilidad-finanzas",
    "¿Qué revisás antes de presentar un balance?",
    "Que los saldos estén conciliados, que los asientos estén completos y que las " +
      "diferencias estén explicadas. Un balance con un ajuste sin justificar es un balance " +
      "que no se puede defender.",
    ["balance"],
  ),

  /* ---------- Logística ---------- */
  faq(
    "logistica",
    "¿Cómo organizás una ruta de entregas?",
    "Agrupando las paradas por zona y priorizando por horario comprometido y volumen, no " +
      "por cercanía sola. Y dejando un margen: una ruta sin margen se rompe con el primer " +
      "imprevisto.",
    ["rutas"],
  ),
  faq(
    "logistica",
    "Un envío no llega a tiempo, ¿qué hacés?",
    "Avisar antes de que el cliente pregunte, con una fecha nueva, y registrar la causa. La " +
      "demora se perdona; el silencio, no.",
    ["clientes"],
  ),

  /* ---------- Preguntas generales, para cualquier rubro ---------- */
  seed({
    kind: "faq",
    category: "otros",
    title: "¿Por qué te interesa este puesto?",
    body:
      "Contestá con algo específico de la empresa o del aviso, no con «necesito trabajar». " +
      "Una frase que muestre que leíste el aviso ya te separa de la mitad de las respuestas.",
    tags: ["general"],
  }),
  seed({
    kind: "faq",
    category: "otros",
    title: "¿Cuáles son tus expectativas salariales?",
    body:
      "Llevá un rango investigado para un puesto parecido en Uruguay, decilo con tranquilidad " +
      "y aclarando que es negociable según las tareas. «Lo que corresponda» deja la decisión " +
      "en el otro; un rango muestra que hiciste la tarea.",
    tags: ["general"],
  }),
  seed({
    kind: "faq",
    category: "otros",
    title: "Contame un problema que resolviste",
    body:
      "Elegí un caso real y contalo en tres partes: qué pasaba, qué hiciste vos y cómo " +
      "terminó. La entrevista busca cómo pensás, no que el problema sea épico.",
    tags: ["general"],
  }),
  seed({
    kind: "faq",
    category: "otros",
    title: "¿Por qué dejaste tu trabajo anterior?",
    body:
      "Una razón breve, cierta y sin hablar mal de nadie: buscar más responsabilidad, " +
      "cambiar de rubro, mudanza, estudiar. Las críticas al empleador anterior quedan mal " +
      "aunque sean ciertas.",
    tags: ["general"],
  }),
  seed({
    kind: "faq",
    category: "otros",
    title: "¿Tenés preguntas para nosotros?",
    body:
      "Siempre contestá que sí. Preguntá algo concreto del puesto, del equipo o de cómo se " +
      "mide el trabajo. Es la última impresión que dejás y muchas veces pesa.",
    tags: ["general"],
  }),
  seed({
    kind: "topic",
    category: "otros",
    title: "Puntualidad, presentación y trato",
    body:
      "Lo que más se evalúa en el primer empleo no es lo técnico: es llegar a horario, " +
      "avisar un imprevisto y tratar bien a compañeros y clientes. Eso se demuestra, no se " +
      "promete.",
    tags: ["habilidades blandas"],
  }),
];
