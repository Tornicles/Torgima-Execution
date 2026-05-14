"use client";

import { LazyMotion, domAnimation } from "framer-motion";
import type { ReactNode } from "react";

export function MotionRoot({ children }: { children: ReactNode }) {
  return <LazyMotion features={domAnimation}>{children}</LazyMotion>;
}

export const fadeUpVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
} as const;

export const staggerContainer = {
  visible: {
    transition: { staggerChildren: 0.1 },
  },
} as const;
