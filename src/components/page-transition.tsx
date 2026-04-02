"use client";

import { motion } from "motion/react";

/**
 * Wraps page content with a subtle fade-in transition.
 * Use this in layout files to give every page load a premium feel.
 *
 * Note: This uses a simple opacity/y fade since Next.js App Router
 * doesn't support AnimatePresence exit animations across routes.
 * The entrance animation alone is enough to feel alive.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
