/** Clases que comparten la sección y el modal de cuenta. Viven acá y no en
 * `lib/styles.ts` porque todo esto se dibuja sobre el panel azul: usan los
 * tonos `onpanel`, no los del tablero (`surface`/`ink`). */

export const accountFieldClass =
  "w-full rounded-xl border border-onpanel/20 bg-onpanel-wash px-3 py-2 text-sm text-onpanel placeholder:text-onpanel-faint outline-none transition-colors focus:border-sky";

export const accountPrimaryClass =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky px-3 py-2 text-sm font-medium text-ink transition-colors hover:brightness-105 disabled:opacity-60";

export const accountQuietClass =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-onpanel/20 px-3 py-2 text-sm font-medium text-onpanel/80 transition-colors hover:border-sky hover:text-onpanel disabled:opacity-60";

export const accountDangerClass =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:brightness-105 disabled:opacity-60";
