import { getGeminiApiKeys } from './geminiHelper';

export async function handleAiStatus(req: Request, env?: Record<string, any>): Promise<Response> {
  const geminiKeys = getGeminiApiKeys(env);

  const groqKey =
    env?.GROQ_API_KEY ||
    env?.VITE_GROQ_API_KEY ||
    (typeof process !== 'undefined' ? process.env?.GROQ_API_KEY || process.env?.VITE_GROQ_API_KEY : '');

  return new Response(
    JSON.stringify({
      gemini: {
        connected: geminiKeys.length > 0,
        keysConfigured: geminiKeys.length,
        hasBackupKey: geminiKeys.length > 1,
        model: 'gemini-3.6-flash',
      },
      groq: {
        connected: Boolean(groqKey && groqKey.trim().length > 0),
        model: 'llama-3.3-70b-versatile',
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}

