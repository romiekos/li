import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface HotkeyRecorderProps {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}

// Keys that are only modifiers — never the trigger key.
const MODIFIER_KEYS = new Set([
  'Control', 'Shift', 'Alt', 'Meta',
  'CapsLock', 'NumLock', 'ScrollLock', 'Dead', 'Process',
  'AltGraph', 'Fn', 'FnLock', 'Hyper', 'Super', 'Symbol', 'SymbolLock'
]);

// event.key → Electron accelerator name (only entries that differ)
const KEY_MAP: Record<string, string> = {
  ' ':          'Space',
  ArrowUp:      'Up',
  ArrowDown:    'Down',
  ArrowLeft:    'Left',
  ArrowRight:   'Right',
  Enter:        'Return',
  '+':          'Plus',
  // everything else (a-z, 0-9, F1-F24, Backspace, Delete, Tab, Home, End,
  // PageUp, PageDown, Insert, Escape) matches directly
};

function eventToAccelerator(event: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(event.key)) return null;

  const modifiers: string[] = [];
  if (event.metaKey)  modifiers.push('Command');
  if (event.ctrlKey)  modifiers.push('Control');
  if (event.altKey)   modifiers.push('Alt');
  if (event.shiftKey) modifiers.push('Shift');

  let key: string;
  if (/^[a-zA-Z]$/.test(event.key)) {
    key = event.key.toUpperCase();
  } else if (/^[0-9]$/.test(event.key)) {
    key = event.key;
  } else if (/^F\d{1,2}$/.test(event.key)) {
    key = event.key;
  } else if (KEY_MAP[event.key]) {
    key = KEY_MAP[event.key];
  } else if (event.key.length === 1) {
    // Punctuation / symbol keys — pass through
    key = event.key;
  } else if (
    ['Backspace', 'Delete', 'Tab', 'Escape',
     'Home', 'End', 'PageUp', 'PageDown', 'Insert'].includes(event.key)
  ) {
    key = event.key;
  } else {
    return null;
  }

  return [...modifiers, key].join('+');
}

// Electron accelerator part → display symbol or label
const DISPLAY_MAP: Record<string, string> = {
  Command:   '⌘',
  Control:   '⌃',
  Alt:       '⌥',
  Shift:     '⇧',
  Up:        '↑',
  Down:      '↓',
  Left:      '←',
  Right:     '→',
  Return:    '↩',
  Space:     '␣',
  Backspace: '⌫',
  Delete:    '⌦',
  Escape:    '⎋',
  Tab:       '⇥',
  Plus:      '+',
};

function displayPart(part: string): string {
  return DISPLAY_MAP[part] ?? part;
}

export default function HotkeyRecorder({ label, description, value, onChange }: HotkeyRecorderProps): JSX.Element {
  const [recording, setRecording] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const parts = value ? value.split('+') : [];

  async function startRecording(): Promise<void> {
    await window.li.pauseShortcuts();
    setRecording(true);
    buttonRef.current?.focus();
  }

  function cancelRecording(): void {
    setRecording(false);
    void window.li.resumeShortcuts();
  }

  useEffect(() => {
    if (!recording) return;

    function onKeyDown(event: KeyboardEvent): void {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        cancelRecording();
        return;
      }

      const accelerator = eventToAccelerator(event);
      if (accelerator) {
        onChange(accelerator);
        setRecording(false);
        void window.li.resumeShortcuts();
      }
    }

    // Use capture phase so we intercept before anything else
    window.addEventListener('keydown', onKeyDown, true);
    // Cancel if window loses focus mid-recording
    window.addEventListener('blur', cancelRecording);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('blur', cancelRecording);
    };
  }, [recording, onChange]);

  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/40 py-3 last:border-b-0">
      <span>
        <span className="block text-sm text-mist">{label}</span>
        <span className="block text-xs text-dim">{description}</span>
      </span>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          ref={buttonRef}
          type="button"
          title={recording ? 'Press a key combination (Esc to cancel)' : 'Click to record a new shortcut'}
          onClick={() => (recording ? cancelRecording() : void startRecording())}
          className={`flex h-9 min-w-[148px] items-center justify-center gap-0.5 border px-2 font-mono text-xs transition ${
            recording
              ? 'border-acid bg-acid/10 text-acid'
              : value
                ? 'border-line bg-panel text-mist hover:border-acid/60'
                : 'border-dashed border-line/50 bg-panel/50 text-dim hover:border-acid hover:text-sub'
          }`}
        >
          {recording ? (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-acid" />
              <span>Press shortcut…</span>
            </span>
          ) : parts.length > 0 ? (
            parts.map((part, i) => (
              <kbd
                key={i}
                className="inline-flex h-5 min-w-[18px] items-center justify-center border border-line/70 bg-ink px-1 text-[11px] leading-none text-mist"
              >
                {displayPart(part)}
              </kbd>
            ))
          ) : (
            <span>— unset —</span>
          )}
        </button>

        <button
          type="button"
          title="Clear shortcut"
          disabled={!value && !recording}
          onClick={recording ? cancelRecording : () => onChange('')}
          className="flex h-9 w-9 shrink-0 items-center justify-center border border-line/50 text-dim transition hover:border-ember/70 hover:text-ember disabled:pointer-events-none disabled:opacity-0"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
