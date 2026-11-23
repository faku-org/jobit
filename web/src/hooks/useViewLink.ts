import { useEffect, useRef } from 'react'
import { type ViewState, readViewState, writeViewState } from '../lib/url.ts'
import type { Filters, SavedTab, View } from '../lib/types.ts'

/**
 * Ties the section on screen to the address bar in both directions, the way
 * useJobLink ties the open offer: what is being looked at is always what the
 * link in the bar opens, and the back button walks back through the tabs
 * instead of leaving the site.
 */
export function useViewLink(
  view: View,
  filters: Filters,
  tab: SavedTab,
  onNavigate: (state: ViewState) => void,
  ready: boolean,
): void {
  const previousView = useRef(view)
  const previousTab = useRef(tab)
  /** Kept in a ref so a fresh closure on every render does not resubscribe. */
  const latest = useRef(onNavigate)

  useEffect(() => {
    latest.current = onNavigate
  })

  useEffect(() => {
    if (!ready) return

    /* Pasar de Guardadas a Seguimiento es un lugar al que el botón Atrás
       vuelve, igual que cambiar de pestaña. */
    const push =
      view !== previousView.current ||
      (view === 'saved' && tab !== previousTab.current)
    previousView.current = view
    previousTab.current = tab
    writeViewState({ view, filters, tab }, push)
  }, [ready, view, filters, tab])

  useEffect(() => {
    if (!ready) return

    const onPopState = (): void => {
      const state = readViewState()
      previousView.current = state.view
      previousTab.current = state.tab
      latest.current(state)
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [ready])
}
