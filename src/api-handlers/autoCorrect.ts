export async function handleAutoCorrect(req: Request, env?: Record<string, any>): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      content?: string;
      customGroqApiKey?: string;
      model?: string;
    };

    const { content, customGroqApiKey, model } = body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return new Response(
        JSON.stringify({ error: 'Isi catatan tidak boleh kosong untuk Auto Correct.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const apiKey =
      customGroqApiKey ||
      env?.GROQ_API_KEY ||
      env?.VITE_GROQ_API_KEY ||
      (typeof process !== 'undefined' ? process.env?.GROQ_API_KEY : '');

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'GROQ_API_KEY belum dikonfigurasi. Silakan masukkan Groq API Key di pengaturan atau environment.',
          needsApiKey: true,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const groqModel = model || 'llama-3.3-70b-versatile';

    const systemPrompt = `Kamu adalah AI Auto Correct & Refiner tulisan untuk Noesis Vault yang ditenagai Groq AI.
Tugasmu adalah membenahi dan memperbaik tulisan catatan pengguna agar lebih rapi, tanpa menghilangkan gaya bahasa, nada bicara, emosi, dan karakter asli penulis.

PETUNJUK PERBAIKAN:
1. YANG WAJIB DIPERBAIKI:
   - Typo / kesalahan ketik kata
   - Ejaan kata (sesuai ejaan baku Indonesia / KBBI jika perlu, namun tetap pertahankan bentuk santai bila tulisan asli bergaya santai)
   - Tata bahasa (grammar) dan kapitalisasi awal kalimat
   - Tanda baca (titik, koma, dsb.)
   - Struktur kalimat yang membingungkan atau terputus-putus tanpa mengubah maksudnya

2. YANG DILARANG KERAS:
   - Dilarang mengubah makna asli, pesan utama, atau maksud tulisan.
   - Dilarang mengubah emosi dan nuansa tulisan (misal: sedih, reflektif, marah, gembira, santai).
   - Dilarang membuat tulisan menjadi sangat kaku / terlalu formal jika aslinya bergaya santai atau bahasa gaul / populer.
   - Dilarang menghilangkan kata-kata khas atau gaya bahasa pribadi penulis.
   - Dilarang merusak atau mengubah struktur karya kreatif seperti ide lirik lagu, puisi, sajak, atau draft cerita.

FORMAT OUTPUT:
Kamu HARUS mengembalikan JSON valid tanpa teks markdown atau penjelasan tambahan dengan format:
{
  "correctedText": "isi catatan yang sudah diperbaiki"
}`;

    const userPrompt = `Isi Catatan Asli:\n${content}`;

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
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      let parsedErr = 'Gagal memanggil API Groq untuk Auto Correct.';
      try {
        const errObj = JSON.parse(errorText);
        parsedErr = errObj?.error?.message || parsedErr;
      } catch {}
      return new Response(JSON.stringify({ error: parsedErr }), {
        status: groqResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const responseData = (await groqResponse.json()) as any;
    const rawText = responseData.choices?.[0]?.message?.content || '';

    let jsonResult: any = {};
    try {
      jsonResult = JSON.parse(rawText);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Gagal memproses format JSON dari Groq AI.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const correctedText =
      typeof jsonResult.correctedText === 'string' ? jsonResult.correctedText : content;

    return new Response(JSON.stringify({ correctedText }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Server error pada Auto Correct' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
