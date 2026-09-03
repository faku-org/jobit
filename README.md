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
| `web/` | React 19 + Vite + TailwindCSS v4. Interfaz en español y panel en `/admin`. |

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
| `POST /api/events` | Recibe un lote de hasta 20 eventos anónimos y los agrega a `data/events.jsonl`. |

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
| `source` | Fuentes separadas por coma (`jobit`, `buscojobs`, `uruguayconcursa`). |
| `sort` | `recent` (por defecto) o `closing`, que ordena por fecha de cierre. |
| `ids` | Lista de ids separados por coma. |
| `limit` / `offset` | Paginado. `limit` por defecto 50, máximo 200. |

`category`, `level`, `remote` y `job_type` aceptan varios valores separados por
coma y la oferta matchea con cualquiera de ellos. Una oferta sin teletrabajo
cuenta como `onsite`.

Variables de entorno: `PORT` (3000), `HOST` (127.0.0.1), `JOBS_FILE` (ruta al
JSON del worker), `DB_FILE` (SQLite de empresas y ofertas propias),
`STATS_FILE` y `EVENTS_FILE` (rutas de los `.jsonl`), `CORS_ORIGIN` (origen del
dev server de Vite), `ADMIN_PASSWORD_HASH_FILE` (archivo con el hash del panel;
sin él `/api/admin` responde 404).

## Perfil y estadísticas

El perfil (nivel educativo, títulos, cursos, años de experiencia) se guarda solo
en `localStorage`, junto con las guardadas, los descartes y el seguimiento.

Con el interruptor prendido salen del navegador dos cosas, las dos sin
identificador y sin que se guarde ip ni user agent:

- **Un resumen por día** a `POST /api/stats`: nivel educativo y cantidades
  (títulos, cursos, guardadas, postulaciones, cuántas pasaron a entrevista y
  cuántas se cerraron).
- **Eventos de uso** a `POST /api/events`, en lote y recién cuando la pestaña se
  esconde: qué puesto se buscó, qué filtros se usaron y a qué avisos se les dio
  a "Postularme".

Ninguno de los dos lleva texto libre. Lo que se escribe en el buscador no sale:
sale el puesto que ese texto nombra, del mismo catálogo con el que se cuentan
los avisos (`worker/src/roles.ts`), o `otro` cuando no nombra ninguno. Y la API
vuelve a recortar todo contra ese vocabulario antes de escribir, así que el
archivo no puede terminar guardando texto libre por más que alguien se lo mande
a mano.

Las filas se estampan con el día y nunca con la hora, y no hay sesión ni orden
entre ellas, así que dos eventos del mismo navegador quedan indistinguibles de
dos de navegadores distintos. El panel de perfil muestra el JSON exacto que se
envía, incluida la cola de eventos sin mandar, y tiene el interruptor para
apagarlo.

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

## Panel de administración

En `/admin`, con su propio bundle: quien entra a buscar trabajo no se baja el
código de administrar empresas. Por ahora administra empresas, que es la mitad
operativa de que puedan publicar directo en vez de depender del scrapeo.

La credencial es un hash argon2id. No hay tabla de usuarios ni clave en texto
plano en ningún lado, y sin hash configurado el panel queda apagado entero:
`/api/admin` contesta 404, así que un despliegue sin configurar se queda sin
admin en vez de con un admin abierto.

La configuración de la API va en **`api/.env`**, no en la raíz: la API arranca
con `bun run --cwd api start`, así que Bun carga el `.env` de ese directorio y
el de la raíz no lo ve. En `api/.env.example` están todas las variables.

```bash
bun -e 'await Bun.write("data/admin.hash", await Bun.password.hash(prompt("clave: ")))'
cp api/.env.example api/.env   # y descomentá ADMIN_PASSWORD_HASH_FILE
bun run dev
```

El hash va a un archivo (`ADMIN_PASSWORD_HASH_FILE`) y no a una variable por
una razón concreta: empieza con `$argon2id$` y tiene varios `$` adentro, que
casi todo lo que lo transporta interpola. El shell los expande, y el parser de
`.env` de Bun también, con comillas simples, dobles o sin ninguna. El valor
queda en `=19=65536,t=2,p=1...` y la clave deja de coincidir sin dar un solo
error que lo explique. `ADMIN_PASSWORD_HASH` con el hash inline sigue andando
si se escapa cada `$` como `\$`.

`ADMIN_INSECURE_COOKIES=true` saca el flag `secure` de la cookie, que sobre
`http://` la haría inservible. En producción no se pone.

La sesión es una cookie `HttpOnly`, `SameSite=Strict`, con alcance
`/api/admin` y vencimiento de 12 horas. En la base solo se guarda el sha256 del
token, nunca el token, así que una copia del archivo no alcanza para hacerse
pasar por una sesión abierta. Probar claves está limitado a diez intentos cada
quince minutos por dirección.

Las empresas viven en SQLite (`data/jobit.db`, `DB_FILE` para moverlo), aparte
del JSON del scraper, que se reescribe entero en cada corrida y no es lugar para
algo que la app edita.

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
