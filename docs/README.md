# Documentación

Todo lo que hace falta para levantar, usar y mantener JobIt. Cada documento es
una sección y arranca con los pasos para ejecutarla.

| Documento | Qué cubre |
|---|---|
| [`api.md`](api.md) | La API: correrla, variables de entorno, endpoints, límites. |
| [`web.md`](web.md) | La web: entradas, dev, build, estructura. |
| [`worker.md`](worker.md) | Los scrapers, el egress y la agenda. |
| [`database.md`](database.md) | El esquema SQLite, las migraciones y los respaldos. |
| [`company-panel.md`](company-panel.md) | El panel de empresa de punta a punta. |
| [`deploy.md`](deploy.md) | Puesta en producción (resumen; el detalle está en `deploy/`). |
| [`faq.md`](faq.md) | Preguntas frecuentes. |

Para el panorama general ver [`../Architecture.md`](../Architecture.md) y para
las convenciones de interfaz [`../DESIGN.md`](../DESIGN.md).

## Arranque rápido

Requisitos: [Bun](https://bun.sh). Nada más.

```bash
bun install

# Configuración de la API (opcional para lo básico)
cp api/.env.example api/.env

# Panel de admin (si lo vas a usar)
bun -e 'await Bun.write("data/admin.hash", await Bun.password.hash(prompt("clave: ")))'
# y en api/.env descomentá ADMIN_PASSWORD_HASH_FILE=../data/admin.hash y
# ADMIN_INSECURE_COOKIES=true para desarrollo sobre http://

# Clave de cifrado (obligatoria para cuentas de empresa)
bun -e 'await Bun.write("data/secret.key", Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url"))'
# y en api/.env descomentá JOBIT_SECRET_KEY_FILE=../data/secret.key

# Ofertas de ejemplo
bun run scrape        # o poné un jobs.json en worker/output/
# o bien:
bun run dev           # API en :3000 y web en :5173
```

Abrí `http://localhost:5173`. La web proxea `/api` hacia la API.

| URL | Qué es |
|---|---|
| `http://localhost:5173/` | El tablero. |
| `http://localhost:5173/empresas` | El panel de empresa. |
| `http://localhost:5173/admin` | El panel de administración. |

## Comandos de la raíz

```bash
bun run dev          # API + web
bun run dev:api      # solo la API
bun run dev:web      # solo la web
bun run build        # build de la web
bun run typecheck    # tipos de api, web y worker
bun run lint         # oxlint
bun run fmt          # oxfmt
bun run scrape       # trae ofertas
bun run scrape:push  # trae y sube a una API remota
bun run egress       # proxy de salida para el scraper
```
