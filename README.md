# jobit

Buscador de ofertas de trabajo de Uruguay, de todos los rubros, pensado para
encontrar el primer empleo: filtros por rubro, departamento y jornada, marca de
"sin experiencia", lista de guardadas y descarte de las que ya viste.

Además guarda preferencias (modalidad presencial, remota o híbrida, nivel,
jornada y rubros): las ofertas que coinciden quedan destacadas y se pueden
mostrar solas con "Solo similares". Todo vive en el navegador, sin cuenta.

Suma los llamados del Estado (Uruguay Concursa) en su propia pestaña, ordenados
por fecha de cierre, y un perfil con lo que estudió la persona para marcar qué
ofertas piden más nivel del que tiene.

## Estructura

| Carpeta | Qué hace |
|---|---|
| `worker/` | Scrapers de portales uruguayos. Escribe `worker/output/jobs.json`. |
| `api/` | Bun + Elysia. Sirve el JSON con filtros, facetas y paginado. |
| `web/` | React 19 + Vite + TailwindCSS v4. Interfaz en español. |

## Uso

```bash
bun install
```

Traer ofertas (primera corrida ~15 min por las descripciones, después solo pide
las nuevas):

```bash
bun run scrape
```

Levantar API y web juntos:

```bash
bun run dev
```

La API queda en `http://localhost:3000` y la web en `http://localhost:5173`,
que proxea `/api` hacia la API.

## API

| Endpoint | Descripción |
|---|---|
| `GET /health` | Estado del servicio. |
| `GET /api/jobs` | Ofertas filtradas y paginadas. |
| `GET /api/jobs/:id` | Una oferta completa. |
| `GET /api/meta` | Conteo, fecha de scrape, fuentes y facetas de rubro y departamento. |
| `POST /api/stats` | Recibe el resumen anónimo de uso y lo agrega a `data/stats.jsonl`. |

Parámetros de `/api/jobs`, todos opcionales y combinables:

| Parámetro | Valores |
|---|---|
| `q` | Texto libre sobre título, empresa, ubicación, rubro y descripción. |
| `category` | Slug de rubro (`ventas`, `oficios`, `salud`, ...). |
| `department` | Departamento tal cual lo publica la fuente. |
| `level` | `entry`, `mid`, `senior`. |
| `remote` | `onsite`, `remote`, `hybrid`. |
| `job_type` | `full_time`, `part_time`, `internship`. |
| `no_experience` | `true` para ofertas que no piden experiencia previa. |
| `days` | Solo ofertas de los últimos N días. |
| `source` | Fuentes separadas por coma (`buscojobs`, `uruguayconcursa`). |
| `sort` | `recent` (por defecto) o `closing`, que ordena por fecha de cierre. |
| `ids` | Lista de ids separados por coma. |
| `limit` / `offset` | Paginado. `limit` por defecto 50, máximo 200. |

`category`, `level`, `remote` y `job_type` aceptan varios valores separados por
coma y la oferta matchea con cualquiera de ellos. Una oferta sin teletrabajo
cuenta como `onsite`.

Variables de entorno: `PORT` (3000), `JOBS_FILE` (ruta al JSON del worker),
`STATS_FILE` (ruta del `.jsonl` de estadísticas), `CORS_ORIGIN` (origen del dev
server de Vite).

## Perfil y estadísticas

El perfil (nivel educativo, títulos, cursos, años de experiencia) se guarda solo
en `localStorage`, junto con las guardadas, los descartes y el seguimiento. Lo
único que sale del navegador es un resumen anónimo que se manda una vez por día
a `POST /api/stats`: nivel educativo y cantidades, sin texto libre, sin
identificador y sin ip ni user agent guardados. El panel de perfil muestra el
JSON exacto que se envía y tiene el interruptor para apagarlo.

## Compartir y embeber

Cada oferta tiene un botón de compartir, tanto en la tarjeta como en el panel:
mandarla con el menú del sistema, copiar el enlace, pasarla por WhatsApp o
copiar el iframe para pegarla en otra página.

| URL | Qué muestra |
|---|---|
| `/?job=<id>` | La app con esa oferta abierta. |
| `/?embed=<id>` | Solo esa oferta, sin el resto de la interfaz, para un iframe. |

El embed acepta `&theme=light` o `&theme=dark`; sin el parámetro sigue el
esquema del navegador. Solo lee la oferta, enlaza al aviso original y no toca
nada de lo guardado en el navegador de quien la ve.

## Indexado y previsualizaciones

El dominio de producción es `https://jobs.wefaber.net`. Está escrito a mano en
cuatro lugares, así que un cambio de dominio los toca a los cuatro:
`web/index.html` (canonical, `og:url`, `og:image`), `web/public/robots.txt` y
`web/public/sitemap.xml`.

La cáscara que se sirve trae el título, la descripción, el canonical, las
etiquetas Open Graph y Twitter, el manifiesto y un JSON-LD con `WebSite` y
`WebApplication`. La imagen de previsualización es `web/public/og.png`
(1200x630), generada del banner de `web/brand/`.

Mientras la app corre, `web/src/lib/meta.ts` reescribe título y descripción con
la oferta abierta: lo ven la pestaña, el historial y los buscadores que ejecutan
JavaScript, no los scrapers de WhatsApp o LinkedIn, que leen la cáscara y paran
ahí. Por eso un `?job=<id>` compartido siempre previsualiza como la portada. El
canonical manda cualquier query string a la raíz, y el `?embed=` además se marca
`noindex` en tiempo de ejecución.

No hay JSON-LD `JobPosting` a propósito: las ofertas se enlazan al aviso
original y no se republican, y marcarlas acá como si vivieran en JobIt es lo que
Google penaliza en los agregadores.

## Fuentes

| Fuente | Estado |
|---|---|
| BuscoJobs Uruguay | Activa. Listados por rubro y detalle por oferta. |
| Uruguay Concursa | Activa. Llamados del Estado abiertos y próximos, con fecha de cierre. |
| Gallito | Pendiente. El sitio responde 403 detrás de Cloudflare y necesita un navegador headless. |

El worker consulta de a una petición por vez, con pausa entre pedidos, y cachea
las descripciones en `worker/cache/` para no volver a pedirlas. Es una
herramienta de uso personal: no republica las ofertas, siempre enlaza al aviso
original.
