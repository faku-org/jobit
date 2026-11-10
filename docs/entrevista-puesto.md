# Guías de entrevista por puesto

Cierra el nivel **puesto** del issue 3 ("Preguntas frecuentes y habilidades por
rubro"). El nivel rubro (`/entrevista/<rubro>`) ya estaba; esto baja un nivel.

## Qué hay

| Ruta                           | Qué muestra                                                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/entrevista/<rubro>`          | Guía del rubro. Ahora enlaza a las guías de sus puestos ("Guías por puesto").                                                                         |
| `/entrevista/<rubro>/<puesto>` | Guía de un puesto: preguntas con respuesta sugerida, habilidades y las ofertas del puesto. `FAQPage` y `BreadcrumbList` en JSON-LD, canonical propio. |

- `<puesto>` es un slug de `worker/src/roles.ts` (`ROLES`), el mismo catálogo con
  el que el tablero cuenta los puestos.
- Una guía existe solo para un par rubro/puesto con contenido. Un puesto sin
  contenido, un puesto inventado o el puesto bajo otro rubro dan **404**, igual
  que un rubro vacío.
- Cada puesto vive bajo **un solo rubro**: una URL, sin contenido duplicado.
  `cajero` está bajo `ventas` aunque las fuentes lo clasifiquen mayormente como
  administración; el rubro de la guía es editorial, no el de la fuente.
- Entran al `sitemap.xml` (16 entradas hoy), calculadas del contenido: lo que
  sume la ingesta con `roles` aparece solo.
- En la ficha de la oferta, el panel "Para prepararte" suma "Ver la guía de
  entrevista para este puesto" cuando el puesto del título (`roleOf`) tiene guía.
  La web no sabe qué puestos tienen contenido: pide un ítem por
  `/api/content?role=<puesto>` y arma la URL con el rubro del propio contenido.

nginx (`location ^~ /entrevista/`) y el proxy de `web/vite.config.ts`
(`/entrevista`) ya cubrían el subpath: no se tocaron.

## Cómo está armado

```text
worker/src/content/role-guides.ts   contenido curado + ROLE_GUIDE_ITEMS (roles: [slug])
api/src/content.ts                  mezcla seed + guías + lo traído; filtro rubroOnly
api/src/interview.ts                roleGuides(), roleInterviewPageHtml()
api/src/site.ts                     GET /entrevista/:slug/:role + sitemap
web/src/hooks/useRoleGuide.ts       enlace desde la ficha
```

### `roles` en el contenido

Los ítems de una guía llevan `roles: ["cajero"]` y `categories: ["ventas"]`. El
id incluye el puesto (`guia/<puesto>/<tipo>/<título>`), así una misma pregunta
puede repetirse entre puestos o con el seed por rubro sin pisarse al mezclar
por id.

### `rubroOnly` / `scope=rubro`

Una guía de puesto cuelga de un rubro, pero no es "del rubro". Sin separarlas,
las preguntas de Cajero/a competirían por el tope de 12 ítems con las generales
de Ventas en la ficha y en el tablero filtrado. Por eso:

- `queryContent({ rubroOnly: true })` excluye lo que tiene `roles`.
- `GET /api/content?...&scope=rubro` lo expone. `usePrep` lo manda siempre
  (siempre pide "lo del rubro") y la guía `/entrevista/<rubro>` lo usa.
- Sin `scope`, `/api/content` se comporta como antes: devuelve todo, incluidas
  las guías de puesto. `?role=` sigue filtrando por puesto.

## Contenido curado

16 puestos, elegidos por cuántas ofertas tienen en el tablero (jobs.json del
2026-09-29, 2.336 ofertas): vendedor, cajero, atención al cliente,
recepcionista, administrativo, administrativo contable, contador, depósito,
chofer, operario, cocinero, mecánico, electricista, docente, enfermería y
desarrollador. Cada uno tiene 5 preguntas con respuesta sugerida y 2 temas.

Criterio editorial:

- Preguntas de entrevista y habilidades **genéricas del oficio**, escritas a
  mano. No hay cifras ni afirmaciones medidas del mercado uruguayo (sueldos,
  demanda).
- Las pocas referencias locales son institucionales y estables: BPS, DGI, IVA e
  IRAE/IRPF (contabilidad) y el carné de manipulación de alimentos (cocina).
  Para conducción se dice "la libreta de la categoría que pide el aviso", sin
  nombrar categorías.
- El texto dice "las preguntas que **suelen** hacerse", no "las más repetidas":
  son preguntas típicas curadas, no un conteo de entrevistas reales.
- `desarrollador` cubre el puesto entero (frontend, backend, full stack): el
  catálogo de roles no los separa y el contenido es del oficio, no de un stack.

### Cómo agregar un puesto

1. Un bloque nuevo en `ROLE_GUIDES` (`role` ya existente en `ROLES`, `category`,
   `name`, `query` y los textos). `bun test` falla si el puesto o el rubro no
   existen en los catálogos o si hay menos de 4 preguntas.
2. Nada más: la ruta, el sitemap, el enlace del rubro y el de la ficha salen
   del contenido.

## Pendiente (no incluido)

- Más puestos: faltan seguridad, limpieza, asesor comercial, repositor, médico y
  los genéricos de alto volumen (encargado, auxiliar, asistente), que piden un
  enfoque distinto porque no nombran un oficio.
- Guías por **nivel** (`level`: entry/mid/senior) dentro de un puesto.
- Las guías no están en el tablero filtrado por puesto (`RubroPrep` sigue siendo
  por rubro): la entrada es la ficha de la oferta, la guía del rubro y el
  buscador.
