# API

Bun + Elysia. Sirve el tablero, las cuentas, el panel de empresa, las imágenes y
las páginas indexables. Escucha en `127.0.0.1` por defecto: en producción nginx
es el único que llega.

## Correr

```bash
bun run dev:api                 # con recarga en caliente
bun run --cwd api start         # sin recarga
bun run --cwd api test          # tests
bun run --cwd api typecheck     # tipos
```

La configuración va en **`api/.env`** (no en la raíz): la API arranca con
`bun run --cwd api start`, así que Bun carga el `.env` de ese directorio.
`api/.env.example` tiene todo comentado.

## Variables de entorno

| Variable | Por defecto | Qué hace |
|---|---|---|
| `PORT` | `3000` | Puerto. En el VPS es `3200`. |
| `HOST` | `127.0.0.1` | Interfaz. No lo abras salvo que sepas por qué. |
| `CORS_ORIGIN` | `http://localhost:5173` | Orígenes permitidos, separados por coma. |
| `JOBS_FILE` | `worker/output/jobs.json` | El JSON del scraper. |
| `DB_FILE` | `data/jobit.db` | SQLite de empresas, ofertas y cuentas. |
| `STATS_FILE` | `data/stats.jsonl` | Resúmenes anónimos de uso. |
| `EVENTS_FILE` | `data/events.jsonl` | Eventos anónimos de uso. |
| `UPLOADS_DIR` | `data/uploads` | Logo y banner de empresas. |
| `ADMIN_PASSWORD_HASH_FILE` | — | Archivo con el hash del panel. Sin él, `/api/admin` da 404. |
| `ADMIN_PASSWORD_HASH` | — | El hash inline (hay que escapar cada `$` como `\$`). |
| `ADMIN_INSECURE_COOKIES` | — | `true` saca `Secure` de las cookies. Solo desarrollo. |
| `INGEST_TOKEN_FILE` | — | Token de ingesta. Sin él, `/api/ingest` da 404. |
| `INGEST_TOKEN` | — | El token inline. |
| `JOBIT_SECRET_KEY_FILE` | — | Clave de 32 bytes que cifra email, TOTP y sync. |
| `JOBIT_SECRET_KEY` | — | La clave inline (base64, base64url o hex). |
| `RESEND_API_KEY` | — | Clave de Resend. Sin ella, los correos van al log. |
| `MAIL_FROM` | — | Remitente de los correos, con dominio verificado en Resend. |
| `PUBLIC_ORIGIN` | `https://jobs.wefaber.net` | Origen de los enlaces en correos y del canonical. |

## Endpoints

### Públicos del tablero

| Ruta | Descripción |
|---|---|
| `GET /health` | Estado. |
| `GET /api/jobs` | Ofertas filtradas y paginadas (`format=txt` para texto). |
| `GET /api/jobs.txt` | El mismo listado en texto. |
| `GET /api/jobs/:id` | Una oferta completa. |
| `GET /api/meta` | Conteo, fecha de scrape, fuentes y facetas. |
| `GET /api/market` | El informe del mercado. |
| `GET /api/market.csv` / `.xlsx` | Ese informe para bajar. |
| `GET /api/cli` | La URL del tablero, en texto, para `curl`. |

Parámetros de `/api/jobs`: `q`, `category`, `department`, `level`, `remote`,
`job_type`, `no_experience`, `days`, `source`, `sort`, `ids`, `limit`, `offset`,
`format`. Los de lista aceptan varios valores separados por coma.

### Páginas indexables

Servidas por la API y puestas delante de la app por nginx: `/empleo/<id>`,
`/mercado`, `/rubro/<slug>`, `/departamento/<nombre>`, `/puesto/<slug>`.

### Cuentas de usuario

`POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/totp`,
`POST /api/auth/recover`, `POST /api/auth/logout`, y con sesión
`GET`/`PATCH`/`DELETE /api/me`, `POST`/`DELETE /api/me/totp`,
`GET`/`PUT`/`DELETE /api/me/sync`. El login es por handle; el email es opcional.

### Panel de empresa

`/api/empresas/...`. Ver [`company-panel.md`](company-panel.md) para el flujo
completo y el [`README.md`](../README.md) para la tabla de rutas.

### Panel de administración

Todo bajo `/api/admin` y apagado entero si falta el hash. Incluye login, listado
y edición de empresas y ofertas, y `/api/admin/usage` con el uso agregado.

### Ingesta y estadísticas

| Ruta | Descripción |
|---|---|
| `POST /api/ingest/jobs` | Recibe el `jobs.json` (pide token). |
| `POST /api/stats` | Resumen anónimo de uso. |
| `POST /api/events` | Lote de hasta 20 eventos anónimos. |

## Límites de peticiones

Por dirección y en memoria (`api/src/limit.ts`):

| Bucket | Ventana | Máximo |
|---|---|---|
| Lecturas | 1 minuto | 120 |
| Escrituras | 1 hora | 20 |
| Eventos | 1 hora | 60 |
| Auth (login, alta, TOTP) | 15 minutos | 10 |

## Test

```bash
bun run --cwd api test
```

Los tests usan `DB_FILE=:memory:` y no tocan la red. El servicio de correo, sin
`RESEND_API_KEY`, escribe en el log en vez de mandar.
