# jobit

Buscador de ofertas de trabajo de Uruguay, de todos los rubros, pensado para
encontrar el primer empleo: filtros por rubro, departamento y jornada, marca de
"sin experiencia", lista de guardadas y descarte de las que ya viste.

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

Parámetros de `/api/jobs`, todos opcionales y combinables:

| Parámetro | Valores |
|---|---|
| `q` | Texto libre sobre título, empresa, ubicación, rubro y descripción. |
| `category` | Slug de rubro (`ventas`, `oficios`, `salud`, ...). |
| `department` | Departamento tal cual lo publica la fuente. |
| `level` | `entry`, `mid`, `senior`. |
| `remote` | `remote`, `hybrid`. |
| `job_type` | `full_time`, `part_time`, `internship`. |
| `no_experience` | `true` para ofertas que no piden experiencia previa. |
| `days` | Solo ofertas de los últimos N días. |
| `ids` | Lista de ids separados por coma. |
| `limit` / `offset` | Paginado. `limit` por defecto 50, máximo 200. |

Variables de entorno: `PORT` (3000), `JOBS_FILE` (ruta al JSON del worker),
`CORS_ORIGIN` (origen del dev server de Vite).

## Fuentes

| Fuente | Estado |
|---|---|
| BuscoJobs Uruguay | Activa. Listados por rubro y detalle por oferta. |
| Gallito | Pendiente. El sitio responde 403 detrás de Cloudflare y necesita un navegador headless. |

El worker consulta de a una petición por vez, con pausa entre pedidos, y cachea
las descripciones en `worker/cache/` para no volver a pedirlas. Es una
herramienta de uso personal: no republica las ofertas, siempre enlaza al aviso
original.
