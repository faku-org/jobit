import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { type Plugin, defineConfig } from "vite";

/** 127.0.0.1 y no "localhost": la API escucha en IPv4 (HOST por defecto es
 * 127.0.0.1) y macOS resuelve "localhost" a ::1 primero, así que el proxy
 * terminaba en cualquier otro proceso que tuviera el puerto en IPv6. */
const API_TARGET = process.env.API_URL ?? "http://127.0.0.1:3000";

const PROXY = { "/api": { target: API_TARGET, changeOrigin: true } };

const LEGAL = new Set(["/terminos", "/privacidad"]);

/**
 * En producción nginx sirve `/terminos` desde `terminos.html`. Sin esto, el
 * dev server y `vite preview` no saben de esa regla, la ruta cae en el
 * catch-all y devuelven la app entera, con React y el worker de PDF, en lugar
 * de un documento de texto. Se nota como una espera larga y es la diferencia
 * entre local y el servidor, no la página.
 */
function legalRoutes(): Plugin {
  const rewrite = (req: IncomingMessage, _res: ServerResponse, next: () => void): void => {
    const url = req.url ?? "";
    const path = url.split("?")[0] ?? "";
    if (LEGAL.has(path)) req.url = `${path}.html${url.slice(path.length)}`;
    next();
  };

  return {
    name: "jobit-legal-routes",
    configureServer: ({ middlewares }) => {
      middlewares.use(rewrite);
    },
    configurePreviewServer: ({ middlewares }) => {
      middlewares.use(rewrite);
    },
  };
}

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss(), legalRoutes()],
  /** El panel es su propia entrada: nadie que entra a buscar trabajo tiene por
   * qué bajarse el código de administrar empresas. Las dos legales son html y
   * nada más, así que tampoco arrastran React. */
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        admin: resolve(import.meta.dirname, "admin.html"),
        terminos: resolve(import.meta.dirname, "terminos.html"),
        privacidad: resolve(import.meta.dirname, "privacidad.html"),
      },
    },
  },
  server: {
    port: Number(process.env.PORT ?? 5173),
    proxy: PROXY,
  },
  /** `vite preview` serves the real build, so it needs the same API proxy. */
  preview: {
    proxy: PROXY,
  },
});
