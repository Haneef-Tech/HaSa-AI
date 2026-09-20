"use client";

import React from "react";
import { motion, type Variants } from "framer-motion";

const EASE = [0.21, 1.02, 0.73, 1] as const;

export function FadeUp({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [...EASE] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [...EASE] } },
};

export function Stagger({
  children,
  className,
  component = "div",
}: {
  children: React.ReactNode;
  className?: string;
  component?: "div" | "tbody";
}) {
  const Tag = component === "tbody" ? motion.tbody : motion.div;
  return (
    <Tag variants={staggerParent} initial="hidden" animate="show" className={className}>
      {children}
    </Tag>
  );
}

export function StaggerItem({
  children,
  className,
  component = "div",
}: {
  children: React.ReactNode;
  className?: string;
  component?: "div" | "tr";
}) {
  const Tag = component === "tr" ? motion.tr : motion.div;
  return (
    <Tag variants={staggerChild} className={className}>
      {children}
    </Tag>
  );
}

/** Animated number that counts up on mount — for stat cards. */
export function AnimatedCounter({
  value,
  format,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = React.useState(0);
  React.useEffect(() => {
    const start = performance.now();
    const duration = 900;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  const text = format ? format(display) : display.toLocaleString();
  return <span className={className}>{text}</span>;
}
