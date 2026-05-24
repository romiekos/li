import type { ProviderRewriteInput, RewriteProvider } from '../types';
import { openAICompatibleRewrite } from './openai-compatible';

export class GroqProvider implements RewriteProvider {
  id = 'groq' as const;

  rewrite({ prompt, settings, signal }: ProviderRewriteInput): Promise<string> {
    return openAICompatibleRewrite(
      'https://api.groq.com/openai/v1',
      settings.groqApiKey.trim(),
      settings.groqModel || 'llama-4-scout-17b-16e-instruct',
      prompt,
      'Groq',
      signal
    );
  }
}
