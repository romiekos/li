import type { ProviderRewriteInput, RewriteProvider } from '../types';
import { openAICompatibleRewrite } from './openai-compatible';

export class OpenRouterProvider implements RewriteProvider {
  id = 'openrouter' as const;

  rewrite({ prompt, settings, signal }: ProviderRewriteInput): Promise<string> {
    return openAICompatibleRewrite(
      'https://openrouter.ai/api/v1',
      settings.openrouterApiKey.trim(),
      settings.openrouterModel || 'anthropic/claude-sonnet-4-6',
      prompt,
      'OpenRouter',
      signal
    );
  }
}
