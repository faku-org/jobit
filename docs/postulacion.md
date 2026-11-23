# Postulación con mensaje armado

Junto al botón "Postularme" de cada oferta (tarjeta y hoja de detalle) hay un
"Armar mensaje". Lleva a la segunda página de la misma hoja: una plantilla que
se completa con tu perfil y la oferta, con una vista previa del mensaje
completo al lado.

## Una sola hoja, dos páginas

No hay un modal dentro de otro. La hoja (`JobModal`) es un único
`[role=dialog]` con dos páginas que se deslizan:

- **Ficha**: la oferta de siempre. Ancho 672 px.
- **Armar mensaje**: el compositor. La hoja se ensancha en X hasta 1040 px.

La transición (deslizar + ensanchar) usa el spring `islandTransition` y con
`prefers-reduced-motion` pasa sin animación. La página inactiva queda `inert`.
La de armar se monta la primera vez que se visita y después se queda montada:
el borrador y el scroll sobreviven a ir y volver. Al cambiar de página el foco
va al título de la activa y `aria-labelledby` pasa de una a otra.

"Volver a la ficha" (o Esc) regresa a la ficha; Esc en la ficha cierra. En
mobile el botón dice "Volver".

El botón "Armar mensaje" de la tarjeta abre la hoja directo en la segunda
página.

## Cómo se usa

1. Tocá "Armar mensaje" en la oferta.
2. Elegí la variante: Formal, Corta o Primer empleo.
3. Poné tu nombre (obligatorio) y qué adjuntás (por defecto "mi CV";
   separalos con coma, `;`, " y " o " e ").
4. Editá la plantilla si querés. La vista previa se actualiza sola.
5. Mandalo desde el pie flotante:
   - La oferta trae un mail: "Abrir en mi correo" arma un `mailto:` con asunto
     y cuerpo.
   - No trae mail: "Copiar y abrir el aviso" copia el mensaje y abre la oferta.
   - "Copiar" copia sin salir.
6. Al mandar, la hoja vuelve a la ficha y sigue el "¿Te postulaste
   finalmente?" de siempre.

Los botones de mandar nunca están deshabilitados. Si falta el nombre, el pie
lo dice (región `aria-live`), el campo se marca inválido y el foco va a él.

El `mailto:` no puede llevar adjuntos: los sumás vos en tu correo.

## Vista previa

`MessagePreview` muestra el mensaje como lo ve quien lo recibe: Para, Asunto
(sólo si hay mail), cuerpo ya completo y los adjuntos como chips
(`attachmentList` en `lib/message.ts`). Es de solo lectura.

- Escritorio (`lg`): dos columnas. Izquierda, el formulario (variante, nombre,
  adjuntos, plantilla). Derecha, la vista previa.
- Mobile: una columna con un selector Editar / Vista previa.

## URL

`?job=<id>&apply=1` abre la hoja en la página de armar. Igual que `job`, se
escribe con `replaceState` (no agrega historia) y se ignora salvo que el
`job` de la URL sea la oferta que se abrió, así un `apply=1` viejo no abre
el compositor de otra oferta. Los helpers están en `lib/url.ts`
(`readApplyOpen`, `writeApplyOpen`, `applyApplyOpen`).

## Plantilla

Llaves que se completan solas:

| Llave        | Sale de                                              |
| ------------ | ---------------------------------------------------- |
| `{nombre}`   | Tu nombre (`resume.name`)                            |
| `{puesto}`   | El título de la oferta                               |
| `{empresa}`  | La empresa; sin dato, "su empresa"                   |
| `{adjuntos}` | Lo que cargaste en "Qué adjuntás"; sin dato, "mi CV" |
| `{idiomas}`  | Tus idiomas con nivel, "Inglés (avanzado)"           |
| `{links}`    | Tus links del perfil, separados por coma             |

Una llave desconocida queda tal cual la escribiste. "Guardar como mi versión"
reemplaza la plantilla de esa variante; "Volver al original" restaura la de
fábrica (`lib/message.ts`, `DEFAULT_TEMPLATES`).

## Detección del mail

`findContactEmail` (`lib/message.ts`) usa sólo lo que la oferta ya trae, no
inventa nada:

1. Un `mailto:` en el enlace de postulación gana siempre. Si está roto, no se
   adivina en el texto.
2. Si no, busca en la descripción y los requisitos. Ignora `noreply`, archivos
   (`logo@2x.png`) y dominios de ejemplo.
3. Con más de una dirección distinta devuelve nada: la persona usa "Copiar".

## Largo del `mailto`

Algunos clientes de correo cortan URLs de más de ~1800 caracteres. Si el
mensaje no entra, `buildMailto` devuelve `null` (no se trunca: se mandaría una
postulación cortada) y el compositor ofrece copiar. Los saltos de línea van
como CRLF (RFC 6068).

## Dónde se guarda

Sólo en este navegador, dentro del `resume` de `jobit.prefs.v1`: `name`,
`attachments` y `messages` (una plantilla por variante, hasta
`MAX_MESSAGE_CHARS`). Queda fuera del sync y de las estadísticas, y "Borrar
todo" lo limpia. El export JSON lleva el nombre en `contacto`, no las plantillas.

Zero Data Policy: no llega nada nuevo a la API. El mensaje y la vista previa
se arman en el dispositivo; `apply=1` es sólo estado de la URL local. El evento
de postulación es el de siempre, sin `user_id`.

## Pendiente

- El import de CV no completa el nombre.
- Sin verificar en un navegador real con cliente de correo y portapapeles
  (la verificación visual fue en Edge headless).
