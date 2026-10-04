import { useId } from 'react';
import { cn } from '@/lib/cn';
import { customMarkSrc } from './logoAsset';

interface ScxnMarkProps {
  size?: number;
  /** Render the black rounded tile behind the eyes (app-icon look). */
  tile?: boolean;
  /** Very subtle periodic blink — used by loading states only. */
  blink?: boolean;
  className?: string;
}

/** The Scxn symbol: two stylized white eyes. */
export function ScxnMark({ size = 32, tile = false, blink = false, className }: ScxnMarkProps) {
  const uid = useId().replace(/:/g, '');

  if (customMarkSrc) {
    return (
      <img
        src={customMarkSrc}
        width={size}
        height={size}
        alt=""
        aria-hidden
        draggable={false}
        className={cn('select-none object-contain', blink && 'animate-blink', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden
      className={cn('shrink-0 text-white', className)}
    >
      <defs>
        <clipPath id={`${uid}l`}>
          <path d="M9 21.5 31 27.5V52H9Z" />
        </clipPath>
        <clipPath id={`${uid}r`}>
          <path d="M33 27.5 55 21.5V52H33Z" />
        </clipPath>
      </defs>
      {tile && <rect width="64" height="64" rx="14" className="fill-black" />}
      <g
        className={cn(blink && 'animate-blink')}
        style={{ transformOrigin: '32px 34px', transformBox: 'view-box' }}
      >
        <ellipse
          cx="21"
          cy="34"
          rx="7.5"
          ry="10.5"
          fill="currentColor"
          clipPath={`url(#${uid}l)`}
        />
        <ellipse
          cx="43"
          cy="34"
          rx="7.5"
          ry="10.5"
          fill="currentColor"
          clipPath={`url(#${uid}r)`}
        />
      </g>
    </svg>
  );
}
