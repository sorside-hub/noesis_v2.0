async function getSingleEmbedding(apiKey: string | undefined, text: string): Promise<number[]> {
  if (!text || !text.trim()) return [];

  if (apiKey) {
    const modelsToTry = ['text-embedding-004', 'embedding-001'];

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: `models/${model}`,
            content: { parts: [{ text }] },
          }),
        });

        if (resp.ok) {
          const data = (await resp.json()) as any;
          const values = data.embedding?.values;
          if (values && Array.isArray(values) && values.length > 0) {
            return values;
          }
        }
      } catch {
        // try next
      }
    }
  }

  // Deterministic fallback feature vector if GenAI embedding is unavailable
  const dim = 128;
  const vec = new Array(dim).fill(0);
  const words = text.toLowerCase().match(/\w+/g) || [];
  for (const word of words) {
    for (let i = 0; i < word.length; i++) {
      const charCode = word.charCodeAt(i);
      const idx = (charCode * (i + 1) * 31) % dim;
      vec[idx] += 1;
    }
  }
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  return norm > 0 ? vec.map((v) => v / norm) : vec;
}

export async function handleEmbed(req: Request, env?: Record<string, any>): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      text?: string;
      texts?: string[];
    };

    const { text, texts } = body;

    const apiKey =
      env?.GEMINI_API_KEY ||
      env?.VITE_GEMINI_API_KEY ||
      (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '');

    if (Array.isArray(texts)) {
      const embeddings = await Promise.all(
        texts.map(async (t) => {
          if (!t || typeof t !== 'string') return [];
          return getSingleEmbedding(apiKey, t);
        })
      );
      return new Response(JSON.stringify({ embeddings }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else if (typeof text === 'string') {
      const emb = await getSingleEmbedding(apiKey, text);
      return new Response(JSON.stringify({ embedding: emb }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(
        JSON.stringify({ error: "Parameter 'text' atau 'texts' wajib disertakan." }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ embedding: [], embeddings: [], error: err?.message }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
