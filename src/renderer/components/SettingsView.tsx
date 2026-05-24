import {
  ArrowDownToLine,
  CheckCircle,
  Eye,
  EyeOff,
  Keyboard,
  Loader2,
  MessageSquareText,
  Monitor,
  Moon,
  RefreshCw,
  RotateCcw,
  Save,
  ServerCog,
  Smile,
  Sun,
  Wand2,
  XCircle
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { AppTheme, HotkeySettings, LiSettings, ProviderId, StylePreset, UpdaterState } from '../../shared/types';

interface ProviderMeta {
  id: ProviderId;
  name: string;
  tagline: string;
  apiKeyField?: keyof LiSettings;
  apiKeyPlaceholder?: string;
  modelField: keyof LiSettings;
  urlField?: keyof LiSettings;
  popularModels?: string[];
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    tagline: 'GPT-5.* & o-series',
    apiKeyField: 'openaiApiKey',
    apiKeyPlaceholder: 'sk-...',
    modelField: 'openaiModel',
    popularModels: ['gpt-5.4-mini', 'gpt-5.4-nano', 'o4-mini']
  },
  {
    id: 'anthropic',
    name: 'Claude',
    tagline: 'Haiku, Sonnet & Opus 4',
    apiKeyField: 'anthropicApiKey',
    apiKeyPlaceholder: 'sk-ant-...',
    modelField: 'anthropicModel',
    popularModels: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-7']
  },
  {
    id: 'groq',
    name: 'Groq',
    tagline: 'Llama 4 & DeepSeek, ultra-fast',
    apiKeyField: 'groqApiKey',
    apiKeyPlaceholder: 'gsk_...',
    modelField: 'groqModel',
    popularModels: ['llama-4-scout-17b-16e-instruct', 'llama-4-maverick-17b-128e-instruct', 'deepseek-r1-distill-llama-70b']
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    tagline: 'Every model, one key',
    apiKeyField: 'openrouterApiKey',
    apiKeyPlaceholder: 'sk-or-...',
    modelField: 'openrouterModel',
    popularModels: ['gpt-5.4-mini', 'google/gemini-3.5-flash', 'anthropic/claude-sonnet-4-6', 'anthropic/claude-opus-4-7']
  },
  {
    id: 'gemini',
    name: 'Gemini',
    tagline: 'Flash 3.5 & Pro family',
    apiKeyField: 'geminiApiKey',
    apiKeyPlaceholder: 'AIza...',
    modelField: 'geminiModel',
    popularModels: ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.1-pro']
  },
  {
    id: 'ollama',
    name: 'Ollama',
    tagline: 'Local, private, free',
    modelField: 'ollamaModel',
    urlField: 'ollamaUrl'
  }
];
import { useAppStore } from '../store/useAppStore';
import HotkeyRecorder from './HotkeyRecorder';
import Logo from './Logo';

type SectionId = 'provider' | 'styles' | 'hotkeys' | 'voice' | 'updates' | 'appearance';

const sections: Array<{ id: SectionId; label: string; icon: typeof ServerCog }> = [
  { id: 'provider', label: 'Provider', icon: ServerCog },
  { id: 'styles', label: 'Styles', icon: Wand2 },
  { id: 'hotkeys', label: 'Hotkeys', icon: Keyboard },
  { id: 'voice', label: 'Voice', icon: MessageSquareText },
  { id: 'appearance', label: 'Appearance', icon: Sun },
  { id: 'updates', label: 'Updates', icon: ArrowDownToLine }
];

const HOTKEY_META: Array<{ key: keyof HotkeySettings; label: string; description: string }> = [
  { key: 'grammar',   label: 'Fix grammar',   description: 'Instantly fix grammar on selected text' },
  { key: 'rephrase',  label: 'Rephrase',      description: 'Rewrite selected text in the active style' },
  { key: 'translate', label: 'Translate',     description: 'Translate selected text to English' },
  { key: 'popup',     label: 'Style popup',   description: 'Open the floating style picker' }
];

function UpdaterIcon({ phase }: { phase: UpdaterState['phase'] }): JSX.Element {
  if (phase === 'checking' || phase === 'downloading') {
    return <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-dim" />;
  }
  if (phase === 'ready' || phase === 'not-available') {
    return <CheckCircle size={16} className="mt-0.5 shrink-0 text-acid" />;
  }
  if (phase === 'error') {
    return <XCircle size={16} className="mt-0.5 shrink-0 text-red-400" />;
  }
  return <CheckCircle size={16} className="mt-0.5 shrink-0 text-dim" />;
}

