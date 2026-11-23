import type { SavedTab } from '../../lib/types.ts'
import { Tabs } from '../ui/Tabs.tsx'

interface SavedTabsProps {
  tab: SavedTab
  savedCount: number
  trackedCount: number
  onChange: (tab: SavedTab) => void
  /** Apuntar Seguimiento trae su código y sus ofertas antes del clic. */
  onPrefetchTracking: () => void
}

/**
 * Guardadas tiene dos listas: lo que marcaste para pensar y lo que ya mandaste.
 * Son dos momentos de lo mismo, así que comparten pestaña y se eligen acá
 * (`?view=saved&tab=tracking`).
 */
export function SavedTabs({
  tab,
  savedCount,
  trackedCount,
  onChange,
  onPrefetchTracking,
}: SavedTabsProps) {
  return (
    <Tabs
      className="mt-3"
      fill={false}
      label="Guardadas y seguimiento"
      layoutId="saved-tab"
      options={[
        { value: 'saved', label: 'Guardadas', count: savedCount },
        {
          value: 'tracking',
          label: 'Seguimiento',
          count: trackedCount,
          onPrefetch: onPrefetchTracking,
        },
      ]}
      value={tab}
      onChange={onChange}
    />
  )
}
