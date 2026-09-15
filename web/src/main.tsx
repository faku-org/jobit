import { MotionConfig } from "motion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { Embed } from "./components/ui/Embed.tsx";
import { Framed } from "./components/ui/Framed.tsx";
import { markEmbedNotIndexable } from "./lib/meta.ts";
import { embedRequest } from "./lib/share.ts";

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
    {/* Drops the movement out of every animation when the OS asks for it. */}
    <MotionConfig reducedMotion="user">
      {embed ? <Embed id={embed.id} theme={embed.theme} /> : framed ? <Framed /> : <App />}
    </MotionConfig>
  </StrictMode>,
);
