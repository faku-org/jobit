# Web

React 19 + Vite + TailwindCSS v4. Tiene varias entradas porque cada público se
baja solo lo suyo.

## Correr

```bash
bun run dev:web        # http://localhost:5173 (proxea /api a la API)
bun run build          # build de producción
bun run --cwd web preview
bun run --cwd web typecheck
cd web && bun test
```

En desarrollo, `web/vite.config.ts` proxea `/api`, `/empleo`, `/mercado`,
`/rubro`, `/departamento` y `/puesto` hacia la API, y resuelve `/empresas`,
`/admin`, `/terminos` y `/privacidad` igual que nginx en producción.

## Entradas

| Archivo | Ruta | Bundle | Para quién |
|---|---|---|---|
| `index.html` | `/` | `src/main.tsx` | El tablero. |
| `empresas.html` | `/empresas` | `src/empresas/main.tsx` | El panel de empresa. |
| `admin.html` | `/admin` | `src/admin/main.tsx` | El panel de administración. |
| `terminos.html` | `/terminos` | `src/legal.ts` | Términos. Sin React. |
| `privacidad.html` | `/privacidad` | `src/legal.ts` | Privacidad. Sin React. |

## Estructura

```
src/
  main.tsx            entrada del tablero
  App.tsx             el tablero
  index.css           tokens de Tailwind (@theme) y base
  components/
    board/            isla, filtros, pestañas, seguimiento
    job/              tarjeta y ficha de una oferta
    market/           el informe del mercado
    profile/          onboarding, perfil y preferencias
    account/          cuenta de usuario (alta, login, 2FA, sync)
    ui/               piezas chicas (embeds, confirmaciones, aura…)
  admin/              panel de administración
  empresas/           panel de empresa (ver docs/company-panel.md)
  lib/                lógica sin React (filtros, query, formato, sesión, países…)
  hooks/              hooks de React
  legal.ts            el JS mínimo de las legales
```

## Estilo

Los tokens están en `web/src/index.css` con `@theme` de Tailwind v4 y se usan
por nombre (`bg-panel`, `text-ink`, `border-sky`). El tema oscuro redefine los
valores bajo `[data-theme="dark"]`; el tema se pinta antes del primer render
desde cada `*.html`. Las convenciones completas están en
[`../DESIGN.md`](../DESIGN.md).

## Rutas y CLI

`curl` de una URL del tablero devuelve el listado en texto: nginx (y el dev
server) reescriben `/` a `/api/cli` cuando el cliente es `curl` o pide
`text/plain`. La lista de User-Agents está en `web/vite.config.ts` y en
`deploy/nginx.conf`; un cambio hay que repetirlo en los dos.
