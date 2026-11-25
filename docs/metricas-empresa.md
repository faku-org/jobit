# Métricas de empresa y engagement

Lo que ve quien publica en el panel (`/empresas`, sección Métricas): el embudo
de cada oferta, la comparación contra el período anterior, el reporte para
bajar y las alertas por correo. Todo sale de contadores agregados; no hay nada
por persona.

## Zero Data Policy

`offer_daily` guarda una fila por oferta y por día con tres números. No hay
`user_id`, sesión, IP ni hora. Lo nuevo (`clicks`, las alertas) respeta eso:

- el evento `offer_click` es anónimo y lleva solo el id público de la oferta;
- `company_alert_settings` guarda una preferencia de la empresa, no de una persona;
- `alert_sent` guarda "esta oferta ya recibió esta alerta tal día".

## El embudo

| Contador  | Qué cuenta                                                                         | Evento        |
| --------- | ---------------------------------------------------------------------------------- | ------------- |
| `views`   | La ficha de la oferta se abrió.                                                    | `offer_view`  |
| `clicks`  | La persona salió al aviso original (`apply_url`): empieza el flujo de postulación. | `offer_click` |
| `applies` | La persona confirmó "sí, la mandé" después de salir.                               | `offer_apply` |

`applies` es un **piso**, no un total: lo confirma quien vuelve y lo dice, y
JobIt no ve lo que pasa en el sitio de destino. Por eso `clicks` es el número
más confiable del paso de salida y `applies` el más conservador.

Solo suben las ofertas publicadas acá (`source === 'jobit'`) y solo si la
persona no apagó el envío de estadísticas: son una muestra de quien lo tiene
prendido.

El panel muestra el embudo por publicación y por rubro (el rubro sale de la fila
de la oferta, no del navegador). No se modelan "postulaciones con preguntas".

### Migración de `applies` a `clicks`

Hasta la v0.13 `applies` contaba el clic al aviso. La migración
(`api/src/db-metrics.ts`) crea `offer_daily.clicks` y, **una sola vez**, copia lo
viejo: `UPDATE offer_daily SET clicks = applies, applies = 0`. Corre solo si la
columna `clicks` no existía, así que reiniciar la API no mueve números.

Es la única migración del repo que toca datos y no solo suma una columna: se
aparta de la regla "solo aditivas" de `ADDITIVE_COLUMNS` porque, sin ese
movimiento, el historial mostraría clics como postulaciones confirmadas. El bloque
vive en su propio archivo para no tocar el `SCHEMA` de `db.ts`.

## Ventanas comparables

`GET /api/empresas/metrics?days=N` (1 a 365, por defecto 30) devuelve la ventana
actual y el **período anterior de igual largo**, que termina el día antes de que
empiece la actual.

- `previous`: totales, serie diaria y `has_data`.
- `change.{views,clicks,applies}`: `{ previous, delta, pct }`.
- `pct` es `null` cuando antes no había nada: dividir por cero no es "infinito",
  es que no hay con qué comparar. El panel lo dice en vez de inventar una
  variación, y el reporte deja vacías las columnas `*_anterior` (un cero ahí diría
  "no pasó nada").
- `by_offer[].previous` y `by_category[].previous` traen lo mismo por fila.

## Reporte exportable

Con la sesión de la empresa (401 sin ella), de la misma ventana que se ve en
pantalla:

- `GET /api/empresas/metrics.csv?days=N`: CSV con BOM UTF-8 (Excel lo necesita).
  Una sola tabla con la columna `tabla` (`resumen`, `diario`, `oferta`, `rubro`).
- `GET /api/empresas/metrics.xlsx?days=N`: un XLSX con una pestaña por tabla, sin
  la columna `tabla` ni las columnas sin ningún dato.

Columnas: `tabla`, `clave`, `etiqueta`, `estado`, `vistas`, `clics`,
`postulaciones` y las tres `*_anterior`. El archivo se llama
`jobit-metricas-<N>d-<último día>.<ext>`. Reutiliza `csv.ts` y `xlsx.ts`; en el
panel son dos enlaces de descarga junto al selector de ventana.

## Alertas por correo

Dos señales que piden hacer algo (`api/src/alerts.ts`, función pura
`detectAlerts`):

- **`views_no_applies`**: ayer la oferta tuvo al menos 10 vistas, al menos 3 veces
  el promedio diario de los 7 días anteriores, y ni un clic ni una postulación en
  los últimos 3 días.
- **`no_visits`**: publicada hace 7 días o más y con 0 vistas en los últimos 7.

Los umbrales están juntos en `THRESHOLDS`. Se mira hasta **ayer**, el último día
completo: hoy se está contando y un pico a la mañana no es un pico.

### Envío

- Destinatarios: los correos **verificados** de la empresa (`contacto`,
  `facturación`, `soporte`), sin repetir. El de `recuperación` queda afuera. Un
  correo por empresa y destinatario, con todas sus ofertas juntas, vía `mail.ts`.
- Sin ningún destinatario verificado no sale nada y la alerta no se reserva: si la
  empresa verifica uno después, sale.
- **Idempotente**: antes de mandar se reserva `(oferta, tipo, día)` en
  `alert_sent`; la misma alerta de la misma oferta no se repite dentro de 7 días
  (el disparador puede correr dos veces por día o la situación seguir igual sin
  mandar spam). Si ningún envío salió, la reserva se suelta y el próximo intento
  reintenta. Las marcas de más de 60 días se podan solas.
- **Apagado**: `GET/PUT /api/empresas/alerts` (`{ enabled }`); en el panel es un
  interruptor. Sin fila en `company_alert_settings` están prendidas, y el correo
  dice cómo apagarlas.

### Disparador diario

```bash
bun run --cwd api alerts      # una corrida a mano
```

En producción, `deploy/jobit-alerts.service` (oneshot) más
`deploy/jobit-alerts.timer` (todos los días 09:30, `Persistent=true`). Instalación
en `deploy/README.md`, sección "Las alertas a empresas".

## Probar

```bash
bun test api/src/metricas-empresa.test.ts api/src/empresas.test.ts
```

Cubren: migración de `clicks` (y que no corre dos veces), ventanas con y sin
período anterior, embudo por oferta y rubro, exportación, detección con datos
sintéticos y el disparador (idempotencia, enfriamiento, apagado, sin
destinatarios, envío fallido). Las rutas nuevas piden reiniciar la API: `bun --hot`
no registra rutas nuevas.
