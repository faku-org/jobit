# Plan — issues 1, 3, 4, 5 y 7

Plan de construcción de los cinco issues abiertos que quedan, en el orden en que
se van a ejecutar. Cada issue vive en su propia rama (`feat/*`) creada desde
`develop`, con su worktree, y se integra por PR.

| # | Rama | Estado de ejecución |
|---|---|---|
| 1 | `feat/mcp` | **Ejecutar ahora** |
| 4 | `feat/ejercicios` | **Ejecutar ahora** |
| 3 | `feat/faq-rubros` | Planificado |
| 5 | `feat/recursos` | Planificado |
| 7 | `feat/analista` | Planificado |

Los issues 3, 5 y 7 comparten una pieza que hoy no existe: un **sistema de
contenido** (traer, normalizar y servir contenido curado por rubro/puesto). Se
diseña una sola vez, acá, y los tres la consumen. El issue 4 también la usa,
por eso su ejecución incluye la versión mínima de esa pieza.

---

## Pieza compartida: sistema de contenido

### Problema

Hoy JobIt calcula todo (ofertas, mercado, ranking) y no guarda ningún contenido
redactado. Los issues 3, 4, 5 y 7 necesitan lo contrario: contenido que hay que
**traer y curar** (preguntas de entrevista, ejercicios, cursos, contexto del
país) y después **aplicar automáticamente al contenido relacionado** (una oferta
de un rubro muestra las preguntas de ese rubro; confirmar una postulación
muestra los ejercicios de esa área).

### Decisión

Un flujo igual al del scraper de ofertas, pero para contenido:

```
fuentes (URLs base)  →  ingesta (adapters)  →  content.json + seed  →  API  →  web / páginas SEO
   sources.ts              ingest.ts             worker/output            /api/content   PrepTips, secciones
```

- **No hay que escribir contenido a mano en el código para que funcione**: un
  `seed.ts` versionado arranca el sistema (FAQ y ejercicios de varios rubros) y
  la ingesta lo amplía.
- **La ingesta es reproducible y respetuosa**: una petición por fuente, con
  `User-Agent` propio, timeout, caché en `worker/cache/content/` y una nota de
  robots/ToS por adapter. No se republica contenido ajeno: cada ítem lleva su
  `url` y su fuente, y el cuerpo es un resumen, no una copia.
- **Enlaces pagos marcados desde el día uno**: el modelo tiene `sponsored` y la
  web debe emitir `rel="sponsored"` cuando esté en `true` (issue 5). Retrofitear
  eso sobre un directorio ya monetizado es lo caro, no agregarlo ahora.

### Modelo de datos

`worker/src/content/types.ts`:

```ts
export type ContentKind =
  | "faq"       // preguntas frecuentes de entrevista (issue 3)
  | "topic"     // habilidades/temas por rubro (issue 3)
  | "exercise"  // ejercicios de práctica (issue 4)
  | "resource"  // cursos, docs, podcasts, videos (issue 5)
  | "context";  // noticias, entrevistas, política (issue 7)

export interface ContentItem {
  id: string;              // estable: hash de source+url
  kind: ContentKind;
  title: string;
  body: string;            // texto o markdown corto; nunca la página ajena entera
  url: string | null;      // fuente original
  source: string;          // id de la fuente
  source_label: string;
  license: string | null;
  sponsored: boolean;      // true → rel="sponsored"
  categories: string[];    // slugs de rubro (worker/src/categories.ts)
  roles: string[];         // slugs de puesto (worker/src/roles.ts)
  level: "entry" | "mid" | "senior" | null;
  tags: string[];
  fetched_at: string;
}
```

`worker/src/content/sources.ts`: registro de fuentes base.

```ts
export interface ContentSource {
  id: string;
  label: string;
  base: string;                       // p. ej. https://www.w3schools.com
  kind: ContentKind;
  adapter: "rss" | "html-links" | "json" | "manual";
  categories: string[];               // a qué rubros se aplica lo traído
  roles?: string[];
  sponsored?: boolean;
  license?: string;
  config?: Record<string, unknown>;   // selector, patrón de link, mapeo de campos
}
```

### Tareas

- [ ] `worker/src/content/types.ts` — tipos, `contentId()` (hash estable), validación.
- [ ] `worker/src/content/sources.ts` — registro inicial: docs de referencia
      (W3Schools, MDN, GeeksforGeeks), práctica (LeetCode, HackerRank), podcasts y
      canales locales, y las fuentes de contexto del issue 7.