function UpdaterMessage({ state }: { state: UpdaterState }): JSX.Element {
  const { phase, version, progress, error } = state;
  if (phase === 'idle') {
    return <span className="text-sm text-dim">No update check run yet.</span>;
  }
  if (phase === 'checking') {
    return <span className="text-sm text-dim">Checking for updates…</span>;
  }
  if (phase === 'not-available') {
    return <span className="text-sm text-mist">You're up to date.</span>;
  }
  if (phase === 'available') {
    return <span className="text-sm text-mist">Update {version} found — downloading…</span>;
  }
  if (phase === 'downloading') {
    return (
      <div>
        <span className="text-sm text-mist">Downloading update… {progress ?? 0}%</span>
        <div className="mt-2 h-1 w-full overflow-hidden bg-line/40">
          <div className="h-full bg-acid transition-all" style={{ width: `${progress ?? 0}%` }} />
        </div>
      </div>
    );
  }
  if (phase === 'ready') {
    return <span className="text-sm text-mist">Version {version} is ready to install.</span>;
  }
  if (phase === 'error') {
    return <span className="text-sm text-red-400">{error ?? 'Update check failed.'}</span>;
  }
  return <span />;
}

function cloneSettings(settings: LiSettings): LiSettings {
  return {
    ...settings,
    hotkeys: { ...settings.hotkeys },
    stylePresets: settings.stylePresets.map((style) => ({ ...style })),
    usageStats: { ...settings.usageStats }
  };
}

