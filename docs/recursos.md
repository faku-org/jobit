# Recursos por rubro (issue 5)

Una sección de recursos para aprender y practicar en cada rubro: plataformas de
práctica, documentación, cursos, videos y podcasts. Es una vía monetizable (las
plataformas podrían pagar por aparecer), así que la política de enlaces pagos
está en el código desde el primer día.

## Qué hay

| Pieza                                   | Dónde                                                                                   |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| Catálogo curado (41 enlaces, 15 rubros) | `worker/src/content/resources.ts` (entra al seed)                                       |
| Verificador de enlaces (manual)         | `bun run --cwd worker content:verify`                                                   |
| Consulta                                | `GET /api/content?kind=resource&category=<rubro>` (ya existía, #40)                     |
| Página indexable                        | `/recursos/<rubro>` y el índice `/recursos` (`api/src/resources.ts`, `api/src/site.ts`) |
| Sitemap                                 | `/recursos` y una entrada por rubro con recursos                                        |
| Bloque en la app                        | "Recursos para practicar en <rubro>" al filtrar por rubro (`RubroResources`)            |
| nginx / vite                            | `location = /recursos` y `location ^~ /recursos/`; proxy `/recursos` en dev             |

Un rubro sin recursos da 404 (no una página vacía) y el bloque de la app no se
dibuja. Rubros sin recursos hoy: `otros`.

## Modelo

Es el `ContentItem` de #40 con `kind: "resource"`:

- `tags[0]` = subtipo: `plataforma`, `documentacion`, `curso`, `video`, `podcast`.
- `tags[1]` = idioma: `es` o `en`.
- `url` = el recurso; `source_label` = quién lo publica.
- `sponsored` = patrocinio. **Obligatorio y sin valor por defecto** en el
  catálogo: quien agrega un recurso tiene que decidirlo.
- `fetched_at` = fecha en que se verificó que la URL responde.

## Política de enlaces pagos

1. Todo enlace saliente lleva `rel="noopener noreferrer"`. Si el recurso es
   `sponsored: true`, además `sponsored`. Una sola función, `externalRel`
   (`worker/src/content/resources.ts`), la usan la app y la página SEO.
2. Un recurso patrocinado se rotula **"Patrocinado"** a la vista, en la app y en
   la página.
3. **El pago no cambia el orden.** Se ordena por tipo y título
   (`orderResources`); `sponsored` no interviene.
4. La página lo dice al pie: hoy ningún recurso tiene acuerdo comercial; si lo
   tuviera, la nota cambia sola.

Los tests que fijan esto: `worker/src/content/resources.test.ts`,
`api/src/resources.test.ts` (incluye una pasada sobre todo el catálogo real) y
`web/src/components/resources/ResourceList.test.tsx`.

## Verificación de las URLs

El 2026-11-05 se pidió cada URL (`bun run --cwd worker content:verify`):
40 de 41 responden 200. Notas:

- **LeetCode** y **Khan Academy** responden 403/challenge a un script (protección
  contra bots) pero existen y se ven en un navegador; el verificador los lista
  como `bloqueado`, no como roto.
- **HubSpot Academy** (`academy.hubspot.com/es`): la máquina desde la que se
  armó esto no resuelve ese host (DNS filtrado). Se confirmó que
  `academy.hubspot.es` redirige con 301 a esa URL. Revisarlo desde otra red.
- **INEFOP** es una SPA: el HTML no trae título, pero el sitio responde 200.

## Pendiente (no entra en este PR)

- **Podcasts y canales locales** (Uruguay): no hay ninguno verificado. Hace falta
  que Faku nombre cuáles; no se inventan.
- **LearnIt como fuente de cursos**: depende del catálogo de LearnIt
  (`docs/PLAN-pendientes.md`, "Integración con LearnIt"); todavía no existe.
- **Moderación del patrocinio desde el panel** (`api/src/admin.ts`): hoy se
  marca en el catálogo versionado. Cuando haya un acuerdo comercial real hace
  falta el flujo en el panel, reutilizando el patrón de `api/src/moderation.ts`.
- **Ingesta de fuentes** (MDN, W3Schools, freeCodeCamp) ya está declarada en
  `sources.ts` (#40); este PR no la amplía.
