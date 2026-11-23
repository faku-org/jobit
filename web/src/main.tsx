import { LazyMotion, MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ServiceEmbed } from './components/service/ServiceEmbed.tsx'
import { Embed } from './components/ui/Embed.tsx'
import { useMotionReduced } from './hooks/useDisplay.ts'
import { markEmbedNotIndexable } from './lib/meta.ts'
import { embedRequest, embedServiceRequest } from './lib/share.ts'

/** Se resuelve después del primer pintado: hasta que llegue, lo que animaría
 * queda en su estado final, que es exactamente lo que hay que mostrar. */
const features = () =>
  import('./lib/motionFeatures.ts').then((module) => module.default)

/** `?embed=<id>` renders one offer for somebody else's page, nothing else.
 * `?embed_service=<slug>` hace lo mismo con un servicio. */
const embed = embedRequest()
const embedService = embed ? null : embedServiceRequest()
if (embed || embedService) {
  document.documentElement.dataset.embed = ''
  markEmbedNotIndexable()
}

/** `Reducir movimiento` de Preferencias llega como `data-motion` en `<html>`:
 * acá pasa a motion/react, que por su cuenta solo mira al sistema. */
function Motion({ children }: { children: ReactNode }) {
  const reduced = useMotionReduced()
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
      {children}
    </MotionConfig>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* `strict` hace que un `motion.div` que se cuele tire error en vez de
        volver a meter el paquete entero en el bundle de entrada sin que se
        note. */}
    <LazyMotion features={features} strict>
      {/* Drops the movement out of every animation when the OS asks for it. */}
      <Motion>
        {embed ? (
          <Embed id={embed.id} theme={embed.theme} />
        ) : embedService ? (
          <ServiceEmbed slug={embedService.slug} theme={embedService.theme} />
        ) : (
          <App />
        )}
      </Motion>
    </LazyMotion>
  </StrictMode>,
)
