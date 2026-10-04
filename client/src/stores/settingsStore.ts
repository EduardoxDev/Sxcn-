import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { FrameRate, Optimization, QualityPreset } from '@/lib/quality';

interface SettingsState {
  displayName: string;
  micDeviceId: string | null;
  outputDeviceId: string | null;
  quality: QualityPreset;
  fps: FrameRate;
  optimization: Optimization;
  reducedMotion: boolean;
  sidebarCollapsed: boolean;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

const safeStorage = createJSONStorage(() => {
  try {
    const probe = '__scxn__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
  }
});

/** User preferences — persisted per browser. Safe defaults: auto quality, 30 fps. */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      displayName: '',
      micDeviceId: null,
      outputDeviceId: null,
      quality: 'auto',
      fps: 30,
      optimization: 'detail',
      reducedMotion: false,
      sidebarCollapsed: false,
      set: (patch) => set(patch),
    }),
    {
      name: 'scxn:settings',
      version: 1,
      storage: safeStorage,
      partialize: ({ set: _set, ...rest }) => rest,
    },
  ),
);
