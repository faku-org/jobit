# Fixes 23/11 (v0.13.0): Configuración sin scroll

Pedido: las secciones de Configuración no scrollean; el Perfil va en la misma barra
que Apariencia, Idioma y Accesibilidad, con sub-secciones; las secciones con mucho
contenido o texto se acomodan en horizontal.

## UX

- [x] Configuración es una view (`?view=settings`) con una barra Perfil /
      Apariencia / Idioma / Accesibilidad.
- [x] Perfil tiene una segunda fila con sus sub-secciones; el ancla nombra la
      elegida (`#cv`, `#busqueda`…).
- [x] Ninguna sección scrollea en 1366×768 ni en 1920×1080 (medido: sin scroll de
      página ni columnas fuera del panel).
- [x] Lo que tiene mucho contenido se reparte en columnas, en horizontal.
- [x] `?view=profile` y sus anclas viejas siguen abriendo donde corresponde.

## Notas

- En teléfono (debajo de `md`) el contenido va en una columna y la página
  scrollea: no hay ancho para columnas.
