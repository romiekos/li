import { globalShortcut } from 'electron';
import type { HotkeySettings, RewriteAction } from '../shared/types';

interface ShortcutHandlers {
  onRewrite: (action: RewriteAction) => void;
  onPopup: () => void;
}

export function registerShortcuts(hotkeys: HotkeySettings, handlers: ShortcutHandlers): string[] {
  globalShortcut.unregisterAll();

  const failures: string[] = [];
  const registrations: Array<[string, () => void]> = [
    [hotkeys.grammar, () => handlers.onRewrite('grammar')],
    [hotkeys.rephrase, () => handlers.onRewrite('rephrase')],
    [hotkeys.translate, () => handlers.onRewrite('translate')],
    [hotkeys.popup, handlers.onPopup]
  ];

  for (const [accelerator, callback] of registrations) {
    if (!accelerator.trim()) {
      continue;
    }

    const ok = globalShortcut.register(accelerator, callback);
    if (!ok) {
      failures.push(accelerator);
    }
  }

  return failures;
}
