import { resolve } from "node:path";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API_TARGET = process.env.API_URL ?? "http://localhost:3000";

const PROXY = { "/api": { target: API_TARGET, changeOrigin: true } };

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  /** El panel es su propia entrada: nadie que entra a buscar trabajo tiene por
   * qué bajarse el código de administrar empresas. */
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        admin: resolve(import.meta.dirname, "admin.html"),
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
