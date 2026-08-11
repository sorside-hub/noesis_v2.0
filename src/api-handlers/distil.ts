export async function handleDistil(req: Request, env?: Record<string, any>): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      content?: string;
      customGroqApiKey?: string;
      model?: string;
    };

    const { title, content, customGroqApiKey, model } = body;

    if (!content || typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'Isi catatan tidak boleh kosong untuk didistil.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey =
      customGroqApiKey ||
      env?.GROQ_API_KEY ||
      env?.VITE_GROQ_API_KEY ||
      (typeof process !== 'undefined' ? process.env?.GROQ_API_KEY : '');

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            'GROQ_API_KEY belum dikonfigurasi. Silakan atur Environment Variable GROQ_API_KEY atau masukkan API Key di modal.',
          needsApiKey: true,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const groqModel = model || 'llama-3.3-70b-versatile';

    const systemPrompt = `Kamu adalah Noesis Distiller, engine penyaring wawasan cerdas yang ditenagai oleh Groq AI (Model: ${groqModel}).
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

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
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

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      let parsedErr = 'Gagal memanggil API Groq.';
      try {
        const errObj = JSON.parse(errorText);
        parsedErr = errObj?.error?.message || parsedErr;
      } catch {}
      return new Response(JSON.stringify({ error: parsedErr }), {
        status: groqResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      const reader = groqResponse.body!.getReader();
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
            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.slice(6);
              if (dataStr === '[DONE]') {
                await writer.write(encoder.encode('data: [DONE]\n\n'));
              } else {
                try {
                  const json = JSON.parse(dataStr);
                  const chunkText = json.choices?.[0]?.delta?.content || '';
                  if (chunkText) {
                    await writer.write(
                      encoder.encode(`data: ${JSON.stringify({ text: chunkText })}\n\n`)
                    );
                  }
                } catch {}
              }
            }
          }
        }
        await writer.write(encoder.encode('data: [DONE]\n\n'));
      } catch (err: any) {
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ error: err?.message || 'Streaming error' })}\n\n`)
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
      JSON.stringify({ error: err?.message || 'Internal Server Error pada Distil API' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
