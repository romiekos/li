import { contextBridge, ipcRenderer } from 'electron';
import type { LiBridge, LiSettings, PopupState, UpdaterState } from '../shared/types';

const bridge: LiBridge = {
  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<LiSettings>,
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings) as Promise<LiSettings>,
  resetSettings: () => ipcRenderer.invoke('settings:reset') as Promise<LiSettings>,
  getPopupState: () => ipcRenderer.invoke('popup:get-state') as Promise<PopupState>,
  closePopup: () => ipcRenderer.invoke('popup:close') as Promise<void>,
  openSettings: () => ipcRenderer.invoke('settings:open') as Promise<void>,
  onPopupState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: PopupState) => callback(state);
    ipcRenderer.on('popup-state', listener);
    return () => ipcRenderer.removeListener('popup-state', listener);
  },
  onSettingsUpdated: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, settings: LiSettings) => callback(settings);
    ipcRenderer.on('settings-updated', listener);
    return () => ipcRenderer.removeListener('settings-updated', listener);
  },
  pauseShortcuts: () => ipcRenderer.invoke('shortcuts:pause') as Promise<void>,
  resumeShortcuts: () => ipcRenderer.invoke('shortcuts:resume') as Promise<void>,
  getAppVersion: () => ipcRenderer.invoke('app:version') as Promise<string>,
  getUpdaterState: () => ipcRenderer.invoke('updater:get-state') as Promise<UpdaterState>,
  checkForUpdates: () => ipcRenderer.invoke('updater:check') as Promise<void>,
  installUpdate: () => ipcRenderer.invoke('updater:install') as Promise<void>,
  onUpdaterState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: UpdaterState) => callback(state);
    ipcRenderer.on('updater-state', listener);
    return () => ipcRenderer.removeListener('updater-state', listener);
  }
};

contextBridge.exposeInMainWorld('li', bridge);
