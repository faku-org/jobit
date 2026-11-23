# Postulación con mensaje armado

Junto al botón "Postularme" de cada oferta (tarjeta y hoja de detalle) hay un
"Armar mensaje". Abre un compositor con una plantilla que se completa con tu
perfil y la oferta, y que podés editar antes de mandarla.

## Cómo se usa

1. Tocá "Armar mensaje" en la oferta.
2. Elegí la variante: Formal, Corta o Primer empleo.
3. Poné tu nombre (obligatorio) y qué adjuntás (por defecto "mi CV").
4. Editá la plantilla si querés. "Así sale" muestra el texto ya completo.
5. Mandalo:
   - La oferta trae un mail: "Abrir en mi correo" arma un `mailto:` con asunto
     y cuerpo.
   - No trae mail: "Copiar y abrir el aviso" copia el mensaje y abre la oferta.
   - "Copiar mensaje" copia sin salir.
6. Al volver, sigue el "¿Te postulaste finalmente?" de siempre.

El `mailto:` no puede llevar adjuntos: los sumás vos en tu correo.

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

Zero Data Policy: no llega nada nuevo a la API. El evento de postulación es el
de siempre, sin `user_id`.

## Pendiente

- El import de CV no completa el nombre.
- Sin verificar en un navegador real (cliente de correo, portapapeles).
