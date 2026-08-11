/**
 * Helper to retrieve all available Gemini API Keys in priority order:
 * 1. Primary key: GEMINI_API_KEY / VITE_GEMINI_API_KEY
 * 2. Secondary key: GEMINI_API_KEY_SECONDARY / GEMINI_API_KEY_BACKUP / VITE_GEMINI_API_KEY_SECONDARY / VITE_GEMINI_API_KEY_BACKUP
 */
export function getGeminiApiKeys(env?: Record<string, any>): string[] {
  const keys: string[] = [];

  const key1 =
    env?.GEMINI_API_KEY ||
    env?.VITE_GEMINI_API_KEY ||
    (typeof process !== 'undefined'
      ? process.env?.GEMINI_API_KEY || process.env?.VITE_GEMINI_API_KEY
      : '');

  if (key1 && typeof key1 === 'string' && key1.trim()) {
    keys.push(key1.trim());
  }

  const key2 =
    env?.GEMINI_API_KEY_SECONDARY ||
    env?.GEMINI_API_KEY_BACKUP ||
    env?.VITE_GEMINI_API_KEY_SECONDARY ||
    env?.VITE_GEMINI_API_KEY_BACKUP ||
    (typeof process !== 'undefined'
      ? process.env?.GEMINI_API_KEY_SECONDARY ||
        process.env?.GEMINI_API_KEY_BACKUP ||
        process.env?.VITE_GEMINI_API_KEY_SECONDARY ||
        process.env?.VITE_GEMINI_API_KEY_BACKUP
      : '');

  if (key2 && typeof key2 === 'string' && key2.trim() && !keys.includes(key2.trim())) {
    keys.push(key2.trim());
  }

  return keys;
}
