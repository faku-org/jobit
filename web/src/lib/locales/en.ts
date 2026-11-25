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

  'settings.title': 'Settings',
  'settings.tab.profile': 'Profile',
  'settings.subsections': 'Profile sections',
  'settings.profile.basics': 'Profile',
  'settings.profile.cv': 'CV',
  'settings.profile.cvData': 'Details',
  'settings.profile.cvRole': 'Role',
  'settings.profile.cvExtra': 'Extras',
  'settings.profile.search': 'Search',
  'settings.profile.sources': 'Sources',
  'settings.profile.test': 'Self-assessment',
  'settings.profile.account': 'Account',
  'settings.profile.agents': 'Agents',
  'settings.profile.privacy': 'Privacy',
  'settings.privacyNote':
    'Nothing you write here leaves your browser unless you turn on account sync.',
  'settings.lead': 'Your profile, how you search and how the app looks.',
  'settings.sections': 'Settings sections',
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
  'skills.label': 'Skills',
  'skills.placeholder': 'Search: Excel, English, React, customer service…',
  'skills.hint':
    'The ones from your CV and courses come preloaded: remove any that do not fit. They let each offer tell you what it asks for that you already have. They stay in this browser.',
  'recommend.why': 'Why we recommend it',
  'recommend.missing': 'What you are missing',
  'recommend.cardLabel': 'Why it is for you',
}
