# Worker (scrapers)

Trae ofertas de portales uruguayos y escribe `worker/output/jobs.json`. Es una
herramienta de uso personal: no republica las ofertas, siempre enlaza al aviso
original.

## Correr

```bash
bun run scrape          # scrapeo completo (la primera vez ~15 min por las descripciones)
bun run push            # sube worker/output/jobs.json a una API remota
bun run scrape:push     # las dos cosas
bun run --cwd worker start   # equivalente a scrape
```

La configuración va en **`worker/.env`** (Bun carga el de ese directorio cuando
corre el worker). `worker/.env.example` tiene todo.

| Variable | Para qué |
|---|---|
| `JOBIT_INGEST_URL` | URL de `POST /api/ingest/jobs`. |
| `JOBIT_INGEST_TOKEN` | El mismo token que `INGEST_TOKEN_FILE` en el servidor. |
| `JOBIT_SCRAPE_PROXY` | Proxy de salida (`http://usuario:clave@host:puerto`). |
| `JOBIT_HEARTBEAT_URL` | Se pinguea solo cuando BuscoJobs vino fresco. |

## Fuentes

| Fuente | Estado |
|---|---|
| BuscoJobs Uruguay | Activa. Necesita salir por una IP limpia (ver abajo). |
| Uruguay Concursa | Activa. Llamados del Estado, con fecha de cierre. |
| Gallito | Pendiente (403 de Cloudflare; necesitaría navegador headless). |

El worker pide de a una petición por vez, con pausa, y cachea las descripciones
en `worker/cache/`. Si una fuente vuelve vacía, conserva lo que esa fuente había
dejado en la corrida anterior (`worker/src/keep.ts`): un 403 no puede vaciar el
tablero.

## Salida por proxy (egress)

BuscoJobs contesta 403 a la IP del VPS. El scrapeo corre en el VPS pero sale a
internet por el egress de una PC:

**En la PC:**

```bash
EGRESS_HOST=<ip-del-tailnet> EGRESS_PORT=8787 EGRESS_TOKEN=<clave> bun run egress
```

**En el VPS** (`worker/.env`):

```
JOBIT_SCRAPE_PROXY=http://:<clave>@<ip-del-tailnet>:8787
JOBIT_HEARTBEAT_URL=https://hc-ping.com/...
```

Si algún día se usa un proxy residencial pago, `JOBIT_SCRAPE_PROXY` apunta ahí y
la PC deja de hacer falta.

## Agenda

`deploy/jobit-scrape.timer` corre `jobit-scrape.service` cada seis horas. Con
cron sería:

```
15 */6 * * * cd /srv/jobit/worker && PATH=/opt/bun:$PATH /opt/bun/bun run src/index.ts
```

## Cargar a mano

```bash
gzip -c worker/output/jobs.json | curl -sS -X POST --data-binary @- \
  -H "authorization: Bearer $JOBIT_INGEST_TOKEN" \
  -H "content-type: application/octet-stream" \
  https://jobs.wefaber.net/api/ingest/jobs
```

La ingesta rechaza un archivo sin ofertas, uno que no tiene la forma de
`jobs.json` y uno más viejo que el publicado: las tres cosas borrarían el
tablero por accidente.

## Test

```bash
cd worker && bun test
bun run --cwd worker typecheck
```
