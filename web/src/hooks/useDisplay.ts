import { useEffect, useSyncExternalStore } from 'react'
import {
  CONTRAST_QUERY,
  MOTION_QUERY,
  type Display,
  displayAttributes,
  motionReduced,
} from '../lib/display.ts'

/**
 * Escribe la escala, el movimiento, el contraste y el subrayado en `<html>`,
 * donde los lee el CSS. Suma lo que la persona eligió y lo que el sistema ya
 * pide (`prefers-reduced-motion`, `prefers-contrast`): la elección solo puede
 * agregar, nunca quitar lo que el sistema pidió.
 */
export function useDisplay(display: Display): void {
  const { scale, reduceMotion, highContrast, underlineLinks } = display

  useEffect(() => {
    const motion = window.matchMedia(MOTION_QUERY)
    const contrast = window.matchMedia(CONTRAST_QUERY)

    const apply = () => {
      const attributes = displayAttributes(
        { scale, reduceMotion, highContrast, underlineLinks },
        { reduceMotion: motion.matches, highContrast: contrast.matches },
      )
      const root = document.documentElement
      for (const [name, value] of Object.entries(attributes)) {
        if (value === null) delete root.dataset[name]
        else root.dataset[name] = value
      }
    }

    apply()
    motion.addEventListener('change', apply)
    contrast.addEventListener('change', apply)
    return () => {
      motion.removeEventListener('change', apply)
      contrast.removeEventListener('change', apply)
    }
  }, [scale, reduceMotion, highContrast, underlineLinks])
}

const subscribe = (notify: () => void): (() => void) => {
  const observer = new MutationObserver(notify)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-motion'],
  })
  return () => observer.disconnect()
}

/** ¿Hay que quitar el movimiento ahora? Reacciona al interruptor de
 * Preferencias sin pasar la prop por todo el árbol. */
export function useMotionReduced(): boolean {
  return useSyncExternalStore(subscribe, motionReduced, () => false)
}
