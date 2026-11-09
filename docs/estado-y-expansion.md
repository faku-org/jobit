# Estado y expansión de JobIt

Documento de proyecto: qué está construido hoy, qué se planea después y en qué orden.
Complementa a [`plan-implementacion.md`](plan-implementacion.md) (el detalle de cada fase)
y a [`roadmap.md`](roadmap.md) (las ideas de largo plazo). No repite esos documentos:
los enlaza.

Fecha de esta foto: 2026-11-05. Rama de trabajo: `feat/empresa-perfil`. Último commit
de la rama: `8f5e8d9 docs: plan de implementacion, revision de UX/a11y y decisiones`.
Estado de PRs e issues revalidado contra GitHub en esta fecha.

## Qué es

Buscador de ofertas de trabajo de Uruguay, pensado para quien busca su primer empleo
o un puesto sin experiencia previa. Se usa sin cuenta: buscar, filtrar, guardar y
descartar vive en el navegador. El servidor guarda solo las cuentas que publican y las
empresas. Sitio: `jobs.wefaber.net`.

Principio que no se negocia: **Zero Data**. Buscar no deja nada en el servidor. Las
métricas de una empresa son contadores por oferta y por día, nunca por persona.

## Estado actual

### Construido y en uso

| Pieza | Dónde | Estado |
|---|---|---|
| Tablero público de ofertas | `web/` | Funciona sin cuenta. |
| Scrapers de portales | `worker/` | Escribe `worker/output/jobs.json`. |
| API | `api/` (Bun + Elysia, loopback) | Sirve tablero, cuentas, empresas y páginas indexables. |
| Cuentas de quien publica | `jobit_session` | Handle + contraseña; 2FA opcional. |
| Panel de empresa | `jobit_company` | Alta, perfil, redes, correos verificados, miembros, verificación de dominio por DNS TXT. **2FA obligatorio.** |
| Panel de administración | `jobit_admin` | Clave argon2id en archivo de entorno. |
| Analítica propia | `api/src/events.ts`, `usage.ts` | Eventos anónimos, sin identificador, con día y sin hora. |
| Correo transaccional | Resend | Sin `RESEND_API_KEY` no envía: el contenido queda en el log. |

### En curso (rama `feat/empresa-perfil`)

La rama tiene 5 commits del panel de empresa (perfil, redes, correos, 2FA, miembros,
áreas, validación en vivo, pasos numerados, buscador de país). Sin PR abierto al
momento de la foto; el siguiente paso es abrirlo contra `develop`. `.agents/` y
`.claude/skills/` son herramientas locales y no se commitean.

### Integrado en `develop` (8 de octubre)

#38 servicios, #39 MCP, #40 ejercicios, #41 plan de pendientes, #42 FAQ por rubro,
#44 descripción, #46 empresas, #49 atajos, #50 ayuda y novedades, #52 escaneo de
seguridad y #54 búsqueda semántica. La fase 1 del plan quedó hecha salvo lo de abajo.

### PRs abiertos

| PR | Qué | Nota |
|---|---|---|
| #56 | `feat/mercado-historico` | Foto diaria del mercado. Mergeable. |
| #57 | `fix/modal-mobile` | Ficha de oferta en el teléfono (#37). Mergeable. |
| #58 | `feat/metricas-servicios` | Métricas de servicios (#32). Mergeable. |

### Issues abiertos con código ya en `develop`

#1 (#39), #45 (#46), #48 (#50), #13, #14 y #15 (panel): verificar contra el issue y cerrar.

### Decisiones tomadas (no revertir sin discutir)

Tomadas en `Architecture.md`, sección "Decisiones que conviene no revertir sin pensar":

- Better Auth descartado: exige email, guarda el token sin hashear, no cifra el TOTP.
- Email opcional en cuentas de usuario (se entra por handle).
- 2FA obligatorio solo para empresas, porque publican en nombre de un tercero.
- Verificación de dominio por DNS TXT, no por correo, y se re-chequea cada 24 horas.
- El panel de empresa es su propio bundle: quien busca no descarga la administración de empresas.

## Expansión planificada

El orden sale del plan (`plan-implementacion.md`, sección "Fase"). Criterios, en orden
de peso: destrabar lo que ya está hecho, respetar dependencias, priorizar a quien busca
trabajo, y dejar para el final todo lo que cuesta dinero por uso.

| Fase | Qué | Tamaño | Depende de |
|---|---|---|---|
| 1 | Integrar los PRs listos | M | Nada. Es el paso inmediato. |
| 2 | Base de accesibilidad, UX y navegación | L | 1 |
| 3 | Privacidad y legales (#34) | S | Paralela a 2 y 4 |
| 4 | Alta de empresa y emprendimientos | M | Paralela a 2 y 3 |
| 5 | Servicios (#26, #38, #32, #33) | L | 1 |
| 6 | Recomendador personalizado | L | Perfil y catálogo de skills |
| 7 | Métricas de empresa (ventanas, embudo, alertas, exportes) | M | Contadores existentes |
| 8 | Postulaciones con preguntas y conversación | L | Cifrado local, decisión de retención |
| 9 | Contenido (#3, #5, #7) | L | Ninguna |
| 10 | Plataforma: analítica propia exportable a LearnIt, API, self-hosting | L | 7 |
| 11 | IA para empresas, plan de pago (video por puesto, FAQ con IA) | L | Pagos, claves y caché |

Fuente de cada fase: [`roadmap.md`](roadmap.md) para 6, 7, 8 y 11; el plan para el resto.

### Qué significa "expansión" para este proyecto

- **Recomendador (fase 6)**: un puntaje explicable, en palabras de quien mira. Sin cuenta
  obligatoria: tiene que funcionar con lo que ya está en el navegador, y el sync lo puede
  llevar entre equipos.
- **Postulaciones con preguntas (fase 8)**: las respuestas son datos personales de los dos
  lados. Retención mínima en servidor. Cada parte guarda una copia cifrada con la
  contraseña de su cuenta, que el servidor no ve. Exportable a Markdown y PDF.
- **IA de pago (fase 11)**: cada herramienta declara de dónde saca lo que dice. Ninguna
  manda datos de quien busca a un tercero sin que la persona lo sepa.

## Qué falta verificar

- Las fases 1 a 11 son planes. Ninguna está terminada salvo lo marcado en "Construido".
- El estado de PRs e issues es de la foto del 5 de noviembre. Revalidar en GitHub antes
  de ordenar trabajo.
- `package.json` está en `0.0.0`. Según la convención del equipo, subir a `0.x.y` cuando
  se empiece a versionar en serio. No se cambió en esta pasada.

## Próximo paso

Prioridad de issues (2026-11-05): #15, #5, #3, #1, #26, #45, #48.

1. #15: abrir el PR de `feat/empresa-perfil`, luego `JobPosting` y las dos URLs indexables.
2. #5 y #3 (nivel puesto): contenido sobre el sistema de #40.
3. #26: mergear #58, después #33 y definir quién publica un servicio.
4. Verificar y cerrar #1, #45 y #48.
