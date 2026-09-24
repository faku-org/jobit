# jobit

Buscador de ofertas de trabajo de Uruguay, de todos los rubros, pensado para
encontrar el primer empleo: filtros por rubro, departamento y jornada, marca de
"sin experiencia", lista de guardadas y descarte de las que ya viste.

Además guarda preferencias (modalidad presencial, remota o híbrida, nivel,
jornada y rubros): las ofertas que coinciden quedan destacadas y se pueden
mostrar solas con "Solo similares". Todo vive en el navegador: buscar trabajo no
pide cuenta. Publicar servicios va a pedir una, y esa cuenta es lo único que se
guarda en el servidor.

Suma los llamados del Estado (Uruguay Concursa) en su propia pestaña, ordenados
por fecha de cierre, y un perfil con lo que estudió la persona para marcar qué
ofertas piden más nivel del que tiene.

## Estructura

| Carpeta | Qué hace |
|---|---|
| `worker/` | Scrapers de portales uruguayos y del contenido curado. Escribe `worker/output/`. |
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

Si la API que tiene que quedarse con esas ofertas corre en otra máquina, el
mismo comando y la subida van juntos (ver "Scrapeo, agenda y salida por
proxy"):

```bash
bun run scrape:push
```

Levantar API y web juntos:

```bash
bun run dev
```

La API queda en `http://localhost:3000` y la web en `http://localhost:5173`,
que proxea `/api` hacia la API.

La intro pasa una sola vez por navegador, así que para volver a verla entera
(bienvenida, configuración, las preguntas y el traspaso a la app) se agrega
`?dev=onboarding` a la URL. No borra nada de lo guardado: vale para esa carga y
termina donde termina la de verdad.

## API

| Endpoint | Descripción |
|---|---|
| `GET /health` | Estado del servicio. |
| `GET /api/jobs` | Ofertas filtradas y paginadas. Con `format=txt` o `Accept: text/plain` sale el mismo listado en texto. |
| `GET /api/jobs.txt` | Ese listado ya en texto, para `curl` y para grep. Mismos parámetros. |
| `GET /api/cli` | La URL del tablero en texto: entiende `view` y `job` además de los filtros. |
| `GET /api/jobs/:id` | Una oferta completa. Con `format=txt` o `Accept: text/plain` incluye la descripción. |
| `GET /api/meta` | Conteo, fecha de scrape, fuentes y facetas de rubro y departamento. |
| `GET /api/market` | El tablero entero resumido: totales, puestos, rubros, zonas y sueldos. |
| `GET /api/market.csv` | Ese mismo informe como CSV, todas las tablas bajo un encabezado. |
| `GET /api/market.xlsx` | Ese mismo informe como planilla, una pestaña por tabla. |
| `GET /api/content` | El contenido curado por rubro y puesto (FAQ, ejercicios, recursos). |
| `POST /api/stats` | Recibe el resumen anónimo de uso y lo agrega a `data/stats.jsonl`. |
| `POST /api/events` | Recibe un lote de hasta 20 eventos anónimos y los agrega a `data/events.jsonl`. |
| `GET /api/admin/usage` | Lo que llegó a esos dos archivos, sumado para el panel. Pide sesión. |
| `POST /api/ingest/jobs` | Recibe el `jobs.json` del worker corriendo en otra máquina. Pide token. |
| `POST /api/auth/register` | Crea la cuenta y devuelve, una sola vez, los códigos de respaldo. |
| `POST /api/auth/login` | Entra; si la cuenta tiene 2FA, pide el segundo paso en vez de abrir sesión. |
| `POST /api/auth/totp` | El segundo paso: cierra el ingreso con el código de seis dígitos. |
| `POST /api/auth/recover` | Entra con un código de respaldo. |
| `POST /api/auth/logout` | Cierra la sesión y borra la cookie. |
| `GET` / `PATCH` / `DELETE /api/me` | Quién soy, editar la cuenta y borrarla de verdad. |
| `POST` / `DELETE /api/me/totp` | Activar y desactivar el segundo paso. |
| `GET` / `PUT` / `DELETE /api/me/sync` | Bajar, guardar o borrar lo que la cuenta sincroniza entre navegadores. |

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
| `format` | `json` (por defecto) o `txt`. El texto es para leerlo o grepearlo desde la CLI. |

`category`, `level`, `remote` y `job_type` aceptan varios valores separados por
coma y la oferta matchea con cualquiera de ellos. Una oferta sin teletrabajo
cuenta como `onsite`.

Las dos descargas del mercado salen del mismo informe y no piden nada: no hay
parámetros, no hay sesión, y el archivo se llama `jobit-mercado-AAAA-MM-DD` con
la fecha del scrape. El CSV apila las tablas (`total`, `frescura`, `fuente`,
`puesto`, `rubro`, `departamento`, `habilidad`, `modalidad`, `jornada` y
`nivel`) bajo un encabezado común, con la columna `tabla` diciendo cuál es cada
fila; el XLSX pone una pestaña por tabla y saca de cada una las columnas que no
usa.

El corte de `habilidad` cuenta las que más se nombran en títulos, descripciones
y requisitos, contra un catálogo controlado (`worker/src/skills.ts`, el mismo
patrón que `roles.ts`): "Excel avanzado" y "Excel intermedio" cuentan igual, y
una habilidad mencionada en menos de cinco avisos no entra, porque una es
anécdota. Cada habilidad lleva la mediana de lo que pagan los avisos que la
piden.

```bash
curl -s http://localhost:3000/api/market.csv | head -3
curl -s "http://localhost:3000/api/jobs.txt?q=cajero&limit=5"
```

## Contenido

Aparte de las ofertas, JobIt muestra contenido curado por rubro y puesto:
preguntas frecuentes de entrevista, ejercicios de práctica y recursos. No se
calcula: se trae y se mantiene.

- El **seed** vive versionado en `worker/src/content/seed.ts` y es lo que hace
  que la función ande desde el primer día y sin red.
- La **ingesta** (`worker/src/content/sources.ts` + `adapters.ts`) suma lo que
  hay en las fuentes base (documentación, práctica) y escribe
  `worker/output/content.json`. La API mezcla ese archivo con el seed, así que
  una corrida fallida nunca vacía una sección: conserva lo que esa fuente había
  dejado.

```bash
bun run content          # regenera worker/output/content.json
curl -s "http://localhost:3000/api/content?category=tecnologia&kind=faq,exercise"
```

El momento que lo activa es confirmar una postulación: cuando la persona dice
que sí, la ficha de la oferta muestra, ahí mismo, los ejercicios y las preguntas
de su rubro. Un rubro sin contenido no dibuja nada.

Cada ítem lleva su fuente y, si es un enlace pago, `sponsored: true`: la web lo
enlaza con `rel="sponsored"` desde el primer día, porque marcar un enlace pago
tarde es justo lo que Google penaliza.

## Desde la CLI

Los filtros viajan en la URL de la web. `curl` de esa misma dirección
devuelve el listado en texto, sin JavaScript:

```bash
curl -s "http://localhost:5173/?q=cajero"
curl -s "http://localhost:5173/?view=state"
curl -s "http://localhost:5173/?view=market"
curl -s "http://localhost:5173/?job=<id>"
```

Guardadas y seguimiento viven en el navegador: desde la CLI no hay nada que
devolver. El atajo estable, sin negociación de User-Agent, es `GET /api/cli`
con los mismos parámetros.

Variables de entorno: `PORT` (3000), `HOST` (127.0.0.1), `JOBS_FILE` (ruta al
JSON del worker), `CONTENT_FILE` (ruta al `content.json` del worker), `DB_FILE`
(SQLite de empresas, ofertas propias y cuentas),
`STATS_FILE` y `EVENTS_FILE` (rutas de los `.jsonl`), `CORS_ORIGIN` (origen del
dev server de Vite), `ADMIN_PASSWORD_HASH_FILE` (archivo con el hash del panel;
sin él `/api/admin` responde 404), `INGEST_TOKEN_FILE` (archivo con el token de
ingesta; sin él `/api/ingest` responde 404), `JOBIT_SECRET_KEY_FILE` (archivo
con la clave de 32 bytes que cifra el email y el secreto TOTP de las cuentas;
sin ella, el alta sin email sigue andando pero el email y el 2FA quedan
apagados) y `PUBLIC_ORIGIN` (origen que va en los canonical y og:url de las
páginas server-rendered; por defecto el de producción).

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

## Términos y privacidad

`web/terminos.html` y `web/privacidad.html`, dos entradas más del build. No
cargan React: el estilo sale de `web/src/legal.css`, que importa el mismo
`index.css` que la app, y todo el javascript es `web/src/legal.ts`, dos kilos
que hacen tres cosas, las tres opcionales: marcan en el índice la sección que se
está leyendo, pliegan ese índice en el teléfono y cambian de un documento al
otro sin recargar la página. Sin javascript el índice es una lista de enlaces
que andan y cambiar de documento es navegar.

Las dos comparten cáscara: arriba la misma isla de la app y al costado el
índice, fijo mientras se lee. En el teléfono ese índice es un desplegable
cerrado, como los grupos del panel: el `<details>` viene abierto en el html, así
que sin javascript se ve entero. En `lg` el resumen que lo abre no se dibuja y
el índice se muestra igual aunque el `details` esté cerrado, con
`::details-content` detrás de un `@supports`, porque si eso dependiera del
estado del `details` una ventana agrandada podría quedarse sin índice y sin
forma de abrirlo.

Cambiar entre los dos documentos no recarga: se pide el html, se reemplaza el
`<main>`, se actualizan el título y el canonical y la url queda como si se
hubiera navegado, con el `popstate` atendido. El otro documento se trae medio
segundo después de cargar, así que el primer cambio no espera a la red.

Se sirven en `/terminos` y `/privacidad`, y como el build deja los archivos con
`.html` cada una necesita su `location =` en `deploy/nginx.conf`, igual que
`/admin`: el catch-all devolvería la app y la url quedaría mostrando el
buscador. Esa misma regla la repite un plugin en `web/vite.config.ts` para el
dev server y para `vite preview`, que si no devuelven la app entera, con React y
el worker de PDF, donde el servidor devuelve un documento de texto. Están en el
sitemap y se enlazan desde el panel de perfil, abajo del interruptor de
estadísticas.

La política describe el sistema tal cual está, así que cambiar qué sale del
navegador es cambiar el documento: el punto 4 lista campo por campo lo que
arman `web/src/lib/stats.ts` y `web/src/lib/events.ts`, y el punto 5 admite lo
único que el resto del diseño no evita, que el término de búsqueda viaja en la
query de `/api/jobs` y queda en el `access_log` de nginx junto a la ip.

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
JavaScript. Pero eso no alcanza para los scrapers de WhatsApp o LinkedIn, que no
ejecutan nada.

Por eso el contenido que se busca con intención alta tiene su propia dirección,
servida por la API y puesta delante de la app por nginx (`api/src/site.ts`):

| Ruta | Qué muestra |
|---|---|
| `/empleo/<id>` | La ficha de una oferta, con su descripción y su JSON-LD. Es la URL que se comparte. |
| `/mercado` | El informe del mercado. |
| `/rubro/<slug>` | Las ofertas de un rubro. |
| `/departamento/<nombre>` | Las ofertas de un departamento. |
| `/puesto/<slug>` | Las ofertas de un puesto. |

Son documentos HTML sueltos, sin React: el mismo patrón que `/terminos`. Un
scraper los lee enteros, así que un enlace compartido ya no previsualiza como la
portada. La app sigue siendo la experiencia: cada página enlaza a la vista
filtrada correspondiente. Además, la intro del onboarding dejó de tapar el
tablero: es una capa sobre la app montada, así que el listado se pide y se
dibuja igual en la primera visita.

El JSON-LD `JobPosting` sale solo en `/empleo/<id>` y solo cuando la oferta vive
acá de verdad: `source` igual a `jobit` y sin enlace de postulación externo
(`directApply`). Las scrapeadas no lo llevan y siguen enlazando al aviso
original, porque marcarlas como propias es lo que Google penaliza en los
agregadores. El canonical de cada página apunta a sí misma; el `?embed=` se marca
`noindex` en tiempo de ejecución.

## Cuentas

Para publicar servicios va a hacer falta una cuenta; buscar trabajo no. Es lo
único del sistema que se guarda en el servidor, y se guarda lo mínimo: handle,
nombre visible y hash de contraseña (argon2id). El email es opcional y solo
sirve para recuperar la cuenta, el segundo paso por TOTP es opcional, y los dos
van cifrados en reposo con una clave que vive en `JOBIT_SECRET_KEY_FILE`.

El login es por `handle`, no por email, justamente para que el email pueda
faltar. Quien no lo carga se lleva códigos de respaldo y se queda sin reset: los
códigos se muestran una sola vez y en la base queda su sha256. Nada de IP, user
agent, historial de inicios ni "último acceso desde"; las filas se estampan con
el día y nunca con la hora, igual que las estadísticas.

En la interfaz todo esto vive en la pestaña **Cuenta** del panel de
preferencias: el estado de la sesión, lo que se guarda del lado del servidor y
los botones de cada trámite. Crear la cuenta, entrar, recuperar el acceso,
cambiar la contraseña, el email o el segundo paso y borrar la cuenta abren el
mismo modal, cada uno con su pantalla.

El **sync entre navegadores** es opcional y viene apagado. Prendido, el servidor
guarda en `user_sync` un JSON que no interpreta —perfil, preferencias, guardadas,
postulaciones y fuentes propias— cifrado en reposo con la misma clave que el
email y el TOTP. Al entrar desde otro navegador se baja, se mezcla con lo local y
se vuelve a subir; lo que se acumula se une y lo que se elige de a uno lo gana el
navegador que estás usando. Apagarlo borra la fila.

La sesión es una cookie `jobit_session` (`HttpOnly`, `SameSite=Lax`, alcance
`/api`, 30 días con renovación) y en la base solo queda el sha256 del token. Es
otra sesión que la del panel: una cookie de usuario no abre `/api/admin` y una
del panel no abre `/api/me`. Probar contraseñas está limitado a diez intentos
cada quince minutos por dirección. `DELETE /api/me` borra de verdad: usuario,
sesiones, códigos y, cuando existan, los servicios publicados.

Better Auth quedó descartado a propósito: exige email para todo usuario, guarda
el token de sesión sin hashear y no cifra el secreto TOTP, las tres cosas que la
Zero Data Policy evita.

## Panel de administración

En `/admin`, con su propio bundle: quien entra a buscar trabajo no se baja el
código de administrar empresas. Tiene tres pestañas: **Empresas** y **Ofertas**,
que son la mitad operativa de que puedan publicar directo en vez de depender del
scrapeo, y **Uso**, que es lo único del sistema que mira el uso de todos juntos.

Uso lee de vuelta `stats.jsonl` y `events.jsonl` sobre una ventana de 7, 30 o 90
días: cuántos resúmenes llegaron, qué se buscó, qué búsquedas no devolvieron ni
una oferta, qué avisos concentran los clicks en "Postularme", qué filtros se
usan, y las guardadas, postulaciones, entrevistas y cerradas del período. Es de
solo lectura y no agrega ni un dato nuevo: cuenta filas que ya estaban escritas,
sin identificador y con el día y nunca la hora, así que sigue sin haber nada por
persona. Las búsquedas sin resultados son el único corte que dice qué se busca y
el tablero no tiene.

La credencial es un hash argon2id. El panel no tiene tabla de usuarios propia ni
clave en texto plano en ningún lado, y sin hash configurado el panel queda
apagado entero: `/api/admin` contesta 404, así que un despliegue sin configurar
se queda sin admin en vez de con un admin abierto.

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
| BuscoJobs Uruguay | Activa. El worker sale por el egress de la PC para que no le conteste 403 (ver abajo). |
| Uruguay Concursa | Activa. Llamados del Estado abiertos y próximos, con fecha de cierre. |
| Gallito | Pendiente. El sitio responde 403 detrás de Cloudflare y necesita un navegador headless. |

El worker consulta de a una petición por vez, con pausa entre pedidos, y cachea
las descripciones en `worker/cache/` para no volver a pedirlas. Es una
herramienta de uso personal: no republica las ofertas, siempre enlaza al aviso
original.

Si una fuente vuelve vacía, el worker conserva lo que esa misma fuente había
dejado en la corrida anterior (`worker/src/keep.ts`) en vez de escribir cero.
Un 403 no puede vaciar el tablero.

## Scrapeo, agenda y salida por proxy

El scrapeo corre en el VPS cada seis horas (`deploy/jobit-scrape.timer`). Pero
BuscoJobs le contesta 403 a la IP del VPS, que es de datacenter, así que el
worker sale a internet por el egress de la PC: una máquina con IP limpia presta
su salida con `bun run egress` (`worker/src/egress.ts`, un proxy CONNECT mínimo,
sin dependencias).

En la PC:

```bash
EGRESS_HOST=<ip-del-tailnet> EGRESS_PORT=8787 EGRESS_TOKEN=<clave> bun run egress
```

En el VPS, en `worker/.env` (que es el que Bun carga cuando corre el service):

```
JOBIT_SCRAPE_PROXY=http://:<clave>@<ip-del-tailnet>:8787
JOBIT_HEARTBEAT_URL=https://hc-ping.com/...
```

`JOBIT_HEARTBEAT_URL` se pinguea **solo cuando BuscoJobs vino fresco**: es el
canario de que el egress sigue vivo, y si la señal deja de llegar un monitor
avisa. Si algún día se contrata un proxy residencial pago, `JOBIT_SCRAPE_PROXY`
apunta ahí y la PC deja de hacer falta: es cambiar una variable.

### Cargar las ofertas a mano

Si preferís no depender de la agenda, `bun run scrape:push` hace el scrapeo y lo
sube por HTTP. Es `bun run scrape` seguido de `bun run push`, que manda
`worker/output/jobs.json` a `POST /api/ingest/jobs`. La API lo valida, lo escribe
al lado y renombra, y como relee por mtime queda servido sin reiniciar nada.

La configuración de la máquina que scrapea va en **`worker/.env`**
(`worker/.env.example` tiene todas las variables):

```
JOBIT_INGEST_URL=https://jobs.wefaber.net/api/ingest/jobs
JOBIT_INGEST_TOKEN=<el mismo que INGEST_TOKEN_FILE en el servidor>
```

La credencial es un token propio y no la sesión del panel: quien scrapea es una
máquina, y lo único que tiene que poder hacer es reemplazar el archivo de
ofertas. Sin token configurado del lado de la API la ruta contesta 404, igual
que `/api/admin`.

Tres cosas que la ingesta no deja pasar, porque las tres borrarían el tablero
por accidente: un archivo sin ofertas, un archivo que no tiene la forma de
`jobs.json`, y un archivo más viejo que el que ya está publicado. El cuerpo
viaja comprimido (cinco megas se van en poco más de uno) y también se acepta el
JSON pelado, así que a mano es:

```bash
gzip -c worker/output/jobs.json | curl -sS -X POST --data-binary @- \
  -H "authorization: Bearer $JOBIT_INGEST_TOKEN" \
  -H "content-type: application/octet-stream" \
  https://jobs.wefaber.net/api/ingest/jobs
```

## Licencia

Apache License 2.0. El código se puede usar, modificar y redistribuir; hay que
conservar `LICENSE` y `NOTICE`, y mencionar JobIt como proyecto original
(`https://github.com/faku-org/jobit`, `https://jobs.wefaber.net`). El nombre,
el logo y la identidad visual son de Faber y no van con esa licencia.
