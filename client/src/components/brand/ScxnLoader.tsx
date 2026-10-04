import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { ScxnMark } from './ScxnMark';

interface ScxnLoaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

/** Branded, contextual loading state — never a bare spinner. */
export function ScxnLoader({ title, description, children }: ScxnLoaderProps) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <ScxnMark size={56} blink />
      </motion.div>
      <p className="mt-5 text-sm font-medium text-fg">{title}</p>
      {description && <p className="mt-1 max-w-xs text-[13px] text-fg-secondary">{description}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
