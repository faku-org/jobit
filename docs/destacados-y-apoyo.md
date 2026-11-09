# Servicios: destacados, apoyo voluntario y capa de pagos (#33)

Estado al 2026-11-05. Cubre la parte de #26 que queda después de #38 y de la PR #58, y
lo que se construyó para #33 sin cobrar.

## 1. Qué criterios están cumplidos

Evidencia en el código de `develop` (`2ee9a1c`), salvo donde dice PR #58.

### Épica #26

| Criterio                                                       | Estado             | Evidencia                                                                                              |
| -------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------ |
| Alta con handle, nombre y contraseña; email opcional y cifrado | cumplido           | `db.ts` (`users.email_enc`), `users.ts`, `account.ts`                                                  |
| Sin IP, user agent, historial de logins ni hora; solo el día   | cumplido en la app | `day()` en `services.ts`, `reviews.ts`, `events.ts`; el `access_log` de nginx sigue guardando IP (#34) |
| Moderación previa con descarte semántico local                 | cumplido           | `moderation.ts`, `queue.ts`; `moderation_prints` guarda hash y firma, no el texto                      |
| Dos monedas, sin convertir al guardar                          | cumplido           | `cleanPrices` en `services.ts`, orden por precio apagado sin tasa (`price_sort`)                       |
| Borrado de cuenta real; la reseña pierde autor y la nota queda | cumplido           | `service_reviews.author_user_id ... ON DELETE SET NULL` en `db.ts`                                     |
| Eventos de uso sin `user_id`                                   | cumplido           | `events.ts`; ningún evento ni fila lleva usuario                                                       |
| Contadores agregados por servicio y por día                    | **PR #58**         | `service_daily`, `bumpService`                                                                         |
| Publicar gratis; destacado siempre marcado; apoyo sin cuenta   | **esta PR**        | ver sección 3                                                                                          |
| El 3 % por trabajo hecho queda anotado y no se construye       | cumplido           | no existe; ver sección 5                                                                               |
| Servicios fuera de `/api/jobs`                                 | cumplido           | rutas propias en `catalog.ts` y `publish.ts`                                                           |

### #32 (PR #58, `feat/metricas-servicios`, abierta y MERGEABLE)

Cumple la parte de servidor y no cierra el issue. Revisada completa con `gh pr diff 58`.

Cumple:

- Los tres eventos (`service_search`, `service_view`, `service_contact`) se recortan contra
  vocabularios cerrados del servidor; el rubro de vistas y contactos sale de la fila del servicio y
  no del navegador.
- Ninguna fila lleva usuario, sesión, IP ni hora (hay test sobre las claves y sobre el esquema de
  `service_daily`).
- Contadores `service_daily` (servicio, día, vistas, contactos), sin una fila por visita.
- Endpoint del dueño `GET /api/services/mine/:id/metrics`, con sesión, 404 igual para ajeno e
  inexistente.
- Corte del panel (`usage.ts`, `Usage.tsx`): publicados, vistos, contactados, demanda por rubro y
  rubros buscados sin ningún servicio.

Falta (la propia PR lo declara):

1. **Correlación opt-in** del comentario de política: no está implementada. Es guardar algo por
   persona, así que necesita decisión de producto: dónde vive el permiso nuevo (separado de
   `shareStats`, apagado por defecto), cómo rota la sal del HMAC y si apagar la correlación borra
   las filas ya correlacionadas o se declara que no se puede desincronizar hacia atrás.
2. **El navegador no manda los eventos**: solo están los tipos en `web/src/lib/events.ts`. Y no hay
   UI de contacto (la ficha dice que JobIt no guarda datos de contacto), así que el medio de
   contacto no tiene de dónde salir.
3. El dueño tiene el endpoint pero no una pantalla.

Observación para el review de #58: `service_contact` deja una fila en el archivo con rubro y medio,
sin id de servicio. Es coherente con la regla (una fila es una acción, no una persona), pero el
conteo "bumped" de `appendEvents` suma las vistas y no los contactos; no cambia nada observable.

### #33 (este trabajo)

| Criterio                                                                    | Estado                                                           |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `boost_until` / `boost_kind` en `services`                                  | hecho, con migración aditiva para la base de producción          |
| Destacado sube en la lista y siempre dice que lo es                         | hecho (API `featured` + etiqueta "Destacado" en tarjeta y ficha) |
| Orden por relevancia adentro de cada grupo                                  | hecho y testeado                                                 |
| Apoyo voluntario: enlace, sin cuenta, sin seguimiento, sin contraprestación | hecho                                                            |
| `PaymentProvider` con dos proveedores desde el diseño                       | interfaz y registro hechos, **sin proveedor real**               |
| Ids del proveedor como `provider` + `external_id`                           | hecho (`ExternalRef`)                                            |
| Montos con moneda y tasa aplicada                                           | hecho (`Amount`)                                                 |
| Jurisdicción como dato de primera clase                                     | hecho (`Jurisdiction`, en `Order`)                               |
| Split nativo excluyente                                                     | hecho (`register` rechaza el que no lo tenga)                    |
| Mercado Pago / CFE                                                          | **no**: recién con un primer cliente de destacados               |

### #34 (legales)

Lo que #26 requiere y no está:

- La correlación opt-in en `privacidad.html` (depende de que #32 la implemente).
- El `access_log` de nginx: `deploy/nginx.conf` no define `log_format` ni recorta la IP. Con cuentas
  empeora. No se tocó acá (archivo de otra sesión).
- `terminos.html` sigue diciendo "No hace falta registrarse" (punto 3) y "No cobramos nada ... ni
  por destacar un aviso" (punto 2). Mientras los destacados se otorguen a mano sin cobrar, lo
  segundo es cierto para las ofertas. **Antes del primer cobro de destacados hay que reescribirlo.**

## 2. Decisión abierta (no se resuelve acá)

"¿Quién publica un servicio?": cuenta de usuario (como hoy, #26/#27) o solo emprendimientos desde el
panel de empresa. Lo construido no depende de eso: el destacado cuelga del `service_id` y no de
quién lo publicó. Lo que sí quedaría **bloqueado** según la respuesta:

- Quién paga un destacado el día que haya cobro (usuario o empresa) y por lo tanto qué dato de
  facturación se pide (CFE).
- La pantalla "mis destacados" para el dueño: hoy solo muestra "Destacado hasta ..." en
  `MyServices`; pedirlo o renovarlo no existe.

## 3. Qué hace esta PR

### Destacados (`api/src/boosts.ts`)

- `services.boost_until` (día inclusive) y `services.boost_kind`. Agregadas con `ADDITIVE_COLUMNS`
  en `db.ts`, porque `CREATE TABLE IF NOT EXISTS` no agrega columnas a la tabla de producción.
- `featured` se calcula (`status = published` y `boost_until >= hoy`): vence solo, sin trabajo en
  segundo plano. Un servicio suspendido o en revisión no figura como destacado.
- Orden: `(boost_until >= hoy) DESC` y adentro el orden de siempre (recientes, mejor calificados,
  precio). Pagar cambia de grupo, no la posición adentro del grupo.
- La respuesta pública lleva `featured` y **no** `boost_until` ni `boost_kind`. Quien publica ve
  hasta cuándo en `GET /api/services/mine`.
- Hoy los otorga el admin a mano (no hay cobro): `POST /api/admin/services/:id/boost`
  `{ kind: "featured", days: 1..90 }`, `DELETE` para apagarlo y `GET /api/admin/services/boosts`
  para ver los vigentes. Extender suma al final de lo que quedaba; tope acumulado 365 días.

```bash
curl -b cookie.txt -X POST https://jobit.uy/api/admin/services/<id>/boost \
  -H 'Content-Type: application/json' -d '{"kind":"featured","days":7}'
```

No hay pantalla de admin para esto: la cola de moderación solo lista lo pendiente y lo denunciado,
no lo publicado. Es un seguimiento chico.

### Apoyo voluntario (`api/src/support.ts`, `SupportLink.tsx`)

- `SUPPORT_URL` (https, sin credenciales) y `GET /api/support` → `{ url }`. Sin variable, la web no
  muestra el botón.
- Es un enlace a una página de afuera. No hay formulario, no hay evento de uso, no se guarda quién
  lo toca, y el archivo no importa nada de servicios, cuentas ni destacados (un test lo vigila).
- El texto en la web dice que no da nada a cambio. Si alguna vez desbloquea algo, deja de ser apoyo
  y es un plan pago: se diseña como plan.

### Capa de pagos (`api/src/payments.ts`)

Interfaz `PaymentProvider` y registro por jurisdicción, **sin ningún proveedor registrado**:
`providerFor` contesta "no hay proveedor". Desvío respecto del issue: `verifyWebhook` devuelve
`Promise<Result<...>>` y no `Result<...>`, porque verificar la firma exige leer el cuerpo crudo de
la petición, que es asíncrono.

Reglas escritas en el archivo para el primer proveedor: ids con su proveedor, montos con moneda y
tasa, jurisdicción obligatoria en la `Order`, split nativo excluyente, y la `Order` sin quién paga
(Zero Data: eso lo sabe la pasarela).

## 4. Zero Data

- Los destacados guardan servicio, clase y fecha de vencimiento. Nada de quien los pidió o pagó.
- El apoyo no registra nada.
- Ningún evento nuevo: no hay "impresión" ni "clic" de destacados. Medir si el destacado rinde se
  haría con `service_daily` (vistas por día) y no necesita nada más.
- Cuando haya cobro, la pasarela recolecta pagador y datos fiscales; la base propia guarda
  `provider` + `external_id` y el estado, no los datos. Eso parte a los usuarios en dos clases
  (quien paga ya no es casi anónimo) y se decide a propósito, como dice el issue.

## 5. Lo que sigue (no está hecho)

1. Mercado Pago como primer `PaymentProvider` **y** el CFE en el mismo issue, cuando haya un primer
   cliente de destacados. Antes: reescribir `terminos.html` (sección 1, #34).
2. Contratación dentro del sistema (propuesta, aceptación, hitos, conformidad) como épica previa al
   3 % por trabajo. No es un parámetro que se prende.
3. Pantalla de admin para otorgar destacados, y de dueño para ver/renovar (esta última bloqueada
   por la decisión de la sección 2).
4. Cablear los eventos de #32 en el navegador junto con la UI de contacto.
5. Recortar la IP del `access_log` de nginx (#34).
