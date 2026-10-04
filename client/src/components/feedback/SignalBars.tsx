import type { LinkQuality } from '@scxn/shared';
import { cn } from '@/lib/cn';

const LEVEL: Record<LinkQuality, number> = { unknown: 0, poor: 1, fair: 2, good: 3 };
const TONE: Record<LinkQuality, string> = {
  unknown: 'bg-fg-muted',
  poor: 'bg-danger',
  fair: 'bg-warning',
  good: 'bg-success',
};

/** Three-bar link quality indicator. */
export function SignalBars({ quality, className }: { quality: LinkQuality; className?: string }) {
  const level = LEVEL[quality];
  return (
    <span aria-hidden className={cn('inline-flex h-3 items-end gap-[2px]', className)}>
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={cn(
            'w-[3px] rounded-[1px] transition-colors',
            bar === 1 ? 'h-1' : bar === 2 ? 'h-2' : 'h-3',
            bar <= level ? TONE[quality] : 'bg-border-strong',
          )}
        />
      ))}
    </span>
  );
}
