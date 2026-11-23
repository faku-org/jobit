# Fixes y mejoras — 2026-11-22 (v0.1.1)

Lote que pasó Faku después de usar BuscoJobs y de subir su CV a JobIt.
`[ ]` pendiente · `[~]` parcial, con nota · `[x]` hecho y verificado.

**Criterio del lote:** lo que afloje la Zero Data Policy va como **opcional**, apagado por
defecto, con un aviso claro de qué se guarda y dónde. Sin activarlo, JobIt funciona igual
que hoy. Elegir es de la persona.

## Bugs

- [~] Subir el CV en PDF falla con "No se pudo abrir el archivo". Causa: nginx sirve el
  worker `.mjs` de pdf.js como `application/octet-stream` + `nosniff` y el navegador lo
  rechaza. Arreglo en PR #70 (worker como chunk `.js`), verificado en local con los headers
  y el CSP de prod. Falta probarlo en jobs.wefaber.net después del deploy.

## Postular sin salir de JobIt

- [~] Postulación con mensaje armado ("Hola, soy X, me postulo a Y, les adjunto Z") y
  adjuntos, por `mailto` o para copiar. #71
  Hecho en v0.5.0 (`docs/postulacion.md`): botón "Armar mensaje", plantillas Formal /
  Corta / Primer empleo editables y guardadas en el dispositivo, `mailto:` si la oferta
  trae mail y copiar + abrir el aviso si no. Probado por lógica (plantilla, detección de
  mail, `mailto`, sanitizado). Falta verlo en el navegador: cliente de correo y portapapeles.
- [ ] BuscoJobs: importar el CV, "copiar para BuscoJobs" y contacto para un acuerdo de
      postulación. Nunca pedir su usuario y contraseña. #76

## Perfil

- [~] Perfil completo: foto, ubicación, idiomas, preferencias laborales (puesto,
  jerarquía), web y redes, referencias y situación de discapacidad. En el dispositivo; la
  sincronización es opcional y discapacidad nunca se sincroniza sin elegirlo aparte. #72
  Hecho en v0.2.0 (`docs/perfil.md`): todos los campos en el dispositivo, import de CV con
  idiomas y links, botón que lleva al tablero con filtros y export JSON; probado con tests
  de lógica, falta verlo en el navegador. Pendiente: sincronización entre dispositivos y
  export PDF.
- [ ] Test de autoconocimiento laboral (IPIP Big Five), con resultado en el dispositivo y
      aviso de que no es un psicotécnico. #75

## Navegación

Pedido de Faku: views propias en vez de submenús y modales. Hecho en v0.6.0
(`docs/web.md`, "Navegación"). Verificado en local (build + capturas a 390 y 1280 px);
falta verlo en jobs.wefaber.net después del deploy.

- [~] Perfil como view propia (`?view=profile`): el botón Preferencias de la isla lleva
  ahí; perfil, CV, preferencias, fuentes, apariencia, cuenta y borrado son secciones
  visibles con ancla, sin submenús.
- [~] Novedades con ícono propio (campana) al lado de Preferencias, abre `?view=news`.
- [~] Seguimiento dentro de Guardadas: `?view=saved` con sub-pestañas, `&tab=tracking`.
- [~] Estado como filtro dentro de Ofertas (`source=uruguayconcursa`).
- [~] Ayuda como view propia (`?view=help`), ya no es modal.
- [~] Pestañas resultantes: Ofertas, Servicios, Guardadas, Mercado. Los enlaces viejos
  (`?view=tracking`, `?view=state`) redirigen con `replaceState`.

## Seguimiento y mail

- [ ] Notas por postulación y entrevistas al calendario: `.ics` primero, conectar Google
      Calendar u Outlook como opcional. #73
- [ ] Conectar la casilla de mail (opcional): enviar postulaciones, después "pegá el mail"
      para entender un rechazo con un modelo local, y recién al final leer la casilla (Gmail
      exige auditoría CASA paga). #74
