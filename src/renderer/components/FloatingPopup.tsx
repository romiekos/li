import { Cog, X } from 'lucide-react';
import Logo from './Logo';
import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import StyleSelector from './StyleSelector';

export default function FloatingPopup(): JSX.Element {
  const settings = useAppStore((state) => state.settings);
  const popupState = useAppStore((state) => state.popupState);
  const saveSettings = useAppStore((state) => state.saveSettings);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedToneId, setSelectedToneId] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const styles = useMemo(() => settings?.stylePresets || [], [settings?.stylePresets]);
  const toneStyles = useMemo(
    () => styles.filter((style) => style.action !== 'grammar' && style.action !== 'translate'),
    [styles]
  );
  const selectedStyleId = selectedToneId || popupState.styleId || settings?.selectedStyleId || toneStyles[0]?.id || '';
  const activeStyleId = toneStyles[activeIndex]?.id || selectedStyleId;
  const selectedTone = toneStyles.find((style) => style.id === selectedStyleId) || toneStyles[0];

  useEffect(() => {
    if (popupState.visible) {
      setSelectedToneId('');
      setStatusMessage('');
    }
  }, [popupState.styleId, popupState.visible]);

  useEffect(() => {
    const index = Math.max(
      0,
      toneStyles.findIndex((style) => style.id === selectedStyleId)
    );
    setActiveIndex(index);
  }, [selectedStyleId, toneStyles]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void window.li.closePopup();
        return;
      }

      if (popupState.mode !== 'palette') {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setStatusMessage('');
        setActiveIndex((current) => Math.min(Math.max(0, toneStyles.length - 1), current + 1));
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setStatusMessage('');
        setActiveIndex((current) => Math.max(0, current - 1));
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        void saveTone(activeStyleId);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeStyleId, popupState.mode, toneStyles.length]);

  async function saveTone(styleId: string): Promise<void> {
    if (!settings) {
      return;
    }

    const index = toneStyles.findIndex((style) => style.id === styleId);
    const style = toneStyles[index];

    setSelectedToneId(styleId);
    setActiveIndex(Math.max(0, index));
    await saveSettings({ ...settings, selectedStyleId: styleId });
    setStatusMessage(`${style?.label || 'Tone'} saved`);
  }

  if (!settings) {
    return <div className="popup-shell p-4 font-mono text-sm text-mist">Li loading</div>;
  }

  const isProgress = popupState.mode === 'progress';

  if (isProgress) {
    const stateClass =
      popupState.status === 'success'
        ? 'li-spinner-done'
        : popupState.status === 'error'
          ? 'li-spinner-error'
          : 'li-spinner';

    return (
      <main className="progress-shell" aria-label={popupState.message || 'Li is rewriting'}>
        <div className={stateClass} />
      </main>
    );
  }

  return (
    <main className="popup-shell flex h-screen flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-line/70 px-3 py-2">
        <div className="flex items-center gap-2 text-acid">
          <Logo size={16} />
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-mist">style prefs</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Open settings"
            title="Open settings"
            onClick={() => window.li.openSettings()}
            className="icon-button"
          >
            <Cog size={15} />
          </button>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={() => window.li.closePopup()}
            className="icon-button"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <section className="flex min-h-0 flex-1 flex-col p-3">
        <div className="mb-3 border border-line/80 bg-panel/70 px-3 py-2 font-mono">
          <span className="block text-[10px] uppercase tracking-[0.18em] text-dim">preferred tone</span>
          <span className="block truncate text-sm text-mist">{selectedTone?.label || 'Tone'}</span>
        </div>

        <div className="tone-scroll">
          <StyleSelector
            styles={toneStyles}
            selectedId={selectedStyleId}
            activeIndex={activeIndex}
            onSelect={(styleId) => {
              void saveTone(styleId);
            }}
          />
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3 border-t border-line/60 pt-2 font-mono text-[11px] text-dim">
          <span className="truncate">{statusMessage || 'enter saves highlighted tone'}</span>
          <span>esc closes</span>
        </div>
      </section>
    </main>
  );
}
