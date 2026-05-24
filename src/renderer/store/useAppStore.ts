import { create } from 'zustand';
import type { LiSettings, PopupState } from '../../shared/types';

interface AppStore {
  settings?: LiSettings;
  popupState: PopupState;
  loadSettings: () => Promise<void>;
  saveSettings: (settings: LiSettings) => Promise<void>;
  resetSettings: () => Promise<void>;
  setPopupState: (state: PopupState) => void;
  setSettings: (settings: LiSettings) => void;
}

const defaultPopupState: PopupState = {
  visible: false,
  mode: 'palette',
  status: 'idle',
  message: ''
};

export const useAppStore = create<AppStore>((set) => ({
  popupState: defaultPopupState,
  loadSettings: async () => {
    const settings = await window.li.getSettings();
    set({ settings });
  },
  saveSettings: async (settings) => {
    const next = await window.li.saveSettings(settings);
    set({ settings: next });
  },
  resetSettings: async () => {
    const settings = await window.li.resetSettings();
    set({ settings });
  },
  setPopupState: (popupState) => set({ popupState }),
  setSettings: (settings) => set({ settings })
}));
