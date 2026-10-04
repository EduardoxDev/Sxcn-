import * as Menu from '@radix-ui/react-dropdown-menu';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/cn';

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentPropsWithoutRef<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(
          'z-50 min-w-44 rounded-lg bg-surface-raised p-1 shadow-pop data-[state=open]:animate-fade-in',
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  );
}

export function DropdownMenuItem({
  className,
  destructive,
  ...props
}: ComponentPropsWithoutRef<typeof Menu.Item> & { destructive?: boolean }) {
  return (
    <Menu.Item
      className={cn(
        'flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2.5 text-[13px] text-fg-secondary outline-none [&_svg]:size-3.5',
        'data-[highlighted]:bg-surface-hover data-[highlighted]:text-fg data-[disabled]:opacity-40',
        destructive && 'data-[highlighted]:bg-danger-muted data-[highlighted]:text-danger',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator() {
  return <Menu.Separator className="-mx-1 my-1 h-px bg-border" />;
}
