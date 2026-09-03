import { MotionConfig } from "motion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { Embed } from "./components/Embed.tsx";
import { markEmbedNotIndexable } from "./lib/meta.ts";
import { embedRequest } from "./lib/share.ts";

/** `?embed=<id>` renders one offer for somebody else's page, nothing else. */
const embed = embedRequest();
if (embed) {
  document.documentElement.dataset.embed = "";
  markEmbedNotIndexable();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Drops the movement out of every animation when the OS asks for it. */}
    <MotionConfig reducedMotion="user">
      {embed ? <Embed id={embed.id} theme={embed.theme} /> : <App />}
    </MotionConfig>
  </StrictMode>,
);
