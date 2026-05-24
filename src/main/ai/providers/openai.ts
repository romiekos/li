import type { ProviderRewriteInput, RewriteProvider } from '../types';
import { openAICompatibleRewrite } from './openai-compatible';

export class OpenAIProvider implements RewriteProvider {
  id = 'openai' as const;

  rewrite({ prompt, settings, signal }: ProviderRewriteInput): Promise<string> {
    return openAICompatibleRewrite(
      'https://api.openai.com/v1',
      settings.openaiApiKey.trim(),
      settings.openaiModel || 'gpt-5.4-mini',
      prompt,
      'OpenAI',
      signal
    );
  }
}
