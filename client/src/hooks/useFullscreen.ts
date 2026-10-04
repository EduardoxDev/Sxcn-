import { useCallback, useSyncExternalStore, type RefObject } from 'react';

const subscribe = (cb: () => void) => {
  document.addEventListener('fullscreenchange', cb);
  return () => document.removeEventListener('fullscreenchange', cb);
};

export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const isFullscreen = useSyncExternalStore(
    subscribe,
    () => Boolean(document.fullscreenElement) && document.fullscreenElement === ref.current,
    () => false,
  );

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await ref.current?.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      /* fullscreen refused (iframe policy, iOS) — no-op */
    }
  }, [ref]);

  return {
    isFullscreen,
    toggle,
    supported: typeof document !== 'undefined' && document.fullscreenEnabled,
  };
}
