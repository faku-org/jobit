import { contentId, type ContentItem } from './types.ts'

/**
 * Las guías de entrevista por puesto (`/entrevista/<rubro>/<puesto>`).
 *
 * El seed por rubro (`seed.ts`) cubre lo que vale para todo un rubro; esto baja
 * un nivel: lo que se pregunta y se espera en un puesto concreto. Cada ítem lleva
 * `roles: [<slug de worker/src/roles.ts>]`, el mismo vocabulario del tablero, y
 * un solo rubro: la guía vive en una única URL, no duplicada por rubro.
 *
 * Qué hay y qué no hay acá: preguntas de entrevista y habilidades del oficio,
 * escritas a mano y sin cifras. No se afirma nada medido del mercado uruguayo
 * (sueldos, demanda); las pocas referencias locales son institucionales y
 * estables (BPS, DGI, IVA, carné de manipulación de alimentos). Las guías se
 * eligieron por cuántas ofertas tiene cada puesto en el tablero.
 */
export interface RoleGuide {
  /** Slug de `ROLES` (`worker/src/roles.ts`). */
  role: string
  /** El rubro bajo el que vive la guía (`worker/src/categories.ts`). */
  category: string
  /** Cómo se nombra el puesto en un título: «Cajero/a», no «Cajero / a». */
  name: string
  /** Qué se busca en la app para ver las ofertas de este puesto. */
  query: string
  /** [pregunta, respuesta sugerida, etiquetas]. */
  questions: [string, string, string[]?][]
  /** [habilidad o tema, por qué importa]. */
  topics: [string, string][]
}

