import type { BuiltPrompt, PromptBuildInput } from './types';

const actionRules = {
  grammar:
    'Mode: grammar only. Fix grammar, punctuation, spelling, awkward phrasing, and clarity. Keep the original tone and do not rewrite more than needed.',
  rephrase:
    'Mode: rephrase. Rewrite using the selected style while preserving meaning, intent, formatting, and the original language.',
  translate:
    'Mode: translate to English. Translate the text into natural English while preserving meaning, formatting, and line breaks.'
} as const;

export function buildPrompt(input: PromptBuildInput): BuiltPrompt {
  const personalStyle = input.personalWritingStyle.trim();

  const system = [
    'You are Li, a fast desktop text rewriting layer.',
    'Return only the final rewritten text.',
    'Do not include explanations, labels, markdown fences, alternatives, or commentary.',
    'Preserve meaning.',
    'Do not add facts.',
    'Do not over-polish unless the requested style requires it.',
    'Preserve line breaks where possible.',
    'Preserve the source language unless translating.',
    input.emojiEnabled
      ? 'Emoji preference: emoji are allowed only when natural and sparse.'
      : 'Emoji preference: do not add emoji.',
    actionRules[input.action],
    `Selected style: ${input.style.label}. ${input.style.instruction}`,
    personalStyle ? `User writing style to respect when appropriate: ${personalStyle}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  const user = [
    'Rewrite this text according to the rules.',
    'Return only the rewritten text.',
    '<text>',
    input.selectedText,
    '</text>'
  ].join('\n');

  return { system, user };
}
