import { useEffect } from "react";
import type { Theme } from "../lib/types.ts";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Writes the resolved scheme onto <html>, where the CSS tokens swap. While the
 * setting is "system" it keeps following the OS.
 */
export function useTheme(theme: Theme): void {
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);

    const apply = () => {
      const dark = theme === "system" ? media.matches : theme === "dark";
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };

    apply();
    if (theme !== "system") return;

    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
}