- [ ] `worker/src/content/adapters.ts` — `rss`, `html-links`, `json`, sin
      dependencias (mismo espíritu que `worker/src/egress.ts`).
- [ ] `worker/src/content/seed.ts` — contenido curado de arranque (commiteado).
- [ ] `worker/src/content/ingest.ts` — CLI: lee `sources.ts`, aplica adapters,
      deduplica por `contentId`, escribe `worker/output/content.json`.
- [ ] `worker/package.json` — exports `./content/types`, `./content/sources`,
      `./content/seed`; script `content`.
- [ ] `api/src/content.ts` — carga `content.json` (ruta `CONTENT_FILE`, por
      defecto `worker/output/content.json`) y lo mezcla con el seed; consulta por
      `category`, `role`, `kind`, `q`, `limit`.
- [ ] `api/src/index.ts` — `GET /api/content`.
- [ ] `web/src/lib/content.ts` — tipos y `fetchContent`.
- [ ] Tests: adapter sobre fixture HTML/XML, carga+merge del API, filtro por rubro.
- [ ] README — sección "Contenido".

### Criterios de aceptación

- `bun run --cwd worker content` regenera `content.json` sin tocar el repo.
- Sin `content.json`, `/api/content` responde con el seed (nunca vacío para los
  rubros sembrados).
- Un ítem `sponsored` sale marcado así en el JSON y la web lo enlaza con
  `rel="sponsored"`.
- Los tests corren sin red (adapters sobre fixtures).

---

## Issue 4 — Ejercicios de práctica al confirmar una postulación

**Rama:** `feat/ejercicios`. **Depende de:** sistema de contenido (versión mínima,
incluida acá).

### Qué pide

Cuando la persona confirma que mandó la postulación, ofrecerle ejercicios de
prueba o preguntas frecuentes del área para prepararse. El momento es el que
importa: se activa al confirmar, cuando la preparación tiene fecha.

### Diseño

- El disparador ya existe: `ApplyFooter` (`onApplied`) → `JobModal`. Se agrega un
  panel **"Para prepararte"** que aparece cuando la oferta queda en seguimiento.
- El contenido sale de `/api/content?category=<slug>&kind=exercise,faq`, es
  decir del sistema compartido. Si no hay nada para ese rubro, no se dibuja
  nada (nunca un panel vacío).
- Cada ítem es un desplegable (pregunta → respuesta sugerida) o una tarjeta con
  enlace al ejercicio, según el `kind`. Todo enlace externo sale con
  `rel="noreferrer noopener"` y `rel="sponsored"` si corresponde.
- Nada de esto se guarda ni viaja: es contenido público, se pide al abrir.

### Tareas

- [ ] Sistema de contenido (bloque de arriba): tipos, seed, `api/src/content.ts`,
      `GET /api/content`, `web/src/lib/content.ts`.
- [ ] `web/src/hooks/usePrep.ts` — trae el contenido del rubro de la oferta, con
      caché en memoria por rubro y abort al desmontar.
- [ ] `web/src/components/job/PrepTips.tsx` — panel con FAQ y ejercicios, con
      animación de entrada, sin estado vacío visible.
- [ ] `web/src/components/job/JobModal.tsx` — montar el panel bajo la descripción
      cuando `isApplied` (recién confirmada o ya seguida).
- [ ] Seed: FAQ y ejercicios reales para al menos `tecnologia`, `ventas`,
      `atencion-cliente`, `administracion` y `produccion`.
- [ ] Tests: `usePrep` filtra por rubro y deduplica; render sin contenido oculto.
- [ ] README — una línea en la sección de seguimiento.

### Criterios de aceptación

- Confirmar una postulación muestra, en el acto, preguntas y ejercicios del rubro.
- Un rubro sin contenido no muestra panel (no hay caja vacía).
- No se agrega ninguna petición en el camino crítico del tablero: el contenido se
  pide recién al abrir/confirmar.

---

## Issue 1 — Servidor MCP para buscar ofertas desde un agente

**Rama:** `feat/mcp`. **Depende de:** nada (`GET /api/jobs` ya existe).

### Qué pide

Exponer la búsqueda como servidor MCP para que el agente de alguien busque
ofertas de forma automatizada. La API ya tiene todo detrás: es una capa de
herramientas encima.

### Diseño

- Nuevo workspace `mcp/` (`@jobit/mcp`), proceso aparte que habla MCP por
  **stdio** y llama a la API por HTTP. No importa el código de la API: se
  desacopla quién sirve el tablero y permite apuntar a producción o a un
  self-host con una variable.
