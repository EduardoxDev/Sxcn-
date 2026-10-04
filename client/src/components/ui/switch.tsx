import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/cn';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

export function Switch({ checked, onCheckedChange, id, disabled, ...aria }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={aria['aria-label']}
      className={cn(
        'inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-surface-hover ring-1 ring-inset ring-border-strong transition-colors',
        'data-[state=checked]:bg-brand data-[state=checked]:ring-transparent disabled:opacity-40',
      )}
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-fg shadow transition-transform duration-150 data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-brand-fg" />
    </SwitchPrimitive.Root>
  );
}
