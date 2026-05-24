import type { ProviderRewriteInput, RewriteProvider } from '../types';

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  error?: { message?: string };
}

function cleanOutput(value: string): string {
  return value
    .trim()
    .replace(/^```(?:text)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export class AnthropicProvider implements RewriteProvider {
  id = 'anthropic' as const;

  async rewrite({ prompt, settings, signal }: ProviderRewriteInput): Promise<string> {
    const apiKey = settings.anthropicApiKey.trim();
    if (!apiKey) throw new Error('Add your Anthropic API key in Settings.');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: settings.anthropicModel || 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }]
      })
    });

    const data = (await response.json().catch(() => ({}))) as AnthropicResponse;

    if (!response.ok) {
      throw new Error(data.error?.message || `Anthropic request failed (${response.status}).`);
    }

    const output = data.content?.find((b) => b.type === 'text')?.text;
    if (!output?.trim()) throw new Error('Anthropic returned an empty rewrite.');
    return cleanOutput(output);
  }
}
