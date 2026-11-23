# Test de autoconocimiento laboral

Un cuestionario de 50 frases (IPIP-50 de Goldberg, Big Five) que devuelve cinco
rasgos, una lectura en lenguaje simple y los rubros del tablero que suelen
encajar. Es una guía para pensar qué trabajo queda cómodo, no una evaluación.

- **No es un psicotécnico ni un diagnóstico.** El aviso sale antes de empezar y
  otra vez en el resultado. Ninguna empresa lo ve ni lo pide.
- Código: `web/src/lib/selfTest.ts` (lógica sin React, con tests en
  `selfTest.test.ts`) y `web/src/components/test/SelfTest.tsx` (la pantalla).

## Dónde vive

Es una vista propia del tablero (`view: 'test'`, enlazable con `?view=test`), no
una pestaña más. Se entra desde la página de **Perfil** (`?view=profile`, botón
Preferencias de la isla), bajo "Autoconocimiento".

Por qué no es una pestaña: con una octava, la barra de pestañas mide cerca de
740 px y en tablet el tablero tiene 728 px. Además "una cosa por pantalla"
(`DESIGN.md`): un cuestionario largo con su propio avance no comparte pantalla
con un listado de ofertas. Mientras se hace no hay pestañas; salir o el botón
Atrás del navegador vuelve al listado. El perfil es el lugar donde
la persona ya mira "qué sé de mí y qué guarda JobIt".

## Puntaje

- 10 ítems por rasgo, escala de 1 (Nada) a 5 (Del todo).
- Los ítems invertidos puntúan `6 - respuesta`. Son 24 de 50: extroversión 5,
  amabilidad 4, responsabilidad 4, apertura 3 y estabilidad 8.
- La estabilidad emocional es el inverso del neuroticismo del IPIP-50: las
  frases son las de Goldberg y lo que cambia es el signo, así los cinco rasgos
  se leen igual (más puntos, más de lo que dice el nombre).
- `percent = (suma - 10) / 40 * 100`. Niveles: menos de 40 bajo, de 40 a 60
  medio, más de 60 alto. No hay baremo poblacional: los cortes son de la escala
  y la pantalla lo dice ("sobre la escala del propio test").
- Sin las 50 respuestas no hay resultado (`scoreTest` devuelve `null`).

## Rubros sugeridos

`RUBRO_WEIGHTS` da el peso de cada rasgo en cada rubro, con los slugs del
tablero (`@jobit/worker/categories`; un test verifica que existan). La afinidad
es la media ponderada del porcentaje de los rasgos del rubro; se sugiere lo que
supera 50, con un máximo de cuatro. Cada rubro es un botón que lleva al tablero
con ese rubro elegido. Son orientaciones de sentido común, y el texto lo dice.

## Radar de los cinco rasgos

"Tu perfil de un vistazo" muestra los cinco puntajes como un polígono. Es SVG
propio, sin librerías (`components/test/Radar.tsx`); la geometría (ejes, anillos
al 25/50/75/100, puntas, anclas de rótulo) está en `lib/radar.ts`, sin React ni
DOM, con tests en `radar.test.ts`. La usa también el badge, así los dos dibujan
lo mismo.

- Colores con los tokens del tema (`sky` para la grilla, `brand` para el
  polígono, `ink` para los rótulos): se ve igual de bien en claro y en oscuro.
- Los rótulos son cortos ("Estabilidad", no "Estabilidad emocional") para que
  entren a 390 px.
- Alternativa accesible: el SVG va `aria-hidden` y al lado hay una tabla solo
  para lectores de pantalla (rasgo, puntaje, lectura). La lista de barras de
  abajo sigue siendo la lectura completa.
- Entrada con resorte (`useSpring`) que lleva el polígono de 0 al puntaje. Con
  "reducir movimiento" el polígono sale completo en el primer cuadro.

## Badge para compartir

"Tu badge" arma una imagen vertical de 1080 × 1350 con el rasgo que más se nota,
un radar chico, la marca JobIt y el aviso "No es un psicotécnico ni un
diagnóstico" (va en la imagen, no solo en la pantalla). Código en
`lib/badge.ts` y `components/test/Badge.tsx`.

- Se dibuja en un `canvas` del navegador y se convierte en PNG en memoria. La
  paleta es siempre la azul de la marca, no la del tema: la imagen se ve en
  fondos ajenos.
- **Descargar PNG** baja `jobit-mi-perfil-laboral.png`.
- **Compartir** usa la Web Share API con el archivo si
  `navigator.canShare({ files })` lo permite. Si no, copia la imagen al
  portapapeles, y si tampoco se puede, la descarga. Cerrar el menú del sistema
  sin elegir no cae a otra opción. El entorno (`ShareEnv`) se inyecta, por eso
  la cadena de alternativas tiene tests.
- El rasgo destacado es el de mayor porcentaje; si empatan, el primero según el
  orden del test. Si ese rasgo está en el medio, la imagen dice "En el medio" y
  no lo vende como un extremo.

## Privacidad (Zero Data Policy)

- Las respuestas viven en `localStorage` (`jobit.selftest.v1`) y no tienen
  ningún camino hacia la API. Se usan para pausar y seguir otro día.
- El badge no sube nada: se arma y se guarda o comparte en el dispositivo, sin
  llamadas a la API ni eventos con el resultado. Lo que muestra solo sale si la
  persona lo manda; la pantalla se lo dice.
- "Borrar todos mis datos" del perfil también borra el test; el resultado tiene
  además "Repetir el test" y "Borrar mis respuestas".
- "Borrar mis respuestas" es un botón destructivo secundario (fondo y borde en
  tono de peligro) que abre un diálogo centrado (`components/ui/ConfirmDialog.tsx`,
  `role="alertdialog"`): el foco queda atrapado adentro y arranca en "Cancelar",
  Esc o clic afuera cancelan, y el foco vuelve al botón. Se borran las 50
  respuestas y el resultado, sin copia.
- Un storage ilegible o editado a mano no rompe nada: `parseStored` solo acepta
  ítems que existen y valores del 1 al 5.

## Contador "test completado por día"

Hecho, sobre el canal anónimo que ya existía (`/api/events`, ver
`docs/destacados-y-apoyo.md`): el evento `test_done` no lleva ningún campo. El
servidor guarda `{ day, kind: 'test_done' }`, sin hora ni identificador, y no
escribe nada más aunque el cuerpo traiga respuestas o puntajes (hay un test que
lo comprueba). Solo se manda si la persona tiene prendida la casilla de
estadísticas anónimas, una vez por tanda de respuestas, y aparece en "Ver
exactamente qué se envía" del perfil.

## Pendiente

- Compartir el resultado como enlace o PDF (hoy solo sale como imagen que la
  persona manda a mano; un enlace obligaría a guardar el resultado afuera).
- Sugerir puestos concretos, no solo rubros.
- Mostrar `test_done` en el panel de administración, si hace falta mirarlo.
