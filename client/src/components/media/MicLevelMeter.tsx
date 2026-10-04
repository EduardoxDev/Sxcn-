import { useAudioLevel } from '@/hooks/useAudioLevel';
import { cn } from '@/lib/cn';

const SEGMENTS = 16;

/** Segmented input meter. Lights up in brand color — the same language as "speaking". */
export function MicLevelMeter({
  stream,
  enabled = true,
  className,
}: {
  stream: MediaStream | null;
  enabled?: boolean;
  className?: string;
}) {
  const level = useAudioLevel(stream, enabled);
  const lit = Math.round(level * SEGMENTS);
  return (
    <div
      role="meter"
      aria-label="Nível do microfone"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(level * 100)}
      className={cn('flex h-1.5 gap-[3px]', className)}
    >
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span
          key={i}
          className={cn(
            'flex-1 rounded-full transition-colors duration-75',
            i < lit ? 'bg-brand' : 'bg-surface-hover',
          )}
        />
      ))}
    </div>
  );
}
