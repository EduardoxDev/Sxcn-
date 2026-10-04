import { create } from 'zustand';

export type StageFit = 'contain' | 'cover';

interface UiState {
  settingsOpen: boolean;
  settingsTab: 'audio' | 'stream' | 'interface' | 'about';
  inviteOpen: boolean;
  participantsDrawerOpen: boolean;
  stage: {
    fit: StageFit;
    zoom: number;
    panX: number;
    panY: number;
    showStats: boolean;
  };
  openSettings: (tab?: UiState['settingsTab']) => void;
  set: (patch: Partial<Omit<UiState, 'set' | 'openSettings' | 'setStage' | 'resetView'>>) => void;
  setStage: (patch: Partial<UiState['stage']>) => void;
  resetView: () => void;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export const useUi = create<UiState>()((set) => ({
  settingsOpen: false,
  settingsTab: 'audio',
  inviteOpen: false,
  participantsDrawerOpen: false,
  stage: { fit: 'contain', zoom: 1, panX: 0, panY: 0, showStats: false },
  openSettings: (tab) => set((s) => ({ settingsOpen: true, settingsTab: tab ?? s.settingsTab })),
  set: (patch) => set(patch),
  setStage: (patch) => set((s) => ({ stage: { ...s.stage, ...patch } })),
  resetView: () => set((s) => ({ stage: { ...s.stage, zoom: 1, panX: 0, panY: 0 } })),
}));
