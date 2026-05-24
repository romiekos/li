import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { HotkeySettings, LiSettings, StylePreset, UsageStats } from '../shared/types';

// All fields that hold sensitive API keys and should be encrypted at rest.
const API_KEY_FIELDS = [
  'openaiApiKey',
  'anthropicApiKey',
  'groqApiKey',
  'openrouterApiKey',
  'geminiApiKey'
] as const;

type ApiKeyField = (typeof API_KEY_FIELDS)[number];

type StoredSettings = Omit<LiSettings, ApiKeyField> &
  Partial<Record<ApiKeyField, string>> &
  Partial<Record<`${ApiKeyField}Encrypted`, string>>;

// Electron's `Command` accelerator is mac-only; on Win/Linux registration
// silently fails. Use Ctrl+Alt as the two-modifier analog elsewhere.
const defaultHotkeys: HotkeySettings =
  process.platform === 'darwin'
    ? {
        grammar: 'Command+Control+G',
        rephrase: 'Command+Control+R',
        translate: 'Command+Control+T',
        popup: 'Command+Control+P'
      }
    : {
        grammar: 'Control+Alt+G',
        rephrase: 'Control+Alt+R',
        translate: 'Control+Alt+T',
        popup: 'Control+Alt+P'
      };

const defaultUsageStats: UsageStats = {
  rewriteCount: 0,
  symbolCount: 0
};

export const defaultStylePresets: StylePreset[] = [
  {
    id: 'grammar',
    label: 'Grammar only',
    description: 'Clean, minimal fixes',
    instruction: 'Only fix grammar, punctuation, spelling, and clarity. Keep tone and structure intact.',
    action: 'grammar',
    builtIn: true
  },
  {
    id: 'friendly',
    label: 'Friendly',
    description: 'Warm and easy',
    instruction: 'Make it warmer, clearer, and more conversational without becoming chatty.',
    builtIn: true
  },
  {
    id: 'business',
    label: 'Business',
    description: 'Crisp and professional',
    instruction: 'Make it polished, direct, and workplace-ready without sounding stiff.',
    builtIn: true
  },
  {
    id: 'concise',
    label: 'Concise',
    description: 'Shorter, same meaning',
    instruction: 'Reduce length and remove filler while preserving meaning and useful nuance.',
    builtIn: true
  },
  {
    id: 'funny',
    label: 'Funny',
    description: 'Lightly playful',
    instruction: 'Make it lightly funny and human, but do not force jokes or change facts.',
    builtIn: true
  },
  {
    id: 'curious',
    label: 'Curious',
    description: 'Open and thoughtful',
    instruction: 'Make it sound curious, open-minded, and thoughtful.',
    builtIn: true
  },
  {
    id: 'supportive',
    label: 'Supportive',
    description: 'Kind and steady',
    instruction: 'Make it supportive, calm, and encouraging without becoming overly sentimental.',
    builtIn: true
  },
  {
    id: 'confident',
    label: 'Confident',
    description: 'Clear and assured',
    instruction: 'Make it confident, decisive, and clear without sounding arrogant.',
    builtIn: true
  },
  {
    id: 'translate-english',
    label: 'Translate to English',
    description: 'Natural English',
    instruction: 'Translate into natural English and preserve line breaks where possible.',
    action: 'translate',
    builtIn: true
  },
  {
    id: 'my-style',
    label: 'My style',
    description: 'Uses your style note',
    instruction: 'Match the user personal writing style as closely as possible while preserving meaning.',
    builtIn: true
  }
];

