import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,color,border-color,box-shadow,opacity] duration-150 disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-brand-fg hover:bg-brand-hover active:bg-brand',
        secondary:
          'bg-surface-raised text-fg ring-1 ring-inset ring-border hover:bg-surface-hover hover:ring-border-strong',
        ghost: 'text-fg-secondary hover:bg-surface-hover hover:text-fg',
        outline: 'text-fg ring-1 ring-inset ring-border-strong hover:bg-surface-hover',
        danger: 'bg-danger text-white hover:bg-danger/90',
        'danger-ghost': 'text-fg-secondary hover:bg-danger-muted hover:text-danger',
      },
      size: {
        sm: 'h-8 rounded-md px-3 text-[13px] [&_svg]:size-3.5',
        md: 'h-9 rounded-md px-3.5 text-sm [&_svg]:size-4',
        lg: 'h-11 rounded-lg px-5 text-[15px] [&_svg]:size-[18px]',
        icon: 'size-9 rounded-md [&_svg]:size-4',
        'icon-sm': 'size-7 rounded-md [&_svg]:size-3.5',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, type = 'button', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
