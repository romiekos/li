import { useEffect } from 'react';
import FloatingPopup from './components/FloatingPopup';
import SettingsView from './components/SettingsView';
import { useAppStore } from './store/useAppStore';
import type { AppTheme } from '../shared/types';

function applyTheme(theme: AppTheme, mq: MediaQueryList): void {
  const isDark = theme === 'auto' ? mq.matches : theme === 'dark';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
}

export default function App(): JSX.Element {
  const isSettings = window.location.hash.includes('settings');
  const loadSettings = useAppStore((state) => state.loadSettings);
  const setPopupState = useAppStore((state) => state.setPopupState);
  const theme = useAppStore((state) => state.settings?.theme ?? 'auto');

  const setSettings = useAppStore((state) => state.setSettings);

  useEffect(() => {
    void loadSettings();

    void window.li.getPopupState().then(setPopupState);

    const stopPopup = window.li.onPopupState(setPopupState);
    const stopSettings = window.li.onSettingsUpdated(setSettings);
    return () => {
      stopPopup();
      stopSettings();
    };
  }, [loadSettings, setPopupState, setSettings]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    applyTheme(theme, mq);

    if (theme !== 'auto') {
      return;
    }

    const onChange = () => applyTheme(theme, mq);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  return isSettings ? <SettingsView /> : <FloatingPopup />;
}
