export async function handleChat(req: Request, env?: Record<string, any>): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as { message?: string; history?: any[] };
    const { message, history } = body;

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Pesan tidak boleh kosong.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey =
      env?.GEMINI_API_KEY ||
      env?.VITE_GEMINI_API_KEY ||
      (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '');

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            'GEMINI_API_KEY belum dikonfigurasi. Silakan atur Environment Variable GEMINI_API_KEY pada dashboard Anda.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const systemInstruction = `Kamu adalah Noesis, sebuah personal AI assistant dan second brain yang cerdas, minimalis, dan sangat membantu. 
Tugasmu adalah memberikan jawaban yang ringkas, berwawasan, akurat, dan ramah dalam bahasa Indonesia (atau mengikuti bahasa pengguna jika mereka bertanya dalam bahasa lain).
Berikan jawaban dengan format Markdown yang rapi dan mudah dibaca di layar HP/mobile.`;

    let contents: any[] = [];
    if (Array.isArray(history) && history.length > 0) {
      contents = history.map((item) => ({
        role: item.role === 'user' ? 'user' : 'model',
        parts: [{ text: item.content || '' }],
      }));
    }

    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const geminiPayload = {
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: contents,
      generationConfig: {
        temperature: 0.7,
      },
    };

    const modelsToTry = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-lite'];
    let geminiRes: Response | null = null;
    let usedModel = modelsToTry[0];
    let lastErr = '';

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(geminiPayload),
        });

        if (res.ok && res.body) {
          geminiRes = res;
          usedModel = model;
          break;
        } else {
          const errText = await res.text();
          lastErr = `Model ${model} gagal (${res.status}): ${errText}`;
        }
      } catch (e: any) {
        lastErr = e?.message || String(e);
      }
    }

    if (!geminiRes || !geminiRes.body) {
      return new Response(
        JSON.stringify({
          error: lastErr || 'Gagal terhubung dengan layanan Gemini AI.',
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      const isFallback = usedModel !== modelsToTry[0];
      const metaChunk = `data: ${JSON.stringify({ modelMeta: { model: usedModel, isFallback, primaryModel: modelsToTry[0] } })}\n\n`;
      await writer.write(encoder.encode(metaChunk));

      const reader = geminiRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;

            const jsonStr = trimmed.substring(5).trim();
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const textChunk =
                parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (textChunk) {
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify({ text: textChunk })}\n\n`)
                );
              }
            } catch (e) {
              // Ignore parse chunk errors
            }
          }
        }
        await writer.write(encoder.encode('data: [DONE]\n\n'));
      } catch (err: any) {
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ error: err?.message || 'Stream error' })}\n\n`)
        );
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal Server Error pada Chat API' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
