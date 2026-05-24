import type { BuiltPrompt } from '../types';

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

function cleanOutput(value: string): string {
  return value
    .trim()
    .replace(/^```(?:text)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export async function openAICompatibleRewrite(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: BuiltPrompt,
  providerName: string,
  signal?: AbortSignal
): Promise<string> {
  if (!apiKey) {
    throw new Error(`Add your ${providerName} API key in Settings.`);
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ]
    })
  });

  const data = (await response.json().catch(() => ({}))) as ChatResponse;

  if (!response.ok) {
    throw new Error(data.error?.message || `${providerName} request failed (${response.status}).`);
  }

  const output = data.choices?.[0]?.message?.content;
  if (!output?.trim()) throw new Error(`${providerName} returned an empty rewrite.`);
  return cleanOutput(output);
}