export const ROLE_GUIDES: RoleGuide[] = [
  {
    role: 'vendedor',
    category: 'ventas',
    name: 'Vendedor/a',
    query: 'vendedor',
    questions: [
      [
        '¿Cómo te acercás a un cliente que entra al local y no dice nada?',
        'Con un saludo breve y una pregunta abierta, sin empujar: «¿buscás algo en particular o querés mirar tranquilo?». Después le das espacio y estás cerca cuando te necesite. Pegarse al cliente desde el primer segundo suele espantarlo.',
        ['clientes'],
      ],
      [
        'Un cliente dice «lo voy a pensar». ¿Qué hacés?',
        'Preguntás qué le falta para decidir, porque casi siempre hay una duda que no se dijo: precio, plazo, comparación. Si no hay venta hoy, dejás una puerta abierta: anotás su contacto con permiso o le ofrecés guardarle el producto.',
        ['objeciones', 'cierre'],
      ],
      [
        '¿Cómo trabajás con una meta mensual?',
        'Conociendo el número y dividiéndolo en semanas, para saber a mitad de mes si vas bien. Lo que se busca en la respuesta es orden y constancia, no «hago todo lo posible».',
        ['metas'],
      ],
      [
        '¿Qué hacés si no tenés en stock lo que pide el cliente?',
        'Decirlo de entrada, ofrecer la alternativa más parecida y explicar en qué se diferencia, o consultar si se puede pedir. Prometer una fecha que no controlás es lo único que no se hace.',
        ['stock', 'honestidad'],
      ],
      [
        '¿Cómo manejás una venta que se cayó?',
        'Entendiendo el motivo sin discutirlo y anotándolo: es información sobre el producto, el precio o tu forma de presentarlo. Una venta perdida bien analizada vale para la próxima.',
        ['resiliencia'],
      ],
    ],
    topics: [
      [
        'Conocimiento del producto',
        'Quien vende sabe qué tiene, para quién sirve y en qué se diferencia de lo parecido. Es lo primero que se nota en el mostrador.',
      ],
      [
        'Escucha y no insistir',
        'Vender bien es entender qué necesita la persona y proponer eso. La insistencia sin escucha baja la venta y el vínculo.',
      ],
    ],
  },
  {
    role: 'cajero',
    category: 'ventas',
    name: 'Cajero/a',
    query: 'cajero',
    questions: [
      [
        '¿Qué hacés si al cerrar la caja te falta o te sobra dinero?',
        'Se vuelve a contar con calma, se revisan los últimos movimientos y los comprobantes, y si la diferencia sigue, se informa de inmediato al responsable. Nunca se tapa ni se compensa con plata propia: se registra y se avisa.',
        ['arqueo', 'honestidad'],
      ],
      [
        'Hay cola larga y un cliente tiene un problema con su compra. ¿Cómo seguís?',
        'Resolver lo rápido y derivar lo lento: le pedís un momento, atendés a los que esperan y pedís apoyo a un compañero o al encargado para el caso complicado. Así nadie queda esperando por uno solo.',
        ['prioridades', 'clientes'],
      ],
      [
        '¿Cómo detectás un billete dudoso?',
        'Mirando y tocando las marcas de seguridad que tiene el billete, sin acusar a nadie. Si hay duda, se lo explicás con respeto al cliente, pedís otro medio de pago y avisás al responsable según el protocolo del comercio.',
        ['efectivo', 'seguridad'],
      ],
      [
        'Un cliente pide un descuento que no existe. ¿Qué hacés?',
        'Explicar con amabilidad que el precio es el de la lista y que no tenés autorización para cambiarlo; si el cliente insiste, derivar al encargado. No hacés excepciones por tu cuenta.',
        ['clientes', 'reglas'],
      ],
      [
        '¿Cómo te mantenés atento en una tarea muy repetitiva?',
        'Con un orden fijo para cada cobro (escanear, revisar, cobrar, entregar el comprobante) y mirando a la persona, no solo la pantalla. La rutina ordenada es lo que evita errores.',
        ['atencion'],
      ],
    ],
    topics: [
      [
        'Precisión con el dinero',
        'En caja el error se paga: contar bien, devolver el vuelto correcto y cuidar el comprobante son parte del puesto.',
      ],
      [
        'Trato en horas pico',
        'Se evalúa cómo tratás a la persona número cuarenta del día igual que a la primera. La calma sostenida es la habilidad central.',
      ],
    ],
  },
  {
    role: 'atencion-cliente',
    category: 'atencion-cliente',
    name: 'Atención al cliente',
    query: 'atención al cliente',
    questions: [
      [
        'Un cliente te grita por un error que no es tuyo. ¿Qué hacés?',
        'No lo tomás personal: lo dejás hablar, reconocés el problema («entiendo que es molesto») y pasás a lo que sí podés hacer. Pedir disculpas por la situación no es aceptar la culpa, es empezar a resolver.',
        ['reclamos', 'calma'],
      ],
      [
        '¿Cómo explicás algo técnico a alguien que no entiende?',
        'Con palabras de todos los días, un ejemplo y una pregunta para confirmar que se entendió. Si hace falta, lo repetís distinto, sin dar a entender que el cliente «no entiende».',
        ['comunicacion'],
      ],
      [
        '¿Qué diferencia hay entre resolver un reclamo y dejar conforme al cliente?',
        'A veces no se puede darle lo que pide, pero sí tratarlo bien, explicarle el porqué y ofrecerle lo posible. Un «no» bien explicado deja mejor imagen que un «sí» a medias.',
        ['clientes'],
      ],
      [
        '¿Cómo registrás lo que pasa con cada consulta?',
        'Anotando quién llamó, qué pidió y qué quedó acordado, en el sistema o la planilla del lugar. Lo que no queda escrito se pierde cuando atiende otra persona.',
        ['registro', 'organizacion'],
      ],
      [
        'Tenés varios casos abiertos al mismo tiempo. ¿Cómo priorizás?',
        'Por urgencia e impacto: primero lo que tiene fecha límite o afecta a más gente, y a cada cliente le avisás cuándo vas a volver. Cerrar seguimientos es parte del trabajo.',
        ['prioridades'],
      ],
    ],
    topics: [
      [
        'Empatía y claridad',
        'Escuchar primero, hablar claro después. El tono pesa tanto como la solución.',
      ],
      [
        'Registro y seguimiento',
        'Un cliente bien atendido es uno al que no hay que preguntarle dos veces lo mismo. El seguimiento ordenado lo hace posible.',
      ],
    ],
  },
  {
    role: 'recepcionista',
    category: 'atencion-cliente',
    name: 'Recepcionista',
    query: 'recepcionista',
    questions: [
      [
        'Llega una visita sin cita y la persona que busca no está. ¿Qué hacés?',
        'Recibís a la visita con amabilidad, preguntás quién es y para qué viene, consultás si la persona puede atenderla o cuándo vuelve, y ofrecés tomar un mensaje o coordinar otro horario. Nadie se queda parado en la puerta.',
        ['visitas'],
      ],
      [
        'Suena el teléfono, hay alguien en el mostrador y entra un mensajero. ¿Cómo organizás?',
        'Saludás a todos con la mirada, atendés a quien está en persona y al teléfono le pedís un momento o le ofrecés devolver la llamada. Nombrar el criterio muestra que sabés sostener varias cosas.',
        ['prioridades'],
      ],
      [
        '¿Cómo manejás información que no podés dar?',
        'Con una frase amable y firme: «eso no lo puedo informar, pero le paso su mensaje a la persona indicada». No das datos de otros ni siquiera para ser simpática.',
        ['confidencialidad'],
      ],
      [
        '¿Qué hacés si hay una persona molesta esperando hace rato?',
        'Reconocer la espera, avisarle cuánto falta si lo sabés y ofrecerle algo (agua, un lugar para sentarse). La espera sin información es lo que enoja.',
        ['clientes'],
      ],
      [
        '¿Cómo llevás la agenda y los recados?',
        'Con un registro único y claro, a la vista, y repasándolo al empezar y terminar el día. Todo mensaje se anota con nombre, motivo y a quién va.',
        ['organizacion'],
      ],
    ],
    topics: [
      [
        'Presencia y primera impresión',
        'La recepción es la cara de la empresa: la forma de saludar y de presentarse se evalúa desde la entrada a la entrevista.',
      ],
      [
        'Discreción',
        'Se ve y se escucha mucho. No comentar lo que pasa dentro de la oficina es parte del puesto.',
      ],
    ],
  },
  {
    role: 'administrativo',
    category: 'administracion',
    name: 'Administrativo/a',
    query: 'administrativo',
    questions: [
      [
        '¿Cómo organizás tu día cuando todo parece urgente?',
        'Listando las tareas con su fecha límite, separando lo que bloquea a otros de lo que puede esperar, y avisando temprano si algo no llega. Pedir aclaración sobre qué es prioridad también es una respuesta válida.',
        ['organizacion', 'prioridades'],
      ],
      [
        '¿Qué herramientas de oficina manejás y cómo las usás?',
        'Nombrá las que realmente usás (planilla de cálculo, procesador de texto, correo, el sistema de gestión que hayas visto) y contá un uso concreto: una tabla con fórmulas, una base de proveedores, un seguimiento de pedidos.',
        ['herramientas'],
      ],
      [
        'Encontrás un error en un documento que ya se envió. ¿Qué hacés?',
        'Avisás enseguida a quien corresponda, corregís y mandás la versión correcta explicando qué cambió. Los errores se juzgan por cómo se resuelven.',
        ['responsabilidad'],
      ],
      [
        '¿Cómo archivás documentos para encontrarlos después?',
        'Con un criterio fijo (fecha, cliente o tipo), nombres de archivo claros y una sola copia vigente. Si otra persona tiene que encontrar un papel sin preguntarte, el archivo funciona.',
        ['orden'],
      ],
      [
        '¿Qué hacés si te piden algo que no es tu función?',
        'Si es puntual y razonable, lo hacés; si se vuelve costumbre, lo conversás con tu responsable para ordenar tareas. Mostrar flexibilidad sin dejar que el puesto se desdibuje.',
        ['trabajo en equipo'],
      ],
    ],
    topics: [
      [
        'Orden y seguimiento',
        'El puesto sostiene la memoria de la empresa: plazos, registros, pendientes. Se valora quien no deja nada sin cerrar.',
      ],
      [
        'Confidencialidad',
        'Se maneja información de la empresa y de las personas. La discreción es condición, no mérito extra.',
      ],
    ],
  },
  {
    role: 'administrativo-contable',
    category: 'contabilidad-finanzas',
    name: 'Administrativo/a contable',
    query: 'administrativo contable',
    questions: [
      [
        '¿Qué tareas hacés en un día típico de contabilidad?',
        'Contá lo que hayas hecho de verdad: ingresar facturas de compra y venta, conciliar movimientos bancarios, controlar cuentas por cobrar y por pagar, preparar la documentación para el contador. Si es tu primer puesto, hablá de lo que aprendiste en el curso o la práctica.',
        ['tareas'],
      ],
      [
        '¿Qué es una conciliación bancaria y para qué sirve?',
        'Es comparar lo que dice el extracto del banco con lo que está registrado en la empresa, para encontrar y explicar las diferencias (cheques sin cobrar, débitos no registrados). Sirve para saber que los saldos son reales.',
        ['conciliacion'],
      ],
      [
        '¿Cómo controlás que una factura esté bien antes de registrarla?',
        'Revisando que tenga los datos del emisor y del receptor, que los importes y el IVA cierren, que corresponda a algo recibido o contratado y que no esté repetida. Lo dudoso se consulta antes de ingresarlo.',
        ['control', 'facturas'],
      ],
      [
        '¿Qué hacés si encontrás una diferencia que no podés explicar?',
        'No la tapás ni la reacomodás: la documentás con el detalle de lo que revisaste y la elevás al contador o responsable. Una diferencia explicada o escalada a tiempo es mejor que una escondida.',
        ['etica'],
      ],
      [
        '¿Con qué plazos y obligaciones trabajaste?',
        'Si los conocés, nombrá los reales: aportes al BPS, declaraciones ante la DGI, el IVA. Si no, decí con honestidad qué sabés y cuánto te llevaría ponerte al día.',
        ['obligaciones'],
      ],
    ],
    topics: [
      [
        'Precisión y orden',
        'Un número mal registrado se arrastra hasta el balance. Se valora el cuidado más que la velocidad.',
      ],
      [
        'Ética y reserva',
        'Se maneja información económica de la empresa. No firmar ni registrar lo que no se revisó es parte del oficio.',
      ],
    ],
  },
  {
    role: 'contador',
    category: 'contabilidad-finanzas',
    name: 'Contador/a',
    query: 'contador',
    questions: [
      [
        '¿Cómo se prepara un cierre de ejercicio?',
        'Conciliando cuentas, revisando inventarios, devengando lo que corresponda, ajustando lo que haya que ajustar y recién ahí armando los estados contables. El orden de los pasos y la documentación de cada ajuste es lo que se evalúa.',
        ['cierre', 'balance'],
      ],
      [
        '¿Con qué impuestos y organismos trabajaste?',
        'Nombrá lo que realmente manejaste: IVA, IRAE o IRPF según el caso, aportes al BPS, presentaciones ante la DGI. Aclarar qué hiciste vos y qué hizo el equipo da más credibilidad que decir que «lo manejás todo».',
        ['impuestos'],
      ],
      [
        'Un cliente te pide que registres algo de forma irregular. ¿Qué hacés?',
        'Se niega con claridad y explica por qué: el contador responde con su firma. Ofrecés la alternativa correcta dentro de la norma. Esta pregunta busca criterio profesional, no una respuesta técnica.',
        ['etica'],
      ],
      [
        '¿Cómo le explicás un balance a alguien que no sabe de contabilidad?',
        'Partiendo de tres preguntas simples: qué tiene la empresa, qué debe y cuánto ganó. Con un ejemplo concreto de su propio negocio se entiende mejor que con cualquier definición.',
        ['comunicacion'],
      ],
      [
        '¿Qué software contable manejás?',
        'Nombrá los que usaste de verdad y para qué. Si no conocés el del aviso, decí qué parecido manejaste y cuánto tardaste en aprender el último.',
        ['herramientas'],
      ],
    ],
    topics: [
      [
        'Criterio y responsabilidad',
        'La firma de un contador compromete. Se evalúa si sabés decir que no y fundamentarlo.',
      ],
      [
        'Actualización permanente',
        'Las normas cambian. Saber dónde te informás y cómo te mantenés al día importa tanto como lo que ya sabés.',
      ],
    ],
  },
  {
    role: 'deposito',
    category: 'logistica',
    name: 'Auxiliar de depósito',
    query: 'depósito',
    questions: [
      [
        '¿Cómo controlás que lo que recibís coincide con lo que dice el remito?',
        'Contás y revisás lo que llega contra el documento antes de firmar, mirás el estado de los bultos y anotás cualquier diferencia o daño en el momento. Después de firmar ya no se reclama.',
        ['recepcion', 'control'],
      ],
      [
        '¿Qué hacés si encontrás mercadería dañada?',
        'La separás, la identificás para que nadie la despache, la registrás y avisás al responsable. No se oculta ni se manda igual.',
        ['calidad'],
      ],
      [
        '¿Cómo armás un pedido sin errores?',
        'Siguiendo el orden de la lista, verificando código y cantidad al tomar cada producto y revisando el pedido completo antes de cerrarlo. La velocidad viene del método, no de apurarse.',
        ['picking'],
      ],
      [
        '¿Qué normas de seguridad seguís en un depósito?',
        'Calzado y protección, no cargar más de lo seguro, respetar la señalización y los pasillos, y no usar un equipo (como un autoelevador) sin la habilitación correspondiente. Cualquier riesgo se avisa.',
        ['seguridad'],
      ],
      [
        '¿Cómo mantenés el orden en el depósito?',
        'Cada cosa en su lugar identificado, lo que se usa más a mano y los pasillos libres. Un depósito ordenado es uno donde cualquiera encuentra algo sin preguntar.',
        ['orden'],
      ],
    ],
    topics: [
      [
        'Atención al detalle',
        'Un código o una cantidad mal leída llega al cliente. El control paso a paso es lo que se mide.',
      ],
      [
        'Seguridad física',
        'En depósito se trabaja con peso y con equipos. Cumplir las normas es parte del puesto, no un trámite.',
      ],
    ],
  },
  {
    role: 'chofer',
    category: 'logistica',
    name: 'Chofer / repartidor',
    query: 'chofer',
    questions: [
      [
        '¿Cómo planificás una ruta de entregas?',
        'Agrupando paradas por zona, respetando los horarios comprometidos y dejando un margen para imprevistos. Una ruta sin margen se rompe con el primer problema.',
        ['rutas'],
      ],
      [
        'Llegás y el cliente no está. ¿Qué hacés?',
        'Intentás contactarlo por los medios que tenés, esperás un tiempo razonable según el protocolo de la empresa, registrás el intento y avisás al responsable para reprogramar. No dejás la mercadería sin autorización.',
        ['entregas', 'clientes'],
      ],
      [
        '¿Qué revisás del vehículo antes de salir?',
        'Neumáticos, luces, frenos, niveles, documentación y que la carga esté bien asegurada. Un chequeo corto cada día evita los problemas en ruta.',
        ['vehiculo', 'seguridad'],
      ],
      [
        '¿Qué hacés si surge un imprevisto y vas a llegar tarde?',
        'Avisar antes de que el cliente pregunte, con una hora estimada nueva, y dejar registro de la causa. La demora se perdona; el silencio, no.',
        ['comunicacion'],
      ],
      [
        '¿Cómo cuidás la mercadería durante el trayecto?',
        'Estibando bien, sin superar la capacidad del vehículo, cuidando el frío o la fragilidad si corresponde y manejando con suavidad. La carga que llega dañada es una entrega fallida.',
        ['carga'],
      ],
    ],
    topics: [
      [
        'Conducción responsable',
        'El respeto a las normas de tránsito y la libreta de conducir de la categoría que pide el aviso son condición de entrada; la forma de manejar se evalúa.',
      ],
      [
        'Trato con el cliente',
        'El chofer o repartidor es la cara de la empresa en la puerta. La puntualidad y el trato valen tanto como la ruta.',
      ],
    ],
  },
  {
    role: 'operario',
    category: 'produccion',
    name: 'Operario/a de producción',
    query: 'operario',
    questions: [
      [
        '¿Por qué importan las normas de seguridad en planta?',
        'Porque evitan accidentes reales, no por trámite. Conviene poder nombrar dos o tres del puesto (protección, orden, señalización) y decir que cualquier riesgo se avisa en vez de acostumbrarse.',
        ['seguridad'],
      ],
      [
        '¿Cómo trabajás en una línea donde cada uno depende del otro?',
        'Cumpliendo tu tramo con calidad y avisando cuando algo viene mal desde atrás o te vas a atrasar. La línea es tan rápida como su eslabón más lento.',
        ['trabajo en equipo'],
      ],
      [
        'Detectás una pieza defectuosa. ¿Qué hacés?',
        'La separás, avisás al responsable y registrás qué pasó para que no se repita. Dejarla pasar «por si acaso» multiplica el problema.',
        ['calidad'],
      ],
      [
        '¿Cómo te adaptás a trabajar en turnos o con tareas repetitivas?',
        'Con rutinas de descanso y alimentación, atención a los momentos de baja concentración y consultando cuando una tarea cambia. La respuesta honesta sobre tus horarios vale más que prometer disponibilidad total.',
        ['turnos'],
      ],
      [
        '¿Qué hacés si una máquina hace un ruido raro o falla?',
        'La detenés si es seguro, avisás al responsable o a mantenimiento y no intentás repararla si no es tu tarea. Un equipo mal tocado es un riesgo para todos.',
        ['maquinas'],
      ],
    ],
    topics: [
      [
        'Método y constancia',
        'Seguir el procedimiento todos los días, sin atajos, es lo que mantiene la calidad y evita accidentes.',
      ],
      [
        'Disposición para aprender',
        'En planta se aprende el puesto trabajando. Mostrar ganas de aprender y preguntar a tiempo se valora mucho.',
      ],
    ],
  },
  {
    role: 'cocinero',
    category: 'produccion',
    name: 'Cocinero/a',
    query: 'cocinero',
    questions: [
      [
        '¿Cómo te organizás antes de un servicio de mucha gente?',
        'Con la mise en place: tener todo cortado, medido y a mano antes de que empiece el servicio, ordenando las preparaciones por tiempo. Quien llega al servicio sin eso termina improvisando.',
        ['organizacion', 'servicio'],
      ],
      [
        '¿Qué medidas de higiene y manipulación de alimentos aplicás?',
        'Lavado de manos frecuente, separar crudo de cocido, respetar la cadena de frío y las temperaturas, y mantener limpias las superficies. En Uruguay se pide el carné de manipulación de alimentos, así que conviene tenerlo al día.',
        ['higiene', 'seguridad'],
      ],
      [
        'Se acaba un ingrediente a mitad del servicio. ¿Qué hacés?',
        'Avisás de inmediato al jefe de cocina y al salón, proponés una alternativa o retirás el plato del menú por esa noche. Sorprender al cliente con un faltante es peor que anunciarlo.',
        ['imprevistos'],
      ],
      [
        '¿Cómo evitás el desperdicio?',
        'Controlando cantidades, usando primero lo que vence antes, aprovechando recortes y sobrantes en otras preparaciones y anotando lo que se tira. Medir el desperdicio es lo que permite bajarlo.',
        ['costos'],
      ],
      [
        '¿Cómo trabajás con otros en una cocina con presión?',
        'Comunicando claro y corto («atrás», «caliente», «¿listo?»), sin discutir en servicio y dejando las diferencias para después. La presión se sostiene entre todos.',
        ['trabajo en equipo'],
      ],
    ],
    topics: [
      [
        'Higiene y seguridad',
        'Se evalúa antes que la técnica: la manipulación segura de alimentos y el orden del puesto son condición.',
      ],
      [
        'Resistencia y trabajo en equipo',
        'La cocina es calor, ritmo y presión. Se busca gente que sostiene el ritmo sin perder el trato.',
      ],
    ],
  },
  {
    role: 'mecanico',
    category: 'oficios',
    name: 'Mecánico/a',
    query: 'mecánico',
    questions: [
      [
        '¿Cómo diagnosticás una falla que el cliente describe mal?',
        'Escuchando los síntomas (cuándo pasa, con qué ruido, desde cuándo), reproduciéndolos cuando se puede y recién ahí revisando por descarte. Cambiar piezas «a ver si anda» sale caro y no es un diagnóstico.',
        ['diagnostico'],
      ],
      [
        '¿Qué hacés cuando no sabés cómo reparar algo?',
        'Consultás el manual o a un compañero con más experiencia antes de tocar. Decir «no lo sé» y averiguarlo es mejor que improvisar sobre el vehículo o la máquina de otro.',
        ['aprender'],
      ],
      [
        '¿Cómo explicás una reparación a un cliente que no sabe de mecánica?',
        'Con palabras simples, mostrando la pieza dañada si se puede, y separando lo urgente de lo que puede esperar. Presupuestar con transparencia genera confianza.',
        ['clientes', 'presupuesto'],
      ],
      [
        '¿Qué normas de seguridad seguís en el taller?',
        'Protección personal, vehículo bien apoyado antes de trabajar debajo, cuidado con líquidos y herramientas eléctricas, y orden en el puesto. Un taller ordenado es un taller más seguro.',
        ['seguridad'],
      ],
      [
        '¿Cómo cuidás las herramientas y los equipos?',
        'Cada una vuelve a su lugar limpia y revisada. Una herramienta en mal estado es un riesgo y una reparación mal hecha.',
        ['herramientas'],
      ],
    ],
    topics: [
      [
        'Diagnóstico y método',
        'El oficio se juzga por cómo encontrás la causa, no solo por cómo cambiás la pieza.',
      ],
      [
        'Honestidad con el cliente',
        'No inventar arreglos que no hacen falta. La reputación de un taller se construye con presupuestos claros.',
      ],
    ],
  },
  {
    role: 'electricista',
    category: 'oficios',
    name: 'Electricista',
    query: 'electricista',
    questions: [
      [
        '¿Qué hacés antes de intervenir una instalación?',
        'Cortás la energía en el tablero, verificás que no hay tensión con un instrumento, señalizás para que nadie la reponga y recién ahí trabajás. Confiar en que «está cortada» sin medir es de los errores más peligrosos.',
        ['seguridad'],
      ],
      [
        '¿Cómo leés un plano o un esquema eléctrico?',
        'Identificando primero el tablero y los circuitos, y siguiendo cada uno hasta su carga. Ante cualquier duda se pregunta antes de cortar o cablear.',
        ['planos'],
      ],
      [
        'Una instalación vieja no cumple lo que se necesita. ¿Qué proponés?',
        'Evaluar qué se puede mantener y qué hay que cambiar por seguridad, explicarlo con claridad al cliente y presupuestar la opción segura aunque sea más cara. No se hace un parche que deje un riesgo.',
        ['criterio', 'clientes'],
      ],
      [
        '¿Qué herramientas e instrumentos usás y cómo los cuidás?',
        'Nombrá los reales: tester o multímetro, pinzas, destornilladores aislados, detector de tensión. Aislados y en buen estado son parte de la seguridad personal.',
        ['herramientas'],
      ],
      [
        '¿Cómo trabajás con otros oficios en una obra?',
        'Coordinando tiempos y pasadas de cañería o cableado con albañilería, sanitaria y pintura, y dejando el trabajo prolijo y rotulado. Una instalación que otro electricista puede entender es parte del trabajo.',
        ['obra', 'orden'],
      ],
    ],
    topics: [
      [
        'Seguridad ante todo',
        'En electricidad el error no se corrige: se evalúa si trabajás con protocolo, sin atajos y cuidando a otros.',
      ],
      [
        'Prolijidad y rotulado',
        'Una instalación ordenada y rotulada se mantiene y se repara. Es lo que distingue a un buen profesional.',
      ],
    ],
  },
  {
    role: 'docente',
    category: 'educacion',
    name: 'Docente',
    query: 'docente',
    questions: [
      [
        '¿Cómo planificás una clase?',
        'Empezando por qué debe poder hacer el grupo al terminar, eligiendo la actividad para llegar a eso y dejando un cierre para chequear si se logró. Un buen plan es flexible: se ajusta con lo que pasa en el aula.',
        ['planificacion'],
      ],
      [
        '¿Cómo manejás a un estudiante que interrumpe constantemente?',
        'Primero entendiendo qué lo mueve (aburrimiento, falta de atención, dificultades), luego dándole una tarea con sentido y, si sigue, hablando a solas con calma. Evitar la confrontación frente al grupo.',
        ['clase', 'convivencia'],
      ],
      [
        '¿Cómo evaluás si tus estudiantes aprendieron?',
        'Con distintas formas, no una sola: preguntas en clase, tareas, producciones, pruebas. Y usando el resultado para ajustar tu enseñanza, no solo para poner una nota.',
        ['evaluacion'],
      ],
      [
        '¿Cómo te comunicás con las familias?',
        'Con claridad y respeto, contando lo que pasa y lo que se puede hacer juntos, y no solo cuando hay un problema. Registrar lo hablado ayuda a todos.',
        ['familias'],
      ],
      [
        '¿Cómo atendés a un grupo con niveles muy distintos?',
        'Con consignas abiertas que cada uno resuelve a su nivel, tareas por grupos y el que ya sabe ayudando al que no. Enseñar a otro también es aprender.',
        ['diversidad'],
      ],
    ],
    topics: [
      [
        'Paciencia y escucha',
        'Enseñar es sostener el proceso del otro. El ritmo lo marca quien aprende.',
      ],
      [
        'Planificación y flexibilidad',
        'Se evalúa si llegás con un plan y si sabés cambiarlo cuando el grupo lo pide.',
      ],
    ],
  },
  {
    role: 'enfermeria',
    category: 'salud',
    name: 'Enfermería',
    query: 'enfermería',
    questions: [
      [
        '¿Cómo priorizás cuando varios pacientes te necesitan a la vez?',
        'Por gravedad e inmediatez: primero el que corre riesgo, después lo programado, y avisando al resto que vas a volver. Pedir ayuda al equipo cuando la carga se desborda es parte del criterio.',
        ['prioridades'],
      ],
      [
        '¿Qué hacés ante un error en la administración de una medicación?',
        'Priorizás al paciente, avisás de inmediato al médico y al responsable, seguís el protocolo de la institución y lo registrás tal cual pasó. Ocultar un error es siempre peor.',
        ['errores', 'responsabilidad'],
      ],
      [
        '¿Cómo tratás a un paciente o familiar angustiado o agresivo?',
        'Con calma, sin tomarlo personal, escuchando su preocupación y explicando con palabras simples lo que se está haciendo. Si la situación escala, pedís apoyo al equipo.',
        ['trato', 'calma'],
      ],
      [
        '¿Cómo aplicás las medidas de bioseguridad?',
        'Higiene de manos en los momentos que corresponde, uso del equipo de protección, manejo correcto de material cortante y de residuos. Se aplican siempre, no solo cuando alguien mira.',
        ['bioseguridad'],
      ],
      [
        '¿Cómo registrás lo que hacés con cada paciente?',
        'En el momento, con claridad y en la historia clínica o el registro de la institución. Lo que no está registrado, para el equipo que viene después, no pasó.',
        ['registro'],
      ],
    ],
    topics: [
      [
        'Cuidado y responsabilidad',
        'Es un puesto donde el error tiene costo humano: protocolo, registro y aviso a tiempo valen más que la rapidez.',
      ],
      [
        'Confidencialidad y trato',
        'Lo que se ve en el trabajo no sale del ámbito clínico. El trato respetuoso a pacientes y familias es parte de la tarea.',
      ],
    ],
  },
  {
    role: 'desarrollador',
    category: 'tecnologia',
    name: 'Desarrollador/a',
    query: 'desarrollador',
    questions: [
      [
        'Contame un proyecto que hayas construido y qué decisiones tomaste.',
        'Elegí uno real, explicá el problema, qué alternativas viste y por qué elegiste una. Lo que se evalúa es tu razonamiento, no que el proyecto sea grande. Si fue en equipo, aclará qué hiciste vos.',
        ['proyectos'],
      ],
      [
        '¿Cómo encarás un bug que no entendés?',
        'Primero reproducirlo de forma confiable, después acotar dónde ocurre (logs, prints, un depurador, deshabilitar partes) y recién ahí hipotetizar y probar. Cambiar cosas al azar no es depurar.',
        ['debug'],
      ],
      [
        '¿Cómo te asegurás de que tu código funciona?',
        'Con pruebas automáticas para los caminos esperados y los bordes, y revisando a mano lo nuevo y lo visual. Que la prueba quede escrita es lo que importa: se corre sola la próxima vez.',
        ['testing'],
      ],
      [
        '¿Qué hacés cuando recibís una revisión de código con la que no estás de acuerdo?',
        'Escuchás el argumento, preguntás el porqué y respondés con el tuyo, sin tomarlo personal. Si hay desacuerdo de fondo, lo llevás a conversar con quien corresponda.',
        ['trabajo en equipo'],
      ],
      [
        '¿Cómo aprendés una tecnología nueva?',
        'Con la documentación oficial y un proyecto chico donde aplicarla. Contá un ejemplo reciente y cuánto tardaste: es más convincente que decir que «aprendés rápido».',
        ['aprendizaje'],
      ],
    ],
    topics: [
      [
        'Fundamentos antes que herramientas',
        'Los lenguajes y librerías cambian. Entender estructuras de datos, HTTP, bases de datos y control de versiones es lo que perdura.',
      ],
      [
        'Comunicación y trabajo en equipo',
        'Se trabaja sobre el código de otros. Explicar una decisión, pedir ayuda a tiempo y documentar pesa tanto como programar.',
      ],
    ],
  },
]