- Variable `JOBIT_API_URL` (por defecto `https://jobs.wefaber.net`).
- Herramientas:
  - `search_jobs` → `GET /api/jobs` (q, category, department, level, remote,
    job_type, no_experience, days, source, sort, limit, offset).
  - `get_job` → `GET /api/jobs/:id`, con descripción.
  - `market_overview` → `GET /api/market`.
  - `list_filters` → `GET /api/meta` (rubros, departamentos, fuentes, total).
- SDK oficial `@modelcontextprotocol/sdk`; el transporte por stdio es el que
  esperan Claude Desktop / Cursor / cualquier cliente MCP.
- Respuesta de error legible (la API caída no debe romper el protocolo).

### Tareas

- [ ] `mcp/package.json` + registro en los workspaces de la raíz.
- [ ] `mcp/src/client.ts` — cliente HTTP tipado sobre la API (`JOBIT_API_URL`).
- [ ] `mcp/src/tools.ts` — definición de las cuatro herramientas.
- [ ] `mcp/src/server.ts` — `McpServer` + `StdioServerTransport`.
- [ ] `mcp/src/index.ts` — entrypoint con shebang para `bun`.
- [ ] Tests (`bun:test`): armado de query, resultados y error de red con `fetch`
      falso; nunca tocan la red.
- [ ] README — sección "Desde un agente (MCP)" con el JSON de configuración.
- [ ] `mcp/README.md` — instalación y uso.

### Criterios de aceptación

- `bun run --cwd mcp start` levanta y responde `initialize` por stdio.
- Las cuatro herramientas devuelven datos reales contra una API local.
- Con la API caída, la herramienta devuelve un error en texto, no un crash.
- `bun run typecheck` y `bun test` pasan desde la raíz.

---

## Issue 3 — Preguntas frecuentes y habilidades por rubro

**Rama:** `feat/faq-rubros`. **Depende de:** sistema de contenido.

### Qué pide

Mostrar, por rubro o puesto, las preguntas más repetidas en entrevistas y las
habilidades blandas/temas relevantes. Y que sea indexable: es contenido de
intención alta ("preguntas de entrevista para X en Uruguay"). Hoy la app ya tiene
contenido indexable por ruta (`api/src/site.ts`), así que se apoya en eso.

### Diseño

- Contenido `kind: "faq"` y `kind: "topic"`, por rubro (`categories`) y puesto
  (`roles`).
- Página SEO `/entrevista/<rubro>` y `/entrevista/<rubro>/<puesto>` servida por
  la API, con `FAQPage` en JSON-LD y el listado de ofertas del rubro al pie
  (enlace a la app). Se suma al sitemap.
- En la web, bloque **"Prepará tu entrevista"** reutilizable: en la ficha de la
  oferta (issue 4) y en el tablero filtrado por rubro.

### Tareas

- [ ] Seed + fuentes de FAQ/temas por rubro y por puesto (adapters del sistema de
      contenido).
- [ ] `api/src/pages.ts` — `interviewPageHtml` con `FAQPage` + enlaces; ruta en
      `api/src/site.ts`; entrada en `/sitemap.xml`.
- [ ] `web/` — componente compartido de FAQ/habilidades; punto de entrada desde
      la ficha y desde el rubro.
- [ ] `deploy/nginx.conf` + `web/vite.config.ts` — `location ^~ /entrevista/` y
      proxy equivalente en dev.
- [ ] Tests de la página (JSON-LD, canonical, 404 sin rubro).
- [ ] README — rutas nuevas.

### Criterios de aceptación

- `/entrevista/tecnologia` devuelve HTML con preguntas, `FAQPage` válido y
  canonical propio.
- Está en el sitemap y enlaza a la vista filtrada de la app.
- Sin contenido de un rubro, la ruta responde 404 (no una página vacía).

---

## Issue 5 — Recursos y cursos por área

**Rama:** `feat/recursos`. **Depende de:** sistema de contenido.

### Qué pide

Una sección de recursos por área: plataformas de práctica, documentación de
referencia, cursos, podcasts y videos. Es una de las vías monetizables: las
plataformas pueden pagar por aparecer, con `rel="sponsored"` desde el día uno.

### Diseño

- Contenido `kind: "resource"`, con subtipo en `tags` (`plataforma`, `curso`,
  `documentacion`, `podcast`, `video`).
- Sección **Recursos** en la web (pestaña propia, como Servicios/Mercado) y
  páginas SEO `/recursos/<rubro>`.
- Ingesta desde URLs base (W3Schools, MDN, GeeksforGeeks, LeetCode, canales
  locales) mediante adapters; el registro de fuentes declara rubro, licencia y
  si es pago.
