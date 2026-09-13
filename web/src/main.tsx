import { MotionConfig } from "motion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ServiceEmbed } from "./components/service/ServiceEmbed.tsx";
import { Embed } from "./components/ui/Embed.tsx";
import { markEmbedNotIndexable } from "./lib/meta.ts";
import { embedRequest, embedServiceRequest } from "./lib/share.ts";

/** `?embed=<id>` renders one offer for somebody else's page, nothing else.
 * `?embed_service=<slug>` hace lo mismo con un servicio. */
const embed = embedRequest();
const embedService = embed ? null : embedServiceRequest();
if (embed || embedService) {
  document.documentElement.dataset.embed = "";
  markEmbedNotIndexable();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Drops the movement out of every animation when the OS asks for it. */}
    <MotionConfig reducedMotion="user">
      {embed ? (
        <Embed id={embed.id} theme={embed.theme} />
      ) : embedService ? (
        <ServiceEmbed slug={embedService.slug} theme={embedService.theme} />
      ) : (
        <App />
      )}
    </MotionConfig>
  </StrictMode>,
);
