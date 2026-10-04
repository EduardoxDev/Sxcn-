import {
  Ban,
  CircleSlash,
  Clock,
  Globe,
  Lock,
  MicOff,
  MonitorX,
  ServerCrash,
  TriangleAlert,
  UserX,
  Users,
  VideoOff,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { ERROR_COPY, type AppErrorKind } from '@/lib/errors';
import { cn } from '@/lib/cn';

const ICONS: Record<AppErrorKind, LucideIcon> = {
  'room-not-found': CircleSlash,
  'room-ended': Clock,
  'room-full': Users,
  'room-limit': ServerCrash,
  kicked: UserX,
  'invalid-code': Ban,
  'mic-blocked': MicOff,
  'mic-unavailable': MicOff,
  'mic-busy': MicOff,
  'screen-blocked': Lock,
  'screen-unsupported': MonitorX,
  'screen-timeout': Clock,
  'screen-interrupted': MonitorX,
  'virtual-camera-missing': VideoOff,
  'virtual-camera-blocked': Lock,
  'browser-unsupported': Globe,
  'webrtc-failed': WifiOff,
  'signaling-failed': ServerCrash,
  'connection-lost': WifiOff,
  'rate-limited': Clock,
  unknown: TriangleAlert,
};

interface ErrorStateProps {
  kind: AppErrorKind;
  actions?: ReactNode;
  compact?: boolean;
  className?: string;
}

/** Specific, actionable error: what happened + how to fix it + what to do next. */
export function ErrorState({ kind, actions, compact, className }: ErrorStateProps) {
  const Icon = ICONS[kind];
  const copy = ERROR_COPY[kind];
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={cn('flex flex-col items-center text-center', className)}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-xl bg-surface-raised text-fg-secondary ring-1 ring-inset ring-border',
          compact ? 'size-10' : 'size-12',
        )}
      >
        <Icon className={compact ? 'size-[18px]' : 'size-5'} strokeWidth={1.75} />
      </div>
      <h2
        className={cn(
          'font-semibold tracking-tight text-fg',
          compact ? 'mt-3 text-sm' : 'mt-5 text-lg',
        )}
      >
        {copy.title}
      </h2>
      <p
        className={cn(
          'max-w-sm text-fg-secondary',
          compact ? 'mt-1 text-xs' : 'mt-2 text-sm leading-relaxed',
        )}
      >
        {copy.description}
      </p>
      {actions && (
        <div className={cn('flex flex-wrap justify-center gap-2', compact ? 'mt-4' : 'mt-6')}>
          {actions}
        </div>
      )}
    </motion.div>
  );
}