export default function SettingsView(): JSX.Element {
  const settings = useAppStore((state) => state.settings);
  const loadSettings = useAppStore((state) => state.loadSettings);
  const saveSettings = useAppStore((state) => state.saveSettings);
  const resetSettings = useAppStore((state) => state.resetSettings);
  const [draft, setDraft] = useState<LiSettings | undefined>();
  const [section, setSection] = useState<SectionId>('provider');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');
  const [updaterState, setUpdaterState] = useState<UpdaterState>({ phase: 'idle' });

  useEffect(() => {
    void loadSettings();
    void window.li.getAppVersion().then(setAppVersion);
    void window.li.getUpdaterState().then(setUpdaterState);
    return window.li.onUpdaterState(setUpdaterState);
  }, [loadSettings]);

  useEffect(() => {
    if (settings) {
      setDraft(cloneSettings(settings));
    }
  }, [settings]);

  const dirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(draft), [draft, settings]);

  function update<K extends keyof LiSettings>(key: K, value: LiSettings[K]): void {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setSaved(false);
  }

  function updateStyle(styleId: string, patch: Partial<StylePreset>): void {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        stylePresets: current.stylePresets.map((style) =>
          style.id === styleId ? { ...style, ...patch } : style
        )
      };
    });
    setSaved(false);
  }

  async function save(): Promise<void> {
    if (!draft) {
      return;
    }

    await saveSettings(draft);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  }

  async function reset(): Promise<void> {
    await resetSettings();
    setSaved(false);
  }

  if (!draft) {
    return (
      <main className="settings-shell grid min-h-screen place-items-center font-mono text-mist">
        Li settings loading
      </main>
    );
  }

  return (
    <main className="settings-shell h-screen overflow-y-auto text-mist">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-[220px_1fr]">
        <aside className="sticky top-0 flex h-screen flex-col border-r border-line/80 bg-ink px-4 py-5">
          <div className="mb-8">
            <Logo size={32} className="text-acid" />
            <div className="mt-2 font-mono text-xs uppercase tracking-[0.24em] text-dim">rewrite layer</div>
          </div>

          <nav className="grid gap-1">
            {sections.map((item) => {
              const Icon = item.icon;
              const active = item.id === section;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`settings-nav ${active ? 'settings-nav-active' : ''}`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto">
            {settings && (
              <div className="mb-3 border border-line/60 bg-panel/60 px-3 py-2.5">
                <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-dim">Usage</div>
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-dim">Rewrites</span>
                    <span className="font-mono text-xs text-sub">{new Intl.NumberFormat().format(settings.usageStats.rewriteCount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-dim">Symbols</span>
                    <span className="font-mono text-xs text-sub">{new Intl.NumberFormat().format(settings.usageStats.symbolCount)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="border border-line/80 bg-panel p-3 font-mono text-xs leading-relaxed text-dim">
              Settings stay on this device. Li sends selected text only to the provider you choose.
            </div>
          </div>
        </aside>

        <section className="px-8 py-6">
          <header className="mb-6 flex items-center justify-between border-b border-line/80 pb-4">
            <div>
              <h1 className="font-mono text-2xl text-mist">{sections.find((item) => item.id === section)?.label}</h1>
              <p className="mt-1 text-sm text-dim">Sharp, local, fast. Long explanations stay outside.</p>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" className="secondary-button" onClick={reset}>
                <RotateCcw size={16} />
                <span>Reset</span>
              </button>
              <button type="button" className="primary-button" disabled={!dirty} onClick={save}>
                <Save size={16} />
                <span>{saved ? 'Saved' : dirty ? 'Save' : 'Saved'}</span>
              </button>
            </div>
          </header>

          {section === 'provider' ? (() => {
            const activeMeta = PROVIDERS.find((p) => p.id === draft.provider) ?? PROVIDERS[0];
            const modelValue = String(draft[activeMeta.modelField] ?? '');
            const apiKeyValue = activeMeta.apiKeyField ? String(draft[activeMeta.apiKeyField] ?? '') : '';
            const urlValue = activeMeta.urlField ? String(draft[activeMeta.urlField] ?? '') : '';

            return (
              <div className="grid gap-4">
                {/* Provider cards */}
                <div className="grid grid-cols-3 gap-2">
                  {PROVIDERS.map((p) => {
                    const active = draft.provider === p.id;
                    const hasKey = p.apiKeyField
                      ? Boolean((draft[p.apiKeyField] as string)?.trim())
                      : Boolean(urlValue.trim());
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { update('provider', p.id); setShowKey(false); }}
                        className={`group relative flex flex-col items-start border px-3 py-2.5 text-left transition ${
                          active
                            ? 'border-acid bg-acid/8 text-mist'
                            : 'border-line bg-panel text-sub hover:border-mist/30 hover:text-mist'
                        }`}
                      >
                        <span className={`font-mono text-xs font-medium uppercase tracking-[0.14em] ${active ? 'text-acid' : ''}`}>
                          {p.name}
                        </span>
                        <span className="mt-0.5 text-[11px] text-dim">{p.tagline}</span>
                        {hasKey && (
                          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-acid/70" title="Configured" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Provider-specific fields */}
                <div className="settings-panel !mb-0">
                  {activeMeta.apiKeyField ? (
                    <div className="field">
                      <span>API key</span>
                      <div className="flex gap-2">
                        <input
                          value={apiKeyValue}
                          onChange={(e) => update(activeMeta.apiKeyField!, e.target.value)}
                          type={showKey ? 'text' : 'password'}
                          className="input flex-1"
                          placeholder={activeMeta.apiKeyPlaceholder}
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          className="h-11 border border-line bg-panel px-3 text-sub hover:border-cyan hover:text-mist"
                          onClick={() => setShowKey((v) => !v)}
                          aria-label={showKey ? 'Hide key' : 'Show key'}
                        >
                          {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {activeMeta.urlField ? (
                    <label className="field">
                      <span>Server URL</span>
                      <input
                        value={urlValue}
                        onChange={(e) => update(activeMeta.urlField!, e.target.value)}
                        className="input"
                        placeholder="http://127.0.0.1:11434"
                      />
                    </label>
                  ) : null}

                  <div className="field !mb-0">
                    <span>Model</span>
                    <input
                      value={modelValue}
                      onChange={(e) => update(activeMeta.modelField, e.target.value)}
                      className="input"
                      placeholder="model name"
                    />
                    {activeMeta.popularModels ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {activeMeta.popularModels.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => update(activeMeta.modelField, m)}
                            className={`border px-2 py-0.5 font-mono text-[11px] transition ${
                              modelValue === m
                                ? 'border-acid/60 bg-acid/10 text-acid'
                                : 'border-line/60 text-sub hover:border-mist/40 hover:text-mist'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Dev logging */}
                <label className="toggle-row !mb-0">
                  <span>
                    <span className="block text-sm text-mist">Developer logging</span>
                    <span className="block text-xs text-dim">Logs status and character counts, never selected text.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={draft.devLogging}
                    onChange={(event) => update('devLogging', event.target.checked)}
                  />
                </label>
              </div>
            );
          })() : null}

          {section === 'styles' ? (
            <div className="grid gap-3">
              {draft.stylePresets.map((style) => (
                <div key={style.id} className="settings-panel">
                  <div className="grid grid-cols-[220px_1fr] gap-3">
                    <label className="field">
                      <span>Name</span>
                      <input
                        value={style.label}
                        onChange={(event) => updateStyle(style.id, { label: event.target.value })}
                        className="input"
                      />
                    </label>
                    <label className="field">
                      <span>Description</span>
                      <input
                        value={style.description}
                        onChange={(event) => updateStyle(style.id, { description: event.target.value })}
                        className="input"
                      />
                    </label>
                  </div>
                  <label className="field">
                    <span>Instruction</span>
                    <textarea
                      value={style.instruction}
                      onChange={(event) => updateStyle(style.id, { instruction: event.target.value })}
                      className="textarea min-h-[86px]"
                    />
                  </label>
                  <label className="toggle-row">
                    <span>
                      <span className="block text-sm text-mist">Use as default rephrase style</span>
                      <span className="block text-xs text-dim">This is what Command+Control+R uses.</span>
                    </span>
                    <input
                      type="radio"
                      name="selectedStyle"
                      checked={draft.selectedStyleId === style.id}
                      onChange={() => update('selectedStyleId', style.id)}
                    />
                  </label>
                </div>
              ))}
            </div>
          ) : null}

          {section === 'hotkeys' ? (
            <div className="settings-panel">
              {HOTKEY_META.map(({ key, label, description }) => (
                <HotkeyRecorder
                  key={key}
                  label={label}
                  description={description}
                  value={draft.hotkeys[key]}
                  onChange={(value) =>
                    setDraft((current) =>
                      current ? { ...current, hotkeys: { ...current.hotkeys, [key]: value } } : current
                    )
                  }
                />
              ))}
            </div>
          ) : null}

          {section === 'voice' ? (
            <div className="settings-panel">
              <label className="toggle-row">
                <span className="flex items-center gap-3">
                  <Smile size={18} />
                  <span>
                    <span className="block text-sm text-mist">Emoji when natural</span>
                    <span className="block text-xs text-dim">Off means Li explicitly asks providers not to add emoji.</span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={draft.emojiEnabled}
                  onChange={(event) => update('emojiEnabled', event.target.checked)}
                />
              </label>

              <label className="field">
                <span>Personal writing style</span>
                <textarea
                  value={draft.personalWritingStyle}
                  onChange={(event) => update('personalWritingStyle', event.target.value)}
                  className="textarea min-h-[220px]"
                  placeholder="Paste examples or describe your default voice."
                />
              </label>
            </div>
          ) : null}

          {section === 'appearance' ? (
            <div className="settings-panel">
              <div className="field mb-0">
                <span>Theme</span>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: 'dark', label: 'Dark', Icon: Moon },
                      { value: 'light', label: 'Light', Icon: Sun },
                      { value: 'auto', label: 'Auto', Icon: Monitor }
                    ] as Array<{ value: AppTheme; label: string; Icon: typeof Sun }>
                  ).map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => update('theme', value)}
                      className={`flex flex-col items-center gap-2 border py-4 text-xs font-mono uppercase tracking-[0.16em] transition ${
                        draft.theme === value
                          ? 'border-acid bg-acid/10 text-acid'
                          : 'border-line bg-ink text-sub hover:border-mist/40 hover:text-mist'
                      }`}
                    >
                      <Icon size={18} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-dim">
                  Auto follows your system appearance setting.
                </p>
              </div>
            </div>
          ) : null}

          {section === 'updates' ? (
            <div className="settings-panel">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-sm text-mist">Current version</span>
                  <span className="font-mono text-xs text-dim">{appVersion || '—'}</span>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={updaterState.phase === 'checking' || updaterState.phase === 'downloading'}
                  onClick={() => void window.li.checkForUpdates()}
                >
                  <RefreshCw size={15} className={updaterState.phase === 'checking' ? 'animate-spin' : ''} />
                  <span>Check for updates</span>
                </button>
              </div>

              <div className="mt-2 flex items-start gap-3 border border-line/60 bg-panel p-4">
                <UpdaterIcon phase={updaterState.phase} />
                <div className="flex-1">
                  <UpdaterMessage state={updaterState} />
                </div>
                {updaterState.phase === 'ready' ? (
                  <button
                    type="button"
                    className="primary-button shrink-0"
                    onClick={() => void window.li.installUpdate()}
                  >
                    <ArrowDownToLine size={15} />
                    <span>Restart &amp; Install</span>
                  </button>
                ) : null}
              </div>

              <p className="text-xs leading-relaxed text-dim">
                Updates are downloaded in the background and installed when you restart Li.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
