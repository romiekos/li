export type RewriteAction = 'grammar' | 'rephrase' | 'translate';

export type ProviderId = 'openai' | 'anthropic' | 'groq' | 'openrouter' | 'gemini' | 'ollama';

export type RewriteStatus = 'idle' | 'capturing' | 'thinking' | 'replacing' | 'success' | 'error';

export interface StylePreset {
  id: string;
  label: string;
  description: string;
  instruction: string;
  action?: RewriteAction;
  builtIn?: boolean;
}

export interface HotkeySettings {
  grammar: string;
  rephrase: string;
  translate: string;
  popup: string;
}

export interface UsageStats {
  rewriteCount: number;
  symbolCount: number;
}

export type AppTheme = 'dark' | 'light' | 'auto';

export interface LiSettings {
  provider: ProviderId;
  // OpenAI
  openaiApiKey: string;
  openaiModel: string;
  // Anthropic
  anthropicApiKey: string;
  anthropicModel: string;
  // Groq
  groqApiKey: string;
  groqModel: string;
  // OpenRouter
  openrouterApiKey: string;
  openrouterModel: string;
  // Gemini
  geminiApiKey: string;
  geminiModel: string;
  // Ollama
  ollamaUrl: string;
  ollamaModel: string;
  selectedStyleId: string;
  emojiEnabled: boolean;
  personalWritingStyle: string;
  devLogging: boolean;
  theme: AppTheme;
  hotkeys: HotkeySettings;
  stylePresets: StylePreset[];
  usageStats: UsageStats;
}

export interface RewriteRequest {
  action: RewriteAction;
  styleId?: string;
}

export interface PopupState {
  visible: boolean;
  mode: 'palette' | 'progress';
  status: RewriteStatus;
  message: string;
  action?: RewriteAction;
  styleId?: string;
  error?: string;
}

export type UpdaterPhase = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'ready' | 'error';

export interface UpdaterState {
  phase: UpdaterPhase;
  version?: string;
  progress?: number;
  error?: string;
}

export interface LiBridge {
  getSettings: () => Promise<LiSettings>;
  saveSettings: (settings: LiSettings) => Promise<LiSettings>;
  resetSettings: () => Promise<LiSettings>;
  getPopupState: () => Promise<PopupState>;
  closePopup: () => Promise<void>;
  openSettings: () => Promise<void>;
  onPopupState: (callback: (state: PopupState) => void) => () => void;
  onSettingsUpdated: (callback: (settings: LiSettings) => void) => () => void;
  pauseShortcuts: () => Promise<void>;
  resumeShortcuts: () => Promise<void>;
  getAppVersion: () => Promise<string>;
  getUpdaterState: () => Promise<UpdaterState>;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
  onUpdaterState: (callback: (state: UpdaterState) => void) => () => void;
}
