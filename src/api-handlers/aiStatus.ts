export async function handleAiStatus(req: Request, env?: Record<string, any>): Promise<Response> {
  const geminiKey =
    env?.GEMINI_API_KEY ||
    env?.VITE_GEMINI_API_KEY ||
    (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY || process.env?.VITE_GEMINI_API_KEY : '');

  const groqKey =
    env?.GROQ_API_KEY ||
    env?.VITE_GROQ_API_KEY ||
    (typeof process !== 'undefined' ? process.env?.GROQ_API_KEY || process.env?.VITE_GROQ_API_KEY : '');

  return new Response(
    JSON.stringify({
      gemini: {
        connected: Boolean(geminiKey && geminiKey.trim().length > 0),
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
