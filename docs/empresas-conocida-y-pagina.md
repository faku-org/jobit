# Empresas: "Ya trabajaste acá" y `/empresa/<slug>` (#45)

Cierra los dos criterios que quedaban abiertos de la issue #45 (el filtro por
experiencia, el filtro por rubro y el stand ya estaban en `develop`, #46).

## "Ya trabajaste acá"

Una marca en la tarjeta (`JobCard`) y en la ficha (`JobModal`) cuando la oferta es
de una empresa que la persona cargó con "¿Trabajaste acá?" en el stand. **No
filtra**: el filtro "De mi experiencia" sigue siendo el que filtra.

- Matching: `isWorkedAt(company, slugs)` en `web/src/lib/employers.ts`. Normaliza el
  nombre de la oferta con el mismo `employerSlug` que usa el stand al guardar en
  `prefs.companies`, así "ACME S.A." y "acme s a" son la misma. No hay segunda
  normalización.
- UI: `WorkedBadge` (ícono + texto "Ya trabajaste acá", no depende del color). Va
  en la fila de empresa y ubicación, que ya hace `flex-wrap`: a 375 px baja de
  línea sin desbordar.
- Zero Data: `prefs.companies` vive en el navegador y la marca se calcula ahí. La
  API no recibe ni devuelve nada nuevo; no se sabe qué empresas cargó nadie.

## `/empresa/<slug>`

Página HTML servida por la API (`api/src/employer-page.ts`, ruta en `site.ts`),
igual que `/puesto/` o `/servicios/`.

- Sale de las mismas ofertas que el stand (`employerProfile` + `employerJobs`, que
  usa el mismo agrupado, así el conteo y el listado no se desfasan).
- Contenido: cantidad de ofertas, tabla resumen (departamentos, modalidad, sueldo
  mensual mediano si hay al menos 5 avisos con sueldo, como en el stand), puestos
  más buscados, y las 50 ofertas más recientes con enlace a su ficha. CTA a la app
  filtrada (`/?company=<slug>`).
- SEO: canonical, Open Graph, y JSON-LD `Organization` con `name` y, solo si la
  empresa tiene cuenta aprobada con sitio web, `url`. No se inventa nada más
  (logo, dirección, empleados). El tablero tiene ofertas de terceros, así que no se
  marca `JobPosting` acá.
- Empresa que no existe o sin ofertas: 404 con la página de "No encontramos eso".
- Sitemap: se agregan las empresas con **2 o más ofertas** (`MIN_SITEMAP_OFFERS`).
  Con una sola, la página repite la ficha de esa oferta; la dirección sigue
  respondiendo pero no se anuncia.
- Infra: `location ^~ /empresa/` en `deploy/nginx.conf` (singular; `= /empresas` es
  el panel de empresa) y `"/empresa/"` en la lista `PROXY` de `web/vite.config.ts`.
- Desde la app: el stand (`EmployerModal`) enlaza a la página pública.

### Arreglo de paso

`layout()` serializaba el JSON-LD con `JSON.stringify` a secas. Con nombres de
empresa scrapeados, un `</script>` en el nombre cerraba el bloque. Ahora se escapa
`<` como `<`.

## No hecho

- Aviso "¿Ya trabajaste en X?" al agregar una empresa al CV/perfil: hoy no existe
  ningún flujo que agregue empresas desde el CV (`CvImport` no lee empresas), solo
  el botón del stand. Hacerlo requiere extraer empresas del PDF; queda como
  seguimiento si se quiere.

## Tests

- `api/src/employer-page.test.ts`: la página (canonical, Organization, resumen,
  sueldo con/sin datos), sitio solo con cuenta aprobada, 404, sitemap y mínimo,
  escape de `</script>`.
- `web/src/lib/employers.test.ts`: matching por slug normalizado y casos borde.
