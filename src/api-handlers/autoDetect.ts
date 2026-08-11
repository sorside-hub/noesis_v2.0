import { getGeminiApiKeys } from './geminiHelper';

export async function handleAutoDetect(req: Request, env?: Record<string, any>): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      content?: string;
      title?: string;
      customGeminiApiKey?: string;
      model?: string;
    };

    const { content, title, customGeminiApiKey, model } = body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return new Response(
        JSON.stringify({ error: 'Isi catatan tidak boleh kosong untuk Auto-Detect.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const geminiApiKeys = getGeminiApiKeys(env);
    if (customGeminiApiKey && typeof customGeminiApiKey === 'string' && customGeminiApiKey.trim()) {
      geminiApiKeys.unshift(customGeminiApiKey.trim());
    }

    if (geminiApiKeys.length === 0) {
      const firstLine = content.trim().split('\n')[0].replace(/^[#*-\s]+/, '').trim();
      const fallbackTitle = firstLine ? firstLine.split(/\s+/).slice(0, 7).join(' ') : 'Catatan Baru';
      return new Response(
        JSON.stringify({
          title: fallbackTitle,
          category: 'self',
          tags: [],
          summary: '',
          confidence: 0,
          needsApiKey: true,
          error: 'GEMINI_API_KEY belum dikonfigurasi.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `Kamu adalah AI Auto-Detect Metadata & Pustakawan Digital Tingkat Lanjut untuk Noesis Vault.
Tugas utama kamu adalah membaca KESELURUHAN isi catatan pengguna dan memahami maksud, bentuk, serta konteksnya secara mendalam untuk merumuskan metadata yang presisi.

PEMAHAMAN METADATA NOESIS VAULT:

1. TITLE (Judul Catatan):
   - Buat judul yang sangat spesifik, ringkas, dan menggambarkan inti pesan utama catatan.
   - Maksimal 7 kata.
   - Mudah dicari kembali di masa depan.
   - DILARANG menggunakan kata generik seperti "Catatan Baru", "Catatan", "Pemikiran", "Ide", "Random", "Tulisan".
   - Jika pengguna sudah menyertakan Draf Judul, gunakan itu sebagai konteks utama, namun boleh dipoles agar lebih rapi dan presisi.

2. CATEGORY (Sumber / Asal Informasi):
   Pilih SATU dari 3 kategori berikut secara SANGAT KETAT berdasarkan SUMBER/ASAL informasi:
   - "world" : Informasi/pengetahuan dari LUAR pengguna. (Contoh: ringkasan buku, artikel, sains, teknologi, tutorial, sejarah, dokumentasi API, analisis data).
   - "self"  : Pengalaman, perenungan, emosi, atau evaluasi dari DALAM diri pengguna. (Contoh: jurnal harian, curhat pribadi, refleksi kegagalan/keberhasilan, kenangan pribadi, evaluasi emosi).
   - "ideas" : Gagasan atau rancangan yang INGIN DIWUJUDKAN di masa depan. (Contoh: konsep aplikasi, rencana bisnis, draf karya kreatif, strategi proyek, solusi masalah).

3. TYPE (Bentuk & Format Informasi):
   Menjelaskan BENTUK, FORMAT, atau MAKSUD catatan dalam 1 kata/istilah huruf kecil (snake_case jika >1 kata):
   - "journal", "reflection", "idea", "plan", "concept", "book_note", "research", "experience", "quote", "draft", "guide", "meeting_notes", "recipe", "list".

4. TAGS (Topik Utama):
   - Hasilkan 3 hingga 7 tag spesifik dalam array string (huruf kecil, tanpa '#', pisahkan dengan '-').

5. SUMMARY (Ringkasan Singkat):
   - Buat ringkasan 1 kalimat padat yang menjelaskan isi utama catatan.

6. CONFIDENCE (Tingkat Keyakinan):
   - Angka desimal antara 0.0 hingga 1.0.

FORMAT OUTPUT HARUS JSON VALID SAJA:
{
  "title": "...",
  "category": "world" | "self" | "ideas",
  "type": "...",
  "tags": ["...", "..."],
  "summary": "...",
  "confidence": 0.95
}`;

    const userPrompt = `Draf Judul (jika ada): ${title && title.trim() ? title.trim() : 'Tanpa Judul'}\n\nIsi Catatan Lengkap:\n${content}`;

    const modelsToTry = model ? [model, 'gemini-3.6-flash', 'gemini-3.5-flash'] : ['gemini-3.6-flash', 'gemini-3.5-flash'];
    // Deduplicate models
    const uniqueModels = Array.from(new Set(modelsToTry));

    let rawJsonResponse = '';
    detectLoop: for (const m of uniqueModels) {
      for (const apiKey of geminiApiKeys) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
                },
              ],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: 'application/json',
              },
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const textCandidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textCandidate) {
              rawJsonResponse = textCandidate;
              break detectLoop;
            }
          }
        } catch (e) {
          console.warn(`[AutoDetect AI] Model ${m} failed:`, e);
        }
      }
    }

    if (!rawJsonResponse) {
      const firstLine = content.trim().split('\n')[0].replace(/^[#*-\s]+/, '').trim();
      const fallbackTitle = firstLine ? firstLine.split(/\s+/).slice(0, 7).join(' ') : 'Catatan Baru';
      return new Response(
        JSON.stringify({
          title: fallbackTitle,
          category: 'self',
          type: 'unknown',
          tags: [],
          summary: '',
          confidence: 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let jsonResult: any = {};
    try {
      jsonResult = JSON.parse(rawJsonResponse);
    } catch {
      const firstLine = content.trim().split('\n')[0].replace(/^[#*-\s]+/, '').trim();
      const fallbackTitle = firstLine ? firstLine.split(/\s+/).slice(0, 7).join(' ') : 'Catatan Baru';
      return new Response(
        JSON.stringify({
          title: fallbackTitle,
          category: 'self',
          type: 'unknown',
          tags: [],
          summary: '',
          confidence: 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let detectedCategory = String(jsonResult.category || '').toLowerCase().trim();
    if (detectedCategory === 'learn') detectedCategory = 'world';
    else if (detectedCategory === 'reflect') detectedCategory = 'self';
    else if (detectedCategory === 'create') detectedCategory = 'ideas';

    if (!['world', 'self', 'ideas'].includes(detectedCategory)) {
      detectedCategory = 'self';
    }

    let detectedType = typeof jsonResult.type === 'string' && jsonResult.type.trim()
      ? jsonResult.type.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')
      : 'unknown';

    let detectedTitle = typeof jsonResult.title === 'string' ? jsonResult.title.trim() : '';
    if (detectedTitle) {
      const words = detectedTitle.split(/\s+/);
      if (words.length > 7) {
        detectedTitle = words.slice(0, 7).join(' ');
      }
    } else {
      const firstLine = content.trim().split('\n')[0].replace(/^[#*-\s]+/, '').trim();
      detectedTitle = firstLine ? firstLine.split(/\s+/).slice(0, 7).join(' ') : 'Catatan Baru';
    }

    let detectedTags: string[] = Array.isArray(jsonResult.tags) ? jsonResult.tags : [];
    const forbiddenTags = new Set([
      'catatan', 'note', 'random', 'belajar', 'tulisan', 'info', 'pemikiran', 'ide baru',
    ]);
    detectedTags = detectedTags
      .map((t) => String(t).toLowerCase().replace(/^#/, '').trim())
      .filter((t) => t.length > 0 && !forbiddenTags.has(t));

    if (detectedTags.length > 7) {
      detectedTags = detectedTags.slice(0, 7);
    }

    const summary = typeof jsonResult.summary === 'string' ? jsonResult.summary.trim() : '';
    let confidence = typeof jsonResult.confidence === 'number' ? jsonResult.confidence : 0.8;
    if (confidence < 0) confidence = 0;
    if (confidence > 1) confidence = 1;

    return new Response(
      JSON.stringify({
        title: detectedTitle,
        category: detectedCategory,
        type: detectedType,
        tags: detectedTags,
        summary,
        confidence,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Error pada auto-detect' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
