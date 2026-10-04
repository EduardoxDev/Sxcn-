import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Kbd } from './kbd';

export const TooltipProvider = TooltipPrimitive.Provider;

interface TooltipProps {
  label: ReactNode;
  shortcut?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
  disabled?: boolean;
}

/** Tooltip with optional keyboard shortcut hint. Wrap a focusable element. */
export function Tooltip({ label, shortcut, side = 'top', children, disabled }: TooltipProps) {
  if (disabled) return <>{children}</>;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          collisionPadding={8}
          className={cn(
            'z-50 flex max-w-64 items-center gap-2 rounded-md bg-surface-raised px-2.5 py-1.5 text-xs font-medium text-fg shadow-pop',
            'data-[state=delayed-open]:animate-fade-in data-[state=closed]:animate-fade-out',
          )}
        >
          {label}
          {shortcut && <Kbd>{shortcut}</Kbd>}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
