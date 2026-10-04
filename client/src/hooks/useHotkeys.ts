import { useEffect, useRef } from 'react';
import { isTypingTarget } from '@/lib/browser';

type Handlers = Partial<Record<string, (e: KeyboardEvent) => void>>;

/**
 * Single-key shortcuts (M, S, F…). Ignored while typing, with modifiers held, or while a
 * dialog is open (Radix dialogs handle Esc themselves).
 */
export function useHotkeys(handlers: Handlers, enabled = true): void {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="menu"]')) return;
      const handler = ref.current[e.key.toLowerCase()];
      if (handler) {
        e.preventDefault();
        handler(e);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
