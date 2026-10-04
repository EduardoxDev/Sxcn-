import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      offset={88}
      mobileOffset={88}
      gap={8}
      visibleToasts={3}
      duration={3200}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-[min(340px,calc(100vw-32px))] items-center gap-3 rounded-lg bg-surface-raised px-3.5 py-3 text-[13px] text-fg shadow-pop',
          title: 'font-medium',
          description: 'text-fg-secondary text-xs mt-0.5',
          icon: 'text-fg-secondary [&_svg]:size-4',
          actionButton:
            'ml-auto shrink-0 rounded-md bg-surface-hover px-2.5 py-1 text-xs font-medium text-fg hover:bg-border-strong',
          success: '[&_[data-icon]]:text-success',
          error: '[&_[data-icon]]:text-danger',
          warning: '[&_[data-icon]]:text-warning',
        },
      }}
    />
  );
}
