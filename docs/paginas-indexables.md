# Páginas indexables

La app es una sola URL con query params. Lo que un buscador o un scraper de
enlaces tiene que poder leer sin ejecutar JavaScript lo sirve la API como
documentos HTML sueltos (`api/src/pages.ts`, rutas en `api/src/site.ts`) y nginx
los pone delante de la app (`deploy/nginx.conf`, y `web/vite.config.ts` en
desarrollo).

| Ruta | Para quién | JSON-LD |
|---|---|---|
| `/empleo/<id>` | Quien busca: ficha de una oferta | `JobPosting`, solo en ofertas propias sin enlace externo |
| `/rubro/<slug>`, `/departamento/<d>`, `/puesto/<slug>` | Quien busca: listados | — |
| `/mercado` | Quien busca | — |
| `/entrevista/<rubro>` | Quien busca: guía de entrevista | `FAQPage` |
| `/servicios/<slug>` | Quien busca un servicio | `Service`, `ProfilePage` |
| `/publicar` | **Quien quiere publicar**: qué hace el panel de empresa | `WebPage` |
| `/sitemap.xml` | Buscadores | — |

## Dos públicos

Quien busca trabajo y quien contrata buscan cosas distintas. `/publicar` es la
puerta indexable de empresas y emprendimientos: dice qué hace el panel y manda a
`/empresas`, que es una app sin texto que leer. Solo promete lo que el panel
hace hoy; si el panel cambia, cambia esta página.

Todas las páginas llevan en el pie un enlace a `/publicar`.

## `JobPosting`

- Solo se marca una oferta que vive acá: fuente propia (`jobit`) y sin enlace
  de postulación externo (`isNativeOffer`). Las scrapeadas son de terceros y se
  enlazan al aviso original; marcarlas es lo que Google sanciona a los
  agregadores.
- `hiringOrganization` lleva `sameAs` con el sitio de la empresa cuando lo
  cargó (`company_url`, que sale de `companies.website`). Sin sitio, no se
  inventa.
- `validThrough` y `baseSalary` solo entran si la oferta los declara.

## Qué no cambia

Zero Data: ninguna de estas páginas registra quién las lee.
