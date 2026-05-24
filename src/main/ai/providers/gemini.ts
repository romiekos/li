import type { ProviderRewriteInput, RewriteProvider } from '../types';

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string };
}

function cleanOutput(value: string): string {
  return value
    .trim()
    .replace(/^```(?:text)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export class GeminiProvider implements RewriteProvider {
  id = 'gemini' as const;

  async rewrite({ prompt, settings, signal }: ProviderRewriteInput): Promise<string> {
    const apiKey = settings.geminiApiKey.trim();
    if (!apiKey) throw new Error('Add your Gemini API key in Settings.');

    const model = settings.geminiModel || 'gemini-3.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: prompt.system }] },
        contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
        generationConfig: { temperature: 0.2 }
      })
    });

    const data = (await response.json().catch(() => ({}))) as GeminiResponse;

    if (!response.ok) {
      throw new Error(data.error?.message || `Gemini request failed (${response.status}).`);
    }

    const output = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!output?.trim()) throw new Error('Gemini returned an empty rewrite.');
    return cleanOutput(output);
  }
}
