/** Class strings shared by more than one component, kept in one place so the
 * chips, fields and icon buttons cannot drift apart. */

export const chipClass =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium";

export const mutedChip = `${chipClass} bg-mist text-ink/70`;

export const fieldClass =
  "w-full rounded-xl border border-sky/60 bg-surface text-sm text-ink transition-colors outline-none hover:border-brand focus:border-brand focus:ring-4 focus:ring-brand/15";

export const iconButtonClass =
  "inline-flex size-9 items-center justify-center rounded-xl border border-sky/60 text-ink/50 transition-colors hover:border-brand hover:text-ink";

/** A floating panel: the dropdown list and the tag menu. */
export const popoverClass =
  "absolute z-40 rounded-xl border border-sky/60 bg-surface p-1 shadow-[var(--shadow-panel)]";

/** A row inside a popover menu. */
export const menuItemClass =
  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-ink/75 transition-colors hover:bg-mist hover:text-ink";
