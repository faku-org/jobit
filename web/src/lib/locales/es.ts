/**
 * El diccionario de origen: toda clave existe acá primero, y los demás idiomas
 * se tipan contra este. Las claves van por zona (`island.*`, `settings.*`) y los
 * huecos se escriben `{nombre}`.
 *
 * Por ahora cubre la isla, su menú y Preferencias. El resto de la interfaz
 * sigue con el texto en el componente y se va pasando acá por zonas (ver
 * `docs/i18n.md`).
 */
export const es = {
  'island.tagline': 'Ofertas de trabajo en Uruguay',
  'island.news': 'Novedades',
  'island.help': 'Ayuda',
  'island.preferences': 'Preferencias',

  'menu.theme': 'Tema',
  'menu.language': 'Idioma',
  'menu.settings': 'Configuración',
  'menu.settingsHint': 'Escala, accesibilidad y más',
  'menu.soon': 'pronto',

  'theme.light': 'Claro',
  'theme.dark': 'Oscuro',
  'theme.system': 'Sistema',

  'settings.title': 'Preferencias',
  'settings.lead':
    'Idioma, tema, tamaño y accesibilidad. Se guardan en este dispositivo y no viajan a tu cuenta.',
  'settings.sections': 'Secciones de Preferencias',
  'settings.tab.appearance': 'Apariencia',
  'settings.tab.language': 'Idioma',
  'settings.tab.accessibility': 'Accesibilidad',
  'settings.profile.title': 'Perfil y configuración',
  'settings.profile.hint':
    'Tu perfil, tu CV, qué buscás, las fuentes, tu cuenta y la privacidad.',
  'settings.language.hint':
    'El idioma de la interfaz. Las ofertas se muestran en el idioma en que se publicaron.',
  'settings.language.group': 'Interfaz',
  'settings.theme.title': 'Tema',
  'settings.theme.hint': 'Claro u oscuro, o el que use tu dispositivo.',
  'settings.theme.group': 'Aspecto',
  'settings.scale.title': 'Escala',
  'settings.scale.hint':
    'Agranda o achica el texto y todo lo que se mide con él: botones, tarjetas y espacios.',
  'settings.scale.group': 'Tamaño',
  'settings.a11y.hint':
    'Suman a lo que ya pide tu sistema operativo: nunca lo quitan.',
  'settings.a11y.motion': 'Reducir movimiento',
  'settings.a11y.motionHint':
    'Sin animaciones ni transiciones: lo que cambia aparece de una.',
  'settings.a11y.contrast': 'Alto contraste',
  'settings.a11y.contrastHint':
    'Texto, bordes y enlaces más marcados, en el tema claro y en el oscuro.',
  'settings.a11y.links': 'Subrayar enlaces',
  'settings.a11y.linksHint':
    'Todos los enlaces van subrayados, no solo los de un párrafo.',
} as const

export type MessageKey = keyof typeof es
export type Messages = Record<MessageKey, string>
