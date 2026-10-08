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

  /* ---------- Habilidades y temas, por rubro ---------- */
  seed({
    kind: "topic",
    category: "ventas",
    title: "Resiliencia y seguimiento",
    body:
      "Vender es un trabajo de seguimiento: la mayoría de los «no» son tiempos, no rechazos. " +
      "Lo que se evalúa es si la persona insiste sin incomodar.",
    tags: ["habilidades blandas"],
  }),
  seed({
    kind: "topic",
    category: "atencion-cliente",
    title: "Empatía y calma",
    body:
      "Atender bien es sostener la calma cuando la otra persona no la tiene. Escuchar primero " +
      "y resolver después se nota en el tono.",
    tags: ["habilidades blandas"],
  }),
  seed({
    kind: "topic",
    category: "administracion",
    title: "Orden y confidencialidad",
    body:
      "Administración es la memoria de la empresa: plazos, registros y discreción. Lo que se " +
      "maneja es información que no es de uno.",
    tags: ["habilidades blandas"],
  }),
  seed({
    kind: "topic",
    category: "produccion",
    title: "Seguridad y método",
    body:
      "En planta se trabaja con protocolo: el atajo que ahorra minutos es el que causa el " +
      "accidente. Seguir el procedimiento es parte del oficio.",
    tags: ["habilidades blandas"],
  }),
  seed({
    kind: "topic",
    category: "contabilidad-finanzas",
    title: "Detalle y ética",
    body:
      "Un número mal cerrado se arrastra y contamina todo lo demás. La ética profesional —no " +
      "firmar algo que no se revisó— es parte del oficio.",
    tags: ["habilidades blandas"],
  }),
  seed({
    kind: "topic",
    category: "logistica",
    title: "Puntualidad y previsión",
    body:
      "La logística se mide en entregas cumplidas y en cómo se avisa un retraso. Anticipar el " +
      "problema vale más que justificarlo después.",
    tags: ["habilidades blandas"],
  }),

  /* ---------- Análisis e investigación ---------- */
  faq(
    "datos-analisis",
    "¿Qué diferencia hay entre un promedio y una mediana?",
    "El promedio se mueve con los valores extremos; la mediana deja la mitad de los datos de " +
      "cada lado. Poder decir cuál conviene según el caso muestra criterio, no memoria.",
    ["estadistica"],
  ),
  faq(
    "datos-analisis",
    "¿Cómo contás una historia con datos?",
    "Primero la pregunta, después el dato que la responde y al final la decisión que habilita. " +
      "Un gráfico sin pregunta es decoración.",
    ["comunicacion"],
  ),
  faq(
    "datos-analisis",
    "¿Qué revisás antes de confiar en un dataset?",
    "De dónde salió, cuántos valores faltan y cómo se midió. La mitad de los errores de un " +
      "análisis son de origen, no de cálculo.",
    ["calidad de datos"],
  ),
  seed({
    kind: "topic",
    category: "datos-analisis",
    title: "Datos y responsabilidad",
    body:
      "Correlación no es causalidad, y un dato con nombre propio es una persona. El análisis " +
      "se presenta agregado y sin exponer a nadie.",
    tags: ["habilidades blandas"],
  }),

  /* ---------- Marketing ---------- */
  faq(
    "marketing",
    "¿Cómo medís si una campaña funcionó?",
    "Contra un objetivo definido antes de arrancar: ventas, consultas o alcance. Sin línea " +
      "base, cualquier resultado se puede maquillar.",
    ["metricas"],
  ),
  faq(
    "marketing",
    "¿Qué diferencia hay entre alcance y conversión?",
    "El alcance dice cuánta gente vio; la conversión, cuánta hizo lo que querías. Un número " +
      "grande de alcance no paga las cuentas.",
    ["metricas"],
  ),
  faq(
    "marketing",
    "¿Cómo cambiás el mensaje sin cambiar el producto?",
    "Entendiendo a quién le hablás y qué problema le resolvés. El mismo producto se cuenta " +
      "distinto para públicos distintos.",
    ["contenido"],
  ),
  seed({
    kind: "topic",
    category: "marketing",
    title: "Contenido y comunidad",
    body:
      "Responder comentarios y sostener una voz clara vale más que publicar todos los días sin " +
      "rumbo.",
    tags: ["habilidades blandas"],
  }),

  /* ---------- Recursos humanos ---------- */
  faq(
    "rrhh",
    "¿Cómo evaluás a alguien sin discriminar?",
    "Con criterios del puesto definidos antes y las mismas preguntas para todos. Lo que no se " +
      "mide contra el aviso termina siendo una impresión personal.",
    ["seleccion"],
  ),
  faq(
    "rrhh",
    "¿Qué hacés ante un conflicto entre dos personas del equipo?",
    "Escuchar a cada uno por separado, separar el hecho de la interpretación y acordar un " +
      "próximo paso concreto. Tomar partido de entrada cierra la puerta.",
    ["conflictos"],
  ),
  faq(
    "rrhh",
    "¿Cómo cuidás los datos de los postulantes?",
    "Se usan solo para el proceso, se guardan donde corresponde y se borran cuando ya no hacen " +
      "falta. Es información sensible de gente que no trabaja ahí.",
    ["privacidad"],
  ),
  seed({
    kind: "topic",
    category: "rrhh",
    title: "Trato y confidencialidad",
    body:
      "Recursos humanos maneja lo más sensible de una empresa: sueldos, bajas y problemas " +
      "personales. La discreción es la base del puesto.",
    tags: ["habilidades blandas"],
  }),

  /* ---------- Educación ---------- */
  faq(
    "educacion",
    "¿Cómo explicás algo a alguien que no entiende?",
    "Con un ejemplo concreto antes que con la definición, y chequeando con una pregunta si se " +
      "entendió. Repetir más fuerte no enseña.",
    ["docencia"],
  ),
  faq(
    "educacion",
    "¿Cómo manejás un grupo con niveles muy distintos?",
    "Con tareas por nivel y el que ya sabe ayudando al que no. Enseñar a un compañero también " +
      "es una forma de aprender.",
    ["docencia"],
  ),
  faq(
    "educacion",
    "¿Qué hacés si un estudiante no quiere estar ahí?",
    "Buscar la causa antes de insistir con la misma estrategia; muchas veces el problema está " +
      "fuera del aula, no en el contenido.",
    ["docencia"],
  ),
  seed({
    kind: "topic",
    category: "educacion",
    title: "Paciencia y escucha",
    body: "Enseñar es sostener el proceso del otro, no lucirse. El ritmo lo marca quien aprende.",
    tags: ["habilidades blandas"],
  }),

  /* ---------- Salud ---------- */
  faq(
    "salud",
    "¿Cómo le das una noticia difícil a un paciente?",
    "Con claridad, sin tecnicismos, dejando lugar a preguntas y sin apurar el momento. La forma " +
      "importa tanto como el dato.",
    ["trato"],
  ),
  faq(
    "salud",
    "¿Cómo manejás la confidencialidad?",
    "Lo que se ve en el trabajo no sale del ámbito clínico, ni en un comentario ni en redes. " +
      "No hay excepciones por costumbre.",
    ["privacidad"],
  ),
  faq(
    "salud",
    "¿Qué hacés ante un error propio?",
    "Informarlo enseguida, priorizar al paciente y registrar qué pasó para que no se repita. " +
      "Ocultarlo es siempre peor.",
    ["responsabilidad"],
  ),
  seed({
    kind: "topic",
    category: "salud",
    title: "Cuidado y responsabilidad",
    body:
      "Es el rubro donde el error tiene costo humano: protocolo, registro y aviso a tiempo " +
      "valen más que la rapidez.",
    tags: ["habilidades blandas"],
  }),

  /* ---------- Oficios ---------- */
  faq(
    "oficios",
    "¿Cómo leés un plano o una orden de trabajo?",
    "Primero la medida general y después el detalle. Ante la duda se pregunta antes de cortar, " +
      "no después.",
    ["lectura de planos"],
  ),
  faq(
    "oficios",
    "¿Qué hacés con las normas de seguridad en obra?",
    "Se usan siempre, aunque el trabajo sea corto: el accidente pasa en el minuto en que se " +
      "salteó el protocolo.",
    ["seguridad"],
  ),
  faq(
    "oficios",
    "¿Cómo mantenés tus herramientas?",
    "Cada herramienta tiene su lugar y su revisión. Una falla en el equipo es un riesgo para " +
      "uno y para los demás.",
    ["herramientas"],
  ),
  seed({
    kind: "topic",
    category: "oficios",
    title: "Seguridad y prolijidad",
    body:
      "En oficios se evalúa la seguridad, el orden del puesto y el cuidado de la herramienta, " +
      "tanto como la técnica.",
    tags: ["habilidades blandas"],
  }),

  /* ---------- Ingeniería ---------- */
  faq(
    "ingenieria",
    "¿Cómo convertís un requisito en una solución?",
    "Entendiendo la restricción real —costo, plazo, norma— y proponiendo la opción más simple " +
      "que la cumpla. La solución complicada es fácil; la simple es el trabajo.",
    ["diseno"],
  ),
  faq(
    "ingenieria",
    "¿Qué hacés cuando un cálculo no cierra?",
    "Se revisan los supuestos antes que las cuentas: casi siempre el error está en lo que se " +
      "dio por sentado.",
    ["calculo"],
  ),
  faq(
    "ingenieria",
    "¿Cómo trabajás con otros equipos?",
    "Con documentación clara y revisiones previas. Una decisión no documentada es una decisión " +
      "que se pierde.",
    ["documentacion"],
  ),
  seed({
    kind: "topic",
    category: "ingenieria",
    title: "Criterio y documentación",
    body:
      "La ingeniería se juzga por decisiones defendibles y trazables, no por la elegancia del " +
      "cálculo.",
    tags: ["habilidades blandas"],
  }),

  /* ---------- Diseño ---------- */
  faq(
    "diseno",
    "¿Cómo defendés una decisión de diseño?",
    "Con el problema del usuario y la restricción, no con el gusto. «Me gusta» no es un " +
      "argumento; «esto le hace más fácil la tarea» sí.",
    ["criterio"],
  ),
  faq(
    "diseno",
    "¿Cómo tomás el feedback?",
    "Separando lo que es un problema real de lo que es una preferencia. Se pregunta el porqué " +
      "antes de cambiar algo.",
    ["feedback"],
  ),
  faq(
    "diseno",
    "¿Qué hacés cuando no hay tiempo para todo?",
    "Se prioriza lo que la persona necesita para completar la tarea y se deja lo accesorio para " +
      "después. Entregar lo esencial vale más que lo perfecto a medias.",
    ["prioridades"],
  ),
  seed({
    kind: "topic",
    category: "diseno",
    title: "Usuario y criterio",
    body:
      "Diseñar es resolver, no decorar: cada decisión se sostiene en un problema concreto de " +
      "quien usa.",
    tags: ["habilidades blandas"],
  }),
];
