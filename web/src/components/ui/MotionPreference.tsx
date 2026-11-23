import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'
import { useMotionReduced } from '../../hooks/useDisplay.ts'

/** `Reducir movimiento` de Preferencias llega como `data-motion` en `<html>`:
 * acá pasa a motion/react, que por su cuenta solo mira al sistema. */
export function MotionPreference({ children }: { children: ReactNode }) {
  const reduced = useMotionReduced()
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
      {children}
    </MotionConfig>
  )
}
