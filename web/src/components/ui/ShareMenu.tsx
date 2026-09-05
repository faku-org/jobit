import { Check, Code2, Link2, MessageCircle, Share2, Upload } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useDismissable } from "../../hooks/useDismissable.ts";
import { fadeUpTransition } from "../../lib/motion.ts";
import { canShare, copyText, embedSnippet, jobLink, shareJob, whatsappLink } from "../../lib/share.ts";
import { iconButtonClass, menuItemClass, popoverClass } from "../../lib/styles.ts";
import type { Job } from "../../lib/types.ts";

interface ShareMenuProps {
  job: Job;
  /** Where the menu hangs from, so it never runs off the right edge. */
  align?: "left" | "right";
}

function MenuItem({
  icon: Icon,
  children,
  onClick,
}: {
  icon: typeof Link2;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={menuItemClass} role="menuitem" type="button" onClick={onClick}>
      <Icon aria-hidden className="size-3.5 shrink-0 text-brand" />
      {children}
    </button>
  );
}

/** How long the "copied" line stays up before the menu closes itself. */
const NOTE_MS = 1400;

/**
 * Passes the offer along: the system share sheet, a plain link, WhatsApp, or
 * the iframe snippet for whoever wants it on their own page.
 */
export function ShareMenu({ job, align = "right" }: ShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [failed, setFailed] = useState(false);
  const container = useDismissable<HTMLSpanElement>(open, () => setOpen(false));
  const native = canShare();

  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => {
      setNote("");
      if (!failed) setOpen(false);
    }, NOTE_MS);
    return () => clearTimeout(timer);
  }, [note, failed]);

  const copy = (value: string, done: string) => {
    void copyText(value).then((ok) => {
      setFailed(!ok);
      setNote(ok ? done : "No se pudo copiar");
    });
  };

  const share = () => {
    void shareJob(job).then((result) => {
      if (result === "unsupported") copy(jobLink(job.id), "Enlace copiado");
      else setOpen(false);
    });
  };

  return (
    <span ref={container} className="relative inline-flex">
      <motion.button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Compartir oferta"
        className={`${iconButtonClass} ${open ? "border-brand text-ink" : ""}`}
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen((current) => !current)}
      >
        <Share2 aria-hidden className="size-4" />
      </motion.button>

      <AnimatePresence>
        {open ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className={`${popoverClass} top-full mt-1 w-56 ${align === "right" ? "right-0" : "left-0"}`}
            exit={{ opacity: 0, y: -4 }}
            initial={{ opacity: 0, y: -4 }}
            role="menu"
            transition={fadeUpTransition}
          >
            {native ? (
              <MenuItem icon={Upload} onClick={share}>
                Compartir…
              </MenuItem>
            ) : null}

            <MenuItem icon={Link2} onClick={() => copy(jobLink(job.id), "Enlace copiado")}>
              Copiar enlace
            </MenuItem>

            <a
              className={menuItemClass}
              href={whatsappLink(job)}
              rel="noreferrer noopener"
              role="menuitem"
              target="_blank"
              onClick={() => setOpen(false)}
            >
              <MessageCircle aria-hidden className="size-3.5 shrink-0 text-brand" />
              Mandar por WhatsApp
            </a>

            <MenuItem icon={Code2} onClick={() => copy(embedSnippet(job), "Código copiado")}>
              Copiar código para embeber
            </MenuItem>

            <AnimatePresence initial={false}>
              {note ? (
                <motion.p
                  animate={{ opacity: 1 }}
                  className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium ${
                    failed ? "text-muted" : "text-brand"
                  }`}
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  transition={fadeUpTransition}
                >
                  {failed ? null : <Check aria-hidden className="size-3.5" />}
                  {note}
                </motion.p>
              ) : null}
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
