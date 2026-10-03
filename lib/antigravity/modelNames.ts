// Clean human-friendly display names for Antigravity models
export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'gemini-pro-agent': 'Gemini 3.1 Pro (High)',
  'gemini-3.1-pro-high': 'Gemini 3.1 Pro (High)',
  'gemini-3.1-pro-low': 'Gemini 3.1 Pro (Low)',
  'gemini-3-flash-agent': 'Gemini 3.5 Flash (High)',
  'gemini-3.5-flash-low': 'Gemini 3.5 Flash (Medium)',
  'gemini-3.5-flash-extra-low': 'Gemini 3.5 Flash (Low)',
  'gemini-3.6-flash-high': 'Gemini 3.6 Flash (High)',
  'gemini-3.6-flash-medium': 'Gemini 3.6 Flash (Medium)',
  'gemini-3.6-flash-low': 'Gemini 3.6 Flash (Low)',
  'gemini-3.6-flash-tiered': 'Gemini 3.6 Flash (Tiered)',
  'gemini-3.7-flash-high': 'Gemini 3.7 Flash (High)',
  'gemini-3.7-flash-medium': 'Gemini 3.7 Flash (Medium)',
  'gemini-3.7-flash-low': 'Gemini 3.7 Flash (Low)',
  'gemini-3.7-flash-tiered': 'Gemini 3.7 Flash (Tiered)',
  'claude-sonnet-4-6': 'Claude Sonnet 4.6 (Thinking)',
  'claude-opus-4-6-thinking': 'Claude Opus 4.6 (Thinking)',
  'gpt-oss-120b-medium': 'GPT-OSS 120B (Medium)',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
  'gemini-2.5-flash-thinking': 'Gemini 2.5 Flash Thinking',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-3-flash': 'Gemini 3 Flash',
  'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
  'gemini-3.1-flash-image': 'Gemini 3.1 Flash Image',
  'chat_20706': 'Tab Autocomplete (Fast)',
  'chat_23310': 'Tab Autocomplete (Standard)',
};

export function formatModelDisplayName(id: string, originalName?: string): string {
  if (MODEL_DISPLAY_NAMES[id]) return MODEL_DISPLAY_NAMES[id];
  if (originalName && originalName !== id) return originalName;
  return id
    .replace(/^models\//, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
