import type { Messages } from './es.ts'

/** Parcial a propósito: lo que falta cae al español (`translate`). */
export const en: Partial<Messages> = {
  'island.tagline': 'Job offers in Uruguay',
  'island.news': 'News',
  'island.help': 'Help',
  'island.preferences': 'Preferences',

  'menu.theme': 'Theme',
  'menu.language': 'Language',
  'menu.settings': 'Settings',
  'menu.settingsHint': 'Scale, accessibility and more',
  'menu.soon': 'soon',

  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'System',

  'settings.title': 'Preferences',
  'settings.lead':
    'Language, theme, size and accessibility. Saved on this device, never sent to your account.',
  'settings.sections': 'Preference sections',
  'settings.tab.appearance': 'Appearance',
  'settings.tab.language': 'Language',
  'settings.tab.accessibility': 'Accessibility',
  'settings.profile.title': 'Profile and settings',
  'settings.profile.hint':
    'Your profile, your CV, what you are looking for, sources, your account and privacy.',
  'settings.language.hint':
    'The interface language. Offers are shown in the language they were published in.',
  'settings.language.group': 'Interface',
  'settings.theme.title': 'Theme',
  'settings.theme.hint': 'Light or dark, or whatever your device uses.',
  'settings.theme.group': 'Look',
  'settings.scale.title': 'Scale',
  'settings.scale.hint':
    'Makes text bigger or smaller, and everything sized by it: buttons, cards and spacing.',
  'settings.scale.group': 'Size',
  'settings.a11y.hint':
    'They add to what your operating system already asks for, never remove it.',
  'settings.a11y.motion': 'Reduce motion',
  'settings.a11y.motionHint':
    'No animations or transitions: changes appear at once.',
  'settings.a11y.contrast': 'High contrast',
  'settings.a11y.contrastHint':
    'Stronger text, borders and links, in both light and dark themes.',
  'settings.a11y.links': 'Underline links',
  'settings.a11y.linksHint':
    'Every link is underlined, not only those in a paragraph.',
}
