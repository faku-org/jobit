import { Monitor, Moon, Sun } from 'lucide-react'
import type { MessageKey } from './i18n.ts'
import type { Theme } from './types.ts'

/** Las tres maneras de elegir el tema. Vive acá y no en SettingsPage porque la
 * isla también las usa y esa página es lazy: importarla la sacaría del chunk. */
export const THEME_OPTIONS: {
  value: Theme
  label: MessageKey
  icon: typeof Sun
}[] = [
  { value: 'light', label: 'theme.light', icon: Sun },
  { value: 'dark', label: 'theme.dark', icon: Moon },
  { value: 'system', label: 'theme.system', icon: Monitor },
]
