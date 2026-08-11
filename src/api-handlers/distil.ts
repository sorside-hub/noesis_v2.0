import { getGeminiApiKeys } from './geminiHelper';

export async function handleDistil(req: Request, env?: Record<string, any>): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      content?: string;
      customGroqApiKey?: string;
      customGeminiApiKey?: string;
      model?: string;
    };

    const { title, content, customGroqApiKey, customGeminiApiKey, model } = body;

    if (!content || typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'Isi catatan tidak boleh kosong untuk didistil.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const geminiApiKeys = getGeminiApiKeys(env);
    if (customGeminiApiKey && typeof customGeminiApiKey === 'string' && customGeminiApiKey.trim()) {
      geminiApiKeys.unshift(customGeminiApiKey.trim());
    }

    const groqApiKey =
      customGroqApiKey ||
      env?.GROQ_API_KEY ||
      env?.VITE_GROQ_API_KEY ||
      (typeof process !== 'undefined' ? process.env?.GROQ_API_KEY : '');

    if (geminiApiKeys.length === 0 && !groqApiKey) {
      return new Response(
        JSON.stringify({
          error:
            'API Key (GEMINI_API_KEY atau GROQ_API_KEY) belum dikonfigurasi.',
          needsApiKey: true,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const systemPrompt = `Kamu adalah Noesis Distiller, engine penyaring wawasan cerdas.
Tugasmu adalah mendistilasi (menyaring & mengekstrak) catatan berikut menjadi ringkasan yang bernilai tinggi.
Sajikan dalam format Markdown yang rapi dengan struktur berikut:

### 💡 Intisari Eksekutif
(1-2 kalimat ringkasan tingkat tinggi)

### 🔑 Poin-Poin Utama
- (Gagasan/fakta kunci 1)
- (Gagasan/fakta kunci 2)

### 🎯 Aksi & Tindak Lanjut
- [ ] (Aksi konkret atau langkah selanjutnya jika ada)

Gunakan Bahasa Indonesia yang tajam, elegan, dan langsung pada intinya.`;

    const userPrompt = `Judul Catatan: ${title || 'Tanpa Judul'}\n\nIsi Catatan:\n${content}`;

    let stream: ReadableStream | null = null;
    let fallbackToGroq = false;

    // Try Gemini
    const geminiModels = ['gemini-3.5-flash', 'gemini-3.5-flash-lite'];
    
    distilLoop: for (const modelName of geminiModels) {
      for (const geminiApiKey of geminiApiKeys) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${geminiApiKey}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
              generationConfig: { temperature: 0.5 },
            }),
          });

          if (res.ok && res.body) {
            // Need to transform Gemini stream to standard SSE format if needed,
            // or just bridge it directly if the client expects the same format.
            // Since this is complex, for now let's bridge the raw response body
            // This is a simplified proxy for Gemini stream
            stream = res.body;
            break distilLoop;
          }
        } catch (e) {
          console.warn(`[Distil AI] Gemini ${modelName} failed:`, e);
        }
      }
    }

    // Fallback to Groq
    if (!stream && groqApiKey) {
      fallbackToGroq = true;
      const groqModel = model || 'llama-3.3-70b-versatile';
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.5,
          stream: true,
        }),
      });

      if (groqResponse.ok && groqResponse.body) {
        stream = groqResponse.body;
      } else {
        return new Response(JSON.stringify({ error: 'Gagal memanggil API AI.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (!stream) {
        return new Response(JSON.stringify({ error: 'Gagal memproses distilasi dari semua AI.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
    }

    // Proxy the stream
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal Server Error pada Distil API' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
