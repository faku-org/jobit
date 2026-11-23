import { m } from 'motion/react'
import { islandTransition } from '../../lib/motion.ts'
import type { SavedTab } from '../../lib/types.ts'

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
  const options: { value: SavedTab; label: string; count: number }[] = [
    { value: 'saved', label: 'Guardadas', count: savedCount },
    { value: 'tracking', label: 'Seguimiento', count: trackedCount },
  ]

  return (
    <div
      aria-label="Guardadas y seguimiento"
      className="mt-3 inline-grid grid-cols-2 gap-1 rounded-full border border-sky/50 bg-surface p-1 shadow-[var(--shadow-hairline)]"
      role="group"
    >
      {options.map((option) => {
        const active = tab === option.value
        return (
          <button
            key={option.value}
            aria-pressed={active}
            className={`relative min-h-9 rounded-full px-4 text-xs font-medium whitespace-nowrap transition-colors ${
              active ? 'text-onpanel' : 'text-muted hover:text-ink'
            }`}
            type="button"
            onClick={() => onChange(option.value)}
            onFocus={
              option.value === 'tracking' ? onPrefetchTracking : undefined
            }
            onMouseEnter={
              option.value === 'tracking' ? onPrefetchTracking : undefined
            }
            onPointerDown={
              option.value === 'tracking' ? onPrefetchTracking : undefined
            }
          >
            {active ? (
              <m.span
                className="absolute inset-0 rounded-full bg-panel"
                layoutId="saved-tab"
                transition={islandTransition}
              />
            ) : null}
            <span className="relative">
              {option.label}
              {option.count > 0 ? (
                <span className="ml-1 tabular-nums">({option.count})</span>
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
