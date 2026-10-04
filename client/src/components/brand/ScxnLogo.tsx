import { cn } from '@/lib/cn';
import { customLogoSrc } from './logoAsset';
import { ScxnMark } from './ScxnMark';

type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<LogoSize, { mark: number; text: string; gap: string }> = {
  xs: { mark: 18, text: 'text-[13px]', gap: 'gap-1.5' },
  sm: { mark: 22, text: 'text-[15px]', gap: 'gap-2' },
  md: { mark: 32, text: 'text-xl', gap: 'gap-2.5' },
  lg: { mark: 56, text: 'text-3xl', gap: 'gap-3' },
  xl: { mark: 88, text: 'text-5xl', gap: 'gap-4' },
};

interface ScxnLogoProps {
  /** `full` = symbol + wordmark, `mark` = symbol only. */
  variant?: 'full' | 'mark';
  size?: LogoSize;
  tile?: boolean;
  blink?: boolean;
  className?: string;
}

export function ScxnLogo({ variant = 'full', size = 'sm', tile, blink, className }: ScxnLogoProps) {
  const s = SIZES[size];

  if (variant === 'full' && customLogoSrc) {
    return (
      <img
        src={customLogoSrc}
        alt="Scxn"
        draggable={false}
        className={cn('select-none object-contain', className)}
        style={{ height: s.mark }}
      />
    );
  }

  if (variant === 'mark') {
    return (
      <span role="img" aria-label="Scxn" className={cn('inline-flex', className)}>
        <ScxnMark size={s.mark} tile={tile} blink={blink} />
      </span>
    );
  }

  return (
    <span role="img" aria-label="Scxn" className={cn('inline-flex items-center', s.gap, className)}>
      <ScxnMark size={s.mark} tile={tile} blink={blink} />
      <span aria-hidden className={cn('font-semibold tracking-[-0.03em] text-fg', s.text)}>
        Scxn
      </span>
    </span>
  );
}
