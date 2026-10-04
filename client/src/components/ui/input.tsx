import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-lg bg-surface-raised px-3 text-sm text-fg ring-1 ring-inset ring-border transition-[box-shadow,background-color] placeholder:text-fg-muted',
        'hover:ring-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70',
        'aria-[invalid=true]:ring-danger/60 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('mb-1.5 block text-[13px] font-medium text-fg-secondary', className)}
      {...props}
    />
  );
}
