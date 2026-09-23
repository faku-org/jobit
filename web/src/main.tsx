import { LazyMotion, MotionConfig } from "motion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { Embed } from "./components/ui/Embed.tsx";
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* `strict` hace que un `motion.div` que se cuele tire error en vez de
        volver a meter el paquete entero en el bundle de entrada sin que se
        note. */}
    <LazyMotion features={features} strict>
      {/* Drops the movement out of every animation when the OS asks for it. */}
      <MotionConfig reducedMotion="user">
        {embed ? <Embed id={embed.id} theme={embed.theme} /> : <App />}
      </MotionConfig>
    </LazyMotion>
  </StrictMode>,
);
