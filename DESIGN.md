# Diseño

Guía de diseño de JobIt: los principios, los tokens reales y las convenciones de
interfaz. Es lo que mantiene coherente a la app, el panel de empresa y el de
administración a medida que crecen. Cuando algo no encaje acá, la discusión es
sobre este documento, no sobre una pantalla suelta.

## Principios

1. **Buscar trabajo no pide nada.** La interfaz que ve quien busca no tiene
   cuenta, no tiene registro y no tiene nada que aceptar.
2. **La privacidad se ve en la interfaz.** Cada panel dice qué se guarda y dónde.
3. **Primero el contenido, después el cromo.** Las ofertas, los datos y las
   acciones; las decoraciones no compiten.
4. **Una cosa por pantalla.** Nada de scrolls largos con todo mezclado: las
   áreas se separan y cada una se guarda sola.
5. **En español rioplatense**, sin jerga técnica hacia afuera.
6. **Accesible por defecto**: foco visible, contraste, `aria-*` donde haga falta,
   y todo funciona con teclado.

## Tokens

Definidos en `web/src/index.css` con `@theme` de Tailwind v4. Los **nombres no
cambian entre temas**: cambian los valores.

### Color

| Token | Claro | Rol |
|---|---|---|
| `mist` | `#e3f2fd` | Fondo de la página y de los campos. |
| `surface` | `#ffffff` | Tarjetas y superficies elevadas. |
| `sky` | `#90caf9` | Bordes y acentos suaves. |
| `brand` | `#2196f3` | Foco, enlaces, realce. |
| `ink` | `#0d47a1` | Texto principal y bordes fuertes. |
| `panel` / `onpanel` | `#0d47a1` / `#ffffff` | La isla y los botones llenos. |
| `muted` / `soft` / `faint` | derivados de `ink` | Jerarquía de texto. |
| `line` | `ink` al 10% | Un pelo, no un recuadro. |

Reglas:

- **El texto es `ink`** (o un tono derivado). Nunca un relleno `brand`/`sky`
  usado como color de letra.
- Sobre el panel azul se usan los tonos `onpanel`, `onpanel-muted`,
  `onpanel-faint` y `onpanel-wash`; ver `web/src/components/account/controls.ts`.
- El tema oscuro redefine los valores en `[data-theme="dark"]`. El tema se pinta
  antes del primer render (script en cada `*.html`).

### Sombras y radios

`--shadow-card`, `--shadow-panel`, `--shadow-hairline`, `--shadow-match` para
tarjetas, isla, pelos y realce de coincidencia. Radio de tarjeta: `rounded-2xl`;
campos y botones: `rounded-xl`; chips: `rounded-lg`/`rounded-full`.

### Tipografía

`--font-sans` es la pila del sistema. Los rangos de tamaño se usan en pasos
chicos y consistentes (text-sm para cuerpo de panel, text-xs para ayudas,
text-[11px] para notitas). Los números tabulares llevan `tabular-nums`.

## Movimiento

La política vive en `web/src/lib/motion.ts` y `motionFeatures.ts`:

- Transiciones cortas y con propósito; nada que retrase una acción.
- Se respeta `prefers-reduced-motion`.
- La isla del tablero y los modales tienen su propia entrada/salida; una
  animación que no termina no puede dejar contenido invisible.

## Iconografía

- **Lucide** para todo lo de interfaz (`lucide-react`).
- **Marcas**: Lucide no trae logos. Los de redes sociales están incrustados en
  `web/src/empresas/SocialIcons.tsx` (SVG de Simple Icons, CC0). No se cargan de
  un CDN.

## Patrones de interfaz

### Áreas, no scroll infinito

Todo panel con varias cosas se divide en **áreas separadas** (por ejemplo,
Imagen, Identidad, Redes, Correos, Privacidad, Miembros, Seguridad). Se muestra
una por vez con una navegación de pastillas; cada área es una tarjeta y **tiene
su propio guardado**. Reglas:

- Un área nunca mezcla temas distintos.
- Cambiar de área no pierde lo guardado ni arrastra lo a medio editar.
- Las áreas existen siempre, aunque estén vacías.

Ver `web/src/empresas/settings/Settings.tsx`.

### Formularios

- **Se valida mientras se escribe y al salir del campo**, no recién al enviar.
  Los errores aparecen en el campo, en rojo, una vez que se tocó.
- **El botón de enviar nunca se deshabilita.** Un botón deshabilitado no
  recibe foco y no explica qué falta. En su lugar, arriba del botón, un
  resumen en vivo (`aria-live="polite"`) dice qué **falta** (vacío y
  obligatorio) y qué **no cierra** (completo pero inconsistente), y cada ítem
  lleva el foco a su campo. Si se envía con algo pendiente, el foco va al
  primer campo con error.
- Los avisos de "Guardado." son discretos y desaparecen solos.
- Los campos llevan `label` asociado por `htmlFor`/`id`; `aria-invalid` cuando
  hay error.
- El texto de ayuda explica el **porqué**, no repite el nombre del campo.
- Los formularios largos —como el alta de empresa— se parten en **secciones
  numeradas** visibles en una navegación horizontal. Se completa una por vez y
  **se valida al avanzar**: la primera sección con error se muestra con el foco
  puesto y no se pasa de ahí. En mobile vale igual, de a un paso.

### Listas y estados

- Vacío: un recuadro punteado que dice qué hacer, nunca una caja blanca muda.
- Cargando: esqueletos o "Cargando…" según el contexto.
- Error: un mensaje en su idioma, con la acción posible.

### Botones

- **Primario**: relleno `panel` + `onpanel`. Una sola acción primaria por área.
- **Secundario**: borde `sky`, texto `ink`, hover `mist`.
- **Destructivo**: en rojo y con confirmación cuando borra de verdad.

### Enlaces externos

Siempre `target="_blank"` con `rel="noopener noreferrer"`. Los enlaces que se
pagan (sponsored) se rotulan en el código, no en el texto.

## Voz

- Cercana y directa, en rioplatense: "Tocá", "Elegí", "Guardá".
- Se explica qué pasa con los datos en el lugar donde se piden.
- Nada de signos de admiración ni de "¡Genial!".

## Accesibilidad

- Foco visible con `focus-visible` y el color `brand`.
- Contraste suficiente en los cuatro temas de texto (claro y oscuro).
- Los controles tienen nombre accesible (`aria-label` cuando no hay texto).
- El QR del 2FA es un SVG con `role="img"` y etiqueta; el menú de país es un
  `listbox` con `aria-selected`.

## Checklist antes de dar una pantalla por terminada

- [ ] ¿Está dividida en áreas si tiene más de una cosa?
- [ ] ¿Cada área guarda lo suyo?
- [ ] ¿Valida al escribir y no al enviar?
- [ ] ¿Usa los tokens y no colores sueltos?
- [ ] ¿Funciona en tema claro y oscuro?
- [ ] ¿Funciona con teclado y lector de pantalla?
- [ ] ¿Dice qué pasa con los datos si los pide?
