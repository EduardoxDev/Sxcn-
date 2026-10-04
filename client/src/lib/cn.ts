import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        'bg',
        'stage',
        'surface',
        'surface-raised',
        'surface-hover',
        'overlay',
        'border',
        'border-strong',
        'fg',
        'fg-secondary',
        'fg-muted',
        'brand',
        'brand-hover',
        'brand-muted',
        'brand-fg',
        'success',
        'success-muted',
        'warning',
        'warning-muted',
        'danger',
        'danger-muted',
        'black',
        'white',
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
