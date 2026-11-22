# Perfil completo (CV)

Lo que la persona carga además de estudios y experiencia: foto, dónde vive,
idiomas, qué busca, links, referencias y, si quiere, discapacidad. Vive en la
pestaña Perfil de la isla (`ResumeSections`).

## Dónde se guarda

Sólo en este navegador, en `localStorage` (`jobit.prefs.v1`, campo `resume`).
Es un objeto aparte de `Profile` a propósito: `Profile` viaja con la
sincronización de cuenta y las estadísticas anónimas, y esto no.

| Dato                  | Se sincroniza | Va a las estadísticas | Sale del navegador                       |
| --------------------- | ------------- | --------------------- | ---------------------------------------- |
| Foto                  | No            | No                    | Sólo en el JSON que descargás            |
| Departamento y ciudad | No            | No                    | Sólo en el JSON                          |
| Idiomas               | No            | No                    | Sólo en el JSON                          |
| Puesto y jefatura     | No            | No                    | Sólo en el JSON                          |
| Links                 | No            | No                    | Sólo en el JSON                          |
| Referencias           | No            | No                    | Sólo en el JSON                          |
| Discapacidad (y nota) | No            | No                    | Sólo en el JSON, y se puede dejar afuera |

"Borrar todos mis datos de este navegador" también vacía el `resume`.
Ningún campo nuevo llega a la API (Zero Data Policy).

## Campos

- **Foto**: se elige un archivo (JPG, PNG o WebP, hasta 15 MB), se recorta a un
  cuadrado con zoom y desplazamiento y se comprime en el navegador a 400 px,
  JPEG calidad 0,82. Lo que se guarda es un data URL de hasta 250 000
  caracteres (`lib/photo.ts`).
- **Ubicación**: departamento de una lista cerrada (el mismo vocabulario del
  tablero) y ciudad o barrio en texto libre.
- **Idiomas**: hasta 8, con nivel básico, intermedio, avanzado o nativo.
- **Puesto y preferencias**: el puesto va al filtro de título. Jerarquía,
  jornada y modalidad son las mismas `Preferences` que ya ordenan "Para vos";
  no hay un segundo estado. Jefatura es lo único que vive en el `resume`,
  porque las ofertas no traen ese dato y no filtra.
- **Web y redes**: hasta 6. Sólo `http` y `https`; el tipo (LinkedIn, GitHub,
  portfolio, otro) se adivina por el dominio.
- **Referencias**: hasta 4. El formulario avisa que hay que pedirle permiso a la
  persona antes de cargarla.
- **Discapacidad**: opcional y apagada por defecto. Sin la marca no se guarda la
  nota.

## El botón "Ver ofertas con esto"

`filtersFromSearch(resume, preferences)` arma los filtros del tablero: el
puesto va a `title`, y jerarquía, jornada y modalidad sólo filtran cuando se
eligió una sola opción en el grupo (el tablero filtra por un valor, no por una
lista). Con varias opciones esas siguen ordenando "Para vos" pero no recortan.

## Importar CV

`readCv` ahora también devuelve `languages` y `links`. Un idioma sin nivel en
el texto no se anota. La ubicación detectada completa `department` y `city`
sólo si estaban vacíos. Todo se suma sin pisar lo que ya estaba
(`mergeReading`). El onboarding no tiene dónde guardar esto todavía, así que
ahí `CvImport` corre con `withResume={false}` y no ofrece idiomas ni links.

## Export JSON

"Descargar mis datos (JSON)" arma el archivo en el navegador
(`buildExport`) y lo baja como `jobit-perfil-AAAA-MM-DD.json`. No pasa por
ningún servidor. Trae `formacion`, `busqueda`, `contacto`, `idiomas`,
`referencias`, `foto` y `discapacidad`; esta última se puede dejar afuera con
la casilla que aparece cuando está marcada. No incluye `shareStats` ni
`onboardedAt`.

## Pendiente (fuera de este PR)

- Sincronización entre dispositivos del `resume`. Requiere decidir qué se cifra
  y cómo, por la foto y la discapacidad.
- Export a PDF.
- Que CvImport del onboarding también rellene idiomas y links.
