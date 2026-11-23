import type { Messages } from './es.ts'

/** Parcial a propósito: lo que falta cae al español (`translate`). */
export const pt: Partial<Messages> = {
  'island.tagline': 'Vagas de emprego no Uruguai',
  'island.news': 'Novidades',
  'island.help': 'Ajuda',
  'island.preferences': 'Preferências',

  'menu.theme': 'Tema',
  'menu.language': 'Idioma',
  'menu.settings': 'Configurações',
  'menu.settingsHint': 'Escala, acessibilidade e mais',
  'menu.soon': 'em breve',

  'theme.light': 'Claro',
  'theme.dark': 'Escuro',
  'theme.system': 'Sistema',

  'settings.title': 'Preferências',
  'settings.lead':
    'Idioma, tema, tamanho e acessibilidade. Ficam salvos neste dispositivo e não vão para a sua conta.',
  'settings.sections': 'Seções de Preferências',
  'settings.tab.appearance': 'Aparência',
  'settings.tab.language': 'Idioma',
  'settings.tab.accessibility': 'Acessibilidade',
  'settings.profile.title': 'Perfil e configurações',
  'settings.profile.hint':
    'Seu perfil, seu currículo, o que você procura, as fontes, sua conta e a privacidade.',
  'settings.language.hint':
    'O idioma da interface. As vagas aparecem no idioma em que foram publicadas.',
  'settings.language.group': 'Interface',
  'settings.theme.title': 'Tema',
  'settings.theme.hint': 'Claro ou escuro, ou o que o seu dispositivo usar.',
  'settings.theme.group': 'Aspecto',
  'settings.scale.title': 'Escala',
  'settings.scale.hint':
    'Aumenta ou diminui o texto e tudo o que se mede por ele: botões, cartões e espaços.',
  'settings.scale.group': 'Tamanho',
  'settings.a11y.hint':
    'Somam ao que o seu sistema operacional já pede, nunca tiram.',
  'settings.a11y.motion': 'Reduzir movimento',
  'settings.a11y.motionHint':
    'Sem animações nem transições: o que muda aparece de uma vez.',
  'settings.a11y.contrast': 'Alto contraste',
  'settings.a11y.contrastHint':
    'Texto, bordas e links mais marcados, no tema claro e no escuro.',
  'settings.a11y.links': 'Sublinhar links',
  'settings.a11y.linksHint':
    'Todos os links ficam sublinhados, não só os de um parágrafo.',
}