- **Monetización:** `sponsored` marca el enlace; se agrega moderación para
  marcar/quitar el patrocinio desde el panel (reutiliza el patrón de
  `api/src/moderation.ts`). Nunca se mezcla un pago con el orden sin decirlo:
  el orden por defecto es por rubro y relevancia, y lo pago se rotula.

### Tareas

- [ ] Fuentes y seed de recursos por rubro (adapters).
- [ ] `api/src/pages.ts` — `resourcesPageHtml`; ruta + sitemap.
- [ ] `web/src/components/resources/` — sección con filtros por rubro y subtipo;
      `rel="sponsored"` cuando corresponde.
- [ ] Moderación del patrocinio en el panel (`api/src/admin.ts`, `web/src/admin/`).
- [ ] nginx + vite proxy para `/recursos/`.
- [ ] Tests: marcado `rel`, filtro, página SEO, sitemap.
- [ ] README — sección Recursos y política de enlaces pagos.

### Criterios de aceptación

- Todo enlace `sponsored: true` sale con `rel="sponsored"` en web y en la página
  SEO; hay un test que lo impide retroceder.
- `/recursos/<rubro>` es indexable, con canonical y enlaces rotulados.
- La sección no depende de la ingesta: con el seed ya se ve completa.

---

## Issue 7 — Vista analista del mercado

**Rama:** `feat/analista`. **Depende de:** sistema de contenido (contexto) y de
**histórico de mercado** (nuevo).

### Qué pide

Una vista para quien investiga el mercado en vez de buscar trabajo: patrones,
posibilidades, y fuentes de contexto que hoy no están (entrevistas, noticias del
país, decisiones políticas recientes) más una extrapolación. Se apoya en lo que
ya hay en Mercado; lo nuevo es el contexto externo y la proyección.

### Diseño

- **Histórico:** el informe de mercado es una foto, y sin serie no hay
  extrapolación. Al correr el scrapeo se guarda una fila por día
  (`data/market-history.jsonl`, `MARKET_HISTORY_FILE`): totales, puesto, rubro,
  departamento y sueldo. Es el insumo de las tendencias.
- **Tendencias (`api/src/trends.ts`):** sobre la serie, variación por rubro y
  puesto (7/30/90 días), qué crece y qué cae, y una extrapolación explícita como
  tal ("si sigue el ritmo de los últimos N días…"), nunca como predicción.
- **Contexto (`kind: "context"`):** notas, entrevistas y decisiones recientes,
  traídas por el sistema de contenido, asociadas a rubros. Cada una con fuente y
  fecha; nada sin fuente.
- **UI:** la vista existe como pestaña propia (`analista`) o dentro de Mercado,
  con dos bloques: *El mercado en el tiempo* (tendencias) y *Contexto* (notas
  enlazadas). Exportable como CSV/XLSX junto al informe actual.

### Tareas

- [ ] Persistencia del histórico en cada scrapeo (`worker` o `api/src/market.ts`).
- [ ] `api/src/trends.ts` — serie, variaciones y extrapolación con supuestos
      explícitos.
- [ ] `GET /api/market/trends` + columnas extra en `/api/market.csv|xlsx`.
- [ ] Fuentes y seed de contexto por rubro.
- [ ] `web/src/components/market/` — bloques de tendencia y contexto.
- [ ] Página SEO `/mercado` ampliada (o `/mercado/informe`).
- [ ] Tests: tendencia con serie sintética, extrapolación acotada, contexto por
      rubro.
- [ ] README — sección "Vista analista".

### Criterios de aceptación

- Con menos de dos puntos en la serie, no se inventa tendencia: se dice que
  falta historial.
- La extrapolación declara el período y los supuestos.
- Cada nota de contexto muestra fuente y fecha.

---

## Orden sugerido y dependencias

```
1 (MCP)            ─┐
4 (ejercicios) ──┐  │
                 │  └── independientes/dueños de la pieza mínima
    pieza de contenido
        ├── 3 (FAQ por rubro)
        ├── 5 (recursos)
        └── 7 (analista)  ← además: histórico de mercado
```

1 y 4 se ejecutan en paralelo (ramas distintas, sin archivos en común salvo el
`README.md`, que conviene tocar en el `CHANGELOG` de cada PR para no chocar).
3, 5 y 7 se ejecutan después, cuando la pieza de contenido ya esté en `develop`,
cada uno extendiendo `sources.ts` y `seed.ts` sin tocar el núcleo.
