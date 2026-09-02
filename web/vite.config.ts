import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API_TARGET = process.env.API_URL ?? "http://localhost:3000";

const PROXY = { "/api": { target: API_TARGET, changeOrigin: true } };

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  server: {
    port: Number(process.env.PORT ?? 5173),
    proxy: PROXY,
  },
  /** `vite preview` serves the real build, so it needs the same API proxy. */
  preview: {
    proxy: PROXY,
  },
});
