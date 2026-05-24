import type { ProviderRewriteInput, RewriteProvider } from '../types';

interface OllamaGenerateResponse {
  response?: string;
  error?: string;
}

export class OllamaProvider implements RewriteProvider {
  id = 'ollama' as const;

  async rewrite({ prompt, settings, signal }: ProviderRewriteInput): Promise<string> {
    const endpoint = new URL('/api/generate', settings.ollamaUrl || 'http://127.0.0.1:11434');

    const response = await fetch(endpoint, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: settings.ollamaModel || 'llama3.1',
        stream: false,
        prompt: `${prompt.system}\n\n${prompt.user}`
      })
    });

    const data = (await response.json().catch(() => ({}))) as OllamaGenerateResponse;

    if (!response.ok) {
      throw new Error(data.error || `Ollama request failed (${response.status}).`);
    }

    if (!data.response?.trim()) {
      throw new Error('Ollama returned an empty rewrite.');
    }

    return data.response.trim();
  }
}
