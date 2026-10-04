import { initialsOf } from '@scxn/shared';
import { motion } from 'motion/react';
import { cn } from '@/lib/cn';

interface ParticipantAvatarProps {
  name: string;
  speaking?: boolean;
  dimmed?: boolean;
  size?: number;
  className?: string;
}

/** Initials avatar. Speaking = thin brand ring that eases in/out (no bouncing). */
export function ParticipantAvatar({
  name,
  speaking,
  dimmed,
  size = 28,
  className,
}: ParticipantAvatarProps) {
  return (
    <span
      aria-hidden
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <span
        className={cn(
          'flex size-full items-center justify-center rounded-full bg-surface-hover font-semibold text-fg-secondary ring-1 ring-inset ring-border-strong transition-opacity',
          dimmed && 'opacity-50',
        )}
        style={{ fontSize: Math.round(size * 0.4) }}
      >
        {initialsOf(name)}
      </span>
      <motion.span
        className="pointer-events-none absolute -inset-[3px] rounded-full ring-2 ring-brand"
        initial={false}
        animate={{ opacity: speaking ? 1 : 0, scale: speaking ? 1 : 0.92 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
      />
    </span>
  );
}
