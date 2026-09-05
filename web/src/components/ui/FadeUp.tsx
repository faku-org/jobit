import { motion } from "motion/react";
import type { ReactNode } from "react";
import { fadeUpTransition } from "../../lib/motion.ts";

interface FadeUpProps {
  children: ReactNode;
  /** Seconds to wait before the element starts moving. */
  delay?: number;
}

/** The one entrance animation used across the app: 12px up plus a fade. */
export function FadeUp({ children, delay = 0 }: FadeUpProps) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: 12 }}
      transition={{ ...fadeUpTransition, delay }}
    >
      {children}
    </motion.div>
  );
}
