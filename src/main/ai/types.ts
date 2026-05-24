import type { LiSettings, ProviderId, RewriteAction, StylePreset } from '../../shared/types';

export interface PromptBuildInput {
  action: RewriteAction;
  selectedText: string;
  style: StylePreset;
  emojiEnabled: boolean;
  personalWritingStyle: string;
}

export interface BuiltPrompt {
  system: string;
  user: string;
}

export interface RewriteProvider {
  id: ProviderId;
  rewrite(input: ProviderRewriteInput): Promise<string>;
}

export interface ProviderRewriteInput {
  prompt: BuiltPrompt;
  settings: LiSettings;
  signal?: AbortSignal;
}
