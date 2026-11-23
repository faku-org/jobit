# Fixes y mejoras — 2026-11-23 (v0.12.0)

Lote después de usar la v0.11.0 (Preferencias como view propia).
`[ ]` pendiente · `[~]` parcial, con nota · `[x]` hecho y verificado.

## Preferencias

### UX

- [~] Preferencias obliga a scrollear hasta abajo para llegar a ciertas opciones.
  Se secciona con pestañas (Apariencia, Idioma, Accesibilidad); la elegida va en
  el ancla (`?view=settings#accesibilidad`). Tests de URL verdes; falta mirarlo en
  el navegador.
- [~] Mercado y Guardadas usan componentes de pestañas distintos: ahora los dos y
  Preferencias usan `web/src/components/ui/Tabs.tsx`. Typecheck verde; falta
  revisión visual.
- [~] El botón Preferencias de la isla abre un menú con Tema, Idioma y
  Configuración (`PreferencesMenu.tsx`). Typecheck y lint verdes; falta probarlo
  en el navegador.

## Oferta

### UI

- [~] El borde se veía negro a la derecha del aura en la tarjeta de calce del modal.
  Causa: a 100 % y 125 % de zoom el borde de 1.5px se redondea a 1px físico y el
  `::after` (`inset: -1.5px`) pintaba el relleno encima del filo. Ahora `inset: 0`.
  Verificado en una página estática con el CSS compilado (Edge headless, 100 % y
  125 %); falta confirmarlo en el modal real.

### Perf

- [~] Con un modal abierto, las auras de fondo se apagan (solo CSS,
  `html:has([aria-modal='true'])`): sin animación y sin las capas con blur. Las
  de dentro del diálogo siguen. Verificado con `getComputedStyle` en la página de
  prueba; falta en la app.

## Locales

- [x] Preparar la localización: `display.locale` guardado en el dispositivo,
      diccionarios `es`/`en`/`pt` en `web/src/lib/locales/`, `<html lang>` desde el
      primer pintado y `useT()`. Migrados la isla, su menú y Preferencias. Ver
      `docs/i18n.md`. Tests `i18n.test.ts` verdes.
- [ ] Migrar el resto de la interfaz y los formatos de fecha/número (ver
      `docs/i18n.md`, Pendiente).

## Extras

- [~] Integración con treg.to preparada y apagada por defecto
  (`worker/src/sources/treg.ts`, variables `JOBIT_TREG_*`, ver
  `docs/integraciones.md`). Tests con fixtures verdes; sin llamadas reales: el
  mapeo de Ashby y de la búsqueda paga hay que validarlo con una respuesta real, y
  la cobertura de Uruguay es desconocida.
- [x] Servidor MCP hosteado: `https://jobs.wefaber.net/mcp` responde `initialize`
      y `tools/call search_jobs` (2316 ofertas). El unit del repo decía `PORT=3300` y
      el server usa 3301 (nginx y workflow): corregido el drift.
