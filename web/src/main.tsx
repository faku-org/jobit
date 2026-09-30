import { LazyMotion, MotionConfig } from "motion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { Embed } from "./components/ui/Embed.tsx";
import { Framed } from "./components/ui/Framed.tsx";
import { markEmbedNotIndexable } from "./lib/meta.ts";
import { embedRequest } from "./lib/share.ts";

/** Se resuelve después del primer pintado: hasta que llegue, lo que animaría
 * queda en su estado final, que es exactamente lo que hay que mostrar. */
const features = () => import("./lib/motionFeatures.ts").then((module) => module.default);

/** `?embed=<id>` renders one offer for somebody else's page, nothing else. */
const embed = embedRequest();
if (embed) {
  document.documentElement.dataset.embed = "";
  markEmbedNotIndexable();
}

/**
 * El embed se enmarca; la app no. El CSP tiene `frame-ancestors *` para que
 * otra página pueda mostrar una oferta, y desde que hay sesiones eso alcanza
 * para tapar la app con una capa invisible y cobrarse un clic donde nadie lo
 * ve. Enmarcada y sin `?embed=`, no se dibuja.
 */
const framed = window.self !== window.top;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* `strict` hace que un `motion.div` que se cuele tire error en vez de
        volver a meter el paquete entero en el bundle de entrada sin que se
        note. */}
    <LazyMotion features={features} strict>
      {/* Drops the movement out of every animation when the OS asks for it. */}
      <MotionConfig reducedMotion="user">
        {embed ? <Embed id={embed.id} theme={embed.theme} /> : framed ? <Framed /> : <App />}
      </MotionConfig>
    </LazyMotion>
  </StrictMode>,
);
