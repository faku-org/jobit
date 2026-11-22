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
una pestaña más. Se entra desde **Perfil** en la isla, bajo "Autoconocimiento".

Por qué no es una pestaña: con una octava, la barra de pestañas mide cerca de
740 px y en tablet el tablero tiene 728 px. Además "una cosa por pantalla"
(`DESIGN.md`): un cuestionario largo con su propio avance no comparte pantalla
con un listado de ofertas. Mientras se hace no hay pestañas; salir o el botón
Atrás del navegador vuelve al listado. El perfil de la isla es el lugar donde
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

## Privacidad (Zero Data Policy)

- Las respuestas viven en `localStorage` (`jobit.selftest.v1`) y no tienen
  ningún camino hacia la API. Se usan para pausar y seguir otro día.
- "Borrar todos mis datos" del perfil también borra el test; el resultado tiene
  además "Borrar mis respuestas" y "Repetir el test".
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

- Compartir el resultado como enlace o PDF (hoy no sale del dispositivo).
- Sugerir puestos concretos, no solo rubros.
- Mostrar `test_done` en el panel de administración, si hace falta mirarlo.