const guideItem = (
  guide: RoleGuide,
  kind: 'faq' | 'topic',
  title: string,
  body: string,
  tags: string[],
): ContentItem => ({
  /** El id lleva el puesto: la misma pregunta puede repetirse entre puestos
   * (y con el seed por rubro) sin pisarse al mezclar por id. */
  id: contentId('jobit', `guia/${guide.role}/${kind}/${title}`, title),
  kind,
  title,
  body,
  url: null,
  source: 'jobit',
  source_label: 'JobIt',
  license: null,
  sponsored: false,
  categories: [guide.category],
  roles: [guide.role],
  level: null,
  tags,
  fetched_at: '2026-11-05',
})

export const ROLE_GUIDE_ITEMS: ContentItem[] = ROLE_GUIDES.flatMap((guide) => [
  ...guide.questions.map(([title, body, tags]) =>
    guideItem(guide, 'faq', title, body, tags ?? []),
  ),
  ...guide.topics.map(([title, body]) =>
    guideItem(guide, 'topic', title, body, ['habilidades']),
  ),
])

/** Cómo se nombra un puesto en un título; null si no tiene guía curada. */
export const roleGuideName = (role: string): string | null =>
  ROLE_GUIDES.find((guide) => guide.role === role)?.name ?? null

/** Qué se busca en la app para ver las ofertas del puesto. */
export const roleGuideQuery = (role: string): string | null =>
  ROLE_GUIDES.find((guide) => guide.role === role)?.query ?? null
