# Roadmap

Lo que está pensado y todavía no construido, en el orden en que tiene sentido
hacerlo. Nada de esto está implementado: es la lista para que no se pierda y
para que lo que se sume después no contradiga lo que ya hay.

## 1. Métricas de empresa y engagement

El Resumen ya muestra vistas, postulaciones, palabras clave, los puestos más
buscados y una gráfica por día. Lo que sigue:

- **Ventanas comparables**: poder mirar la misma serie contra el período
  anterior, no solo el número suelto.
- **Embudo por oferta**: vistas → clics al aviso → postulaciones, por
  publicación y por rubro.
- **Alertas**: un pico de vistas sin postulaciones, o una oferta que se queda
  sin visitas, avisados sin que haya que entrar a mirar.
- **Reportes exportables**: el mismo corte que ve el panel, para bajar y
  compartir con quien decide.

Todo sigue sobre contadores agregados (`offer_daily`, los eventos anónimos) y
las palabras clave que se extraen de las propias ofertas. Nada de esto agrega
una fila por persona.

## 2. Algoritmo de recomendación personalizado

Hoy las preferencias de quien busca (modalidad, nivel, jornada, rubros) marcan
las ofertas que coinciden, en el navegador. Lo que falta:

- **Señales del perfil**: títulos, cursos, años de experiencia y habilidades ya
  cargadas en el perfil.
- **Señales de la oferta**: las mismas habilidades extraídas del título, la
  descripción y los requisitos (el catálogo de `worker/src/skills.ts`, el mismo
  que alimenta las palabras clave del panel de empresa).
- **Un puntaje explicable**: por qué se recomienda cada oferta, en las palabras
  de quien la mira, no una caja negra.
- **Sin cuenta obligatoria**: como el resto del tablero, tiene que funcionar
  con lo que ya está en el navegador; el sync lo puede llevar entre equipos.

El recomendador es lo que le da sentido a las palabras clave del panel: para
que una empresa sepa con qué la va a encontrar quien busca.

## 3. Postulaciones con preguntas y requerimientos

Hoy el botón de postular sale al aviso original. Lo que se quiere:

- Que la empresa pueda **agregar preguntas** (sí/no, opción, texto corto) y
  **requisitos descartables** a una publicación.
- Que quien se postula **vea las preguntas antes** y pueda decidir si le
  cierran, en vez de enterarse sobre la marcha.
- Que la empresa pueda **filtrar rápido** por las respuestas: descartar en
  bloque, no revisar de a una.
- Los dos lados tienen que salir ganando: el que se postula ahorra tiempo en
  postulaciones que no encajan; la empresa ve solo lo que encaja.

Pendiente de definir dónde viven las respuestas (¿la cuenta de JobIt, el aviso
original, los dos?) antes de tocar el modelo.

## 4. Herramientas de IA para empresas (plan de pago)

Tienen costo de uso por token o por minuto de voz, así que van detrás de un
plan de pago y no en el panel gratuito.

- **Video de presentación por puesto**: generado en automático desde el título,
  la descripción y los requisitos, con voz sintetizada (ElevenLabs, XAI Voice
  Agent, o el proveedor que gane en costo y calidad). La empresa lo revisa y lo
  publica, no sale solo.
- **FAQ con respuestas en el momento**: un asistente entrenado con las
  publicaciones de la empresa que contesta las preguntas de siempre (turnos,
  zona, experiencia) sin que nadie esté del otro lado.
- **Más adelante**: borradores de descripciones, sugerencia de requisitos a
  partir de ofertas parecidas, y resumen de lo que preguntan las personas.

Cada herramienta de estas tiene que decir de dónde saca lo que dice, y ninguna
puede mandar datos de quien busca a un tercero sin que la persona lo sepa.
