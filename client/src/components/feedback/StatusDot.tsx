import { cn } from '@/lib/cn';

export type DotTone = 'success' | 'warning' | 'danger' | 'brand' | 'muted';

const TONES: Record<DotTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  brand: 'bg-brand',
  muted: 'bg-fg-muted',
};

export function StatusDot({
  tone,
  pulse,
  className,
}: {
  tone: DotTone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-1.5 shrink-0 rounded-full',
        TONES[tone],
        pulse && 'animate-live-pulse',
        className,
      )}
    />
  );
}