export const defaultSettings: LiSettings = {
  provider: 'openai',
  openaiApiKey: '',
  openaiModel: 'gpt-5.4-mini',
  anthropicApiKey: '',
  anthropicModel: 'claude-sonnet-4-6',
  groqApiKey: '',
  groqModel: 'llama-3.3-70b-versatile',
  openrouterApiKey: '',
  openrouterModel: 'anthropic/claude-3.5-sonnet',
  geminiApiKey: '',
  geminiModel: 'gemini-3.1-flash-lite',
  ollamaUrl: 'http://127.0.0.1:11434',
  ollamaModel: 'llama3.1',
  selectedStyleId: 'friendly',
  emojiEnabled: false,
  personalWritingStyle: '',
  devLogging: false,
  theme: 'auto',
  hotkeys: defaultHotkeys,
  stylePresets: defaultStylePresets,
  usageStats: defaultUsageStats
};

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

function encryptKey(value: string): { plain: string; encrypted: string } {
  if (!value) return { plain: '', encrypted: '' };
  if (safeStorage.isEncryptionAvailable()) {
    return { plain: '', encrypted: safeStorage.encryptString(value).toString('base64') };
  }
  return { plain: value, encrypted: '' };
}

function decryptKey(plain: string | undefined, encrypted: string | undefined): string {
  if (encrypted && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
    } catch {
      return '';
    }
  }
  return plain || '';
}

function normalizeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function mergeUsageStats(stored?: Partial<UsageStats>): UsageStats {
  return {
    rewriteCount: normalizeCount(stored?.rewriteCount),
    symbolCount: normalizeCount(stored?.symbolCount)
  };
}

function mergeSettings(stored?: Partial<StoredSettings>): LiSettings {
  if (!stored) return defaultSettings;

  const base: LiSettings = {
    ...defaultSettings,
    ...(stored as Partial<LiSettings>)
  };

  // Decrypt all API keys (falls back to plaintext for unencrypted or missing values)
  for (const field of API_KEY_FIELDS) {
    base[field] = decryptKey(stored[field], stored[`${field}Encrypted`]);
  }

  return {
    ...base,
    hotkeys: { ...defaultSettings.hotkeys, ...(stored.hotkeys || {}) },
    stylePresets: stored.stylePresets?.length ? stored.stylePresets : defaultStylePresets,
    usageStats: mergeUsageStats(stored.usageStats)
  };
}

function readStoredSettings(): Partial<StoredSettings> | undefined {
  const settingsPath = getSettingsPath();
  if (!existsSync(settingsPath)) return undefined;
  try {
    return JSON.parse(readFileSync(settingsPath, 'utf8')) as Partial<StoredSettings>;
  } catch {
    return undefined;
  }
}

function writeStoredSettings(settings: StoredSettings): void {
  const settingsPath = getSettingsPath();
  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

function buildStoredSettings(settings: LiSettings, currentStats: UsageStats): StoredSettings {
  const stored = { ...settings } as unknown as StoredSettings;

  for (const field of API_KEY_FIELDS) {
    const { plain, encrypted } = encryptKey(settings[field]);
    stored[field] = plain;
    stored[`${field}Encrypted`] = encrypted;
  }

  stored.usageStats = {
    rewriteCount: Math.max(currentStats.rewriteCount, settings.usageStats.rewriteCount),
    symbolCount: Math.max(currentStats.symbolCount, settings.usageStats.symbolCount)
  };

  return stored;
}

export function getSettings(): LiSettings {
  return mergeSettings(readStoredSettings());
}

export function saveSettings(settings: LiSettings): LiSettings {
  writeStoredSettings(buildStoredSettings(settings, getSettings().usageStats));
  return getSettings();
}

export function recordRewriteUsage(symbolCount: number): LiSettings {
  const settings = getSettings();
  return saveSettings({
    ...settings,
    usageStats: {
      rewriteCount: settings.usageStats.rewriteCount + 1,
      symbolCount: settings.usageStats.symbolCount + Math.max(0, Math.trunc(symbolCount))
    }
  });
}

export function resetSettings(): LiSettings {
  const empty: LiSettings = { ...defaultSettings };
  const stored = buildStoredSettings(empty, defaultSettings.usageStats);
  writeStoredSettings(stored);
  return getSettings();
}
