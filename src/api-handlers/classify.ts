export async function handleClassify(req: Request, env?: Record<string, any>): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      message?: string;
      customGroqApiKey?: string;
      model?: string;
    };

    const { message, customGroqApiKey, model } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return new Response(JSON.stringify({ error: 'Pesan tidak boleh kosong.' }), {
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
        JSON.stringify({ error: 'GROQ_API_KEY belum dikonfigurasi.', needsApiKey: true }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const groqModel = model || 'llama-3.3-70b-versatile';

    const systemPrompt = `Kamu adalah AI Classifier untuk Noesis Second Brain dalam "Smart Mode" (Thinking with Vault).

Filosofi Smart Mode:
Smart Mode bukan sekadar pelacak pencarian, melainkan mode "Thinking with Vault". Vault digunakan sebagai basis konteks utama untuk berpikir, menganalisis, mengritik, merangkum, dan berkreasi.

Tugas kamu:
Menganalisis pesan pengguna dan mengklasifikasikan intent, reasoningStyle, memoryDepth, serta kategori Vault yang paling relevan.

1. Kategori Intent:
- memory_recall: Pengguna ingin mengingat atau mencari informasi dari catatan Vault.
- reflection: Pengguna membahas pengalaman, pemikiran, jurnal, atau evaluasi pribadi.
- analysis_critique: Pengguna meminta analisis, kritik, perbandingan, evaluasi, atau pengembangan ide/konsep.
- creation: Pengguna ingin membuat karya, ide, atau rencana proyek baru.
- topic_query: Pertanyaan umum atau topik sains/teknologi yang perlu diperiksa apakah pengguna memiliki catatan relevan di Vault.
- smalltalk: Basa-basi/sapaan singkat (contoh: "halo", "apa kabar", "terima kasih", "siapa kamu").

2. Reasoning Style:
- "Recall": Mengingat/mengekstrak fakta atau informasi spesifik dari Vault.
- "Explain": Menjelaskan konsep dan memperkayanya dengan pengetahuan umum.
- "Analyze": Menganalisis korelasi, hubungan logis, dan makna antar catatan.
- "Critique": Mengevaluasi ide, mencari risiko/kelemahan, dan memberikan saran konkret.
- "Compare": Membandingkan dua atau lebih catatan, konsep, atau evolusi pemikiran.
- "Synthesize": Merangkum dan menyintesis pola baru dari beberapa catatan.
- "Brainstorm": Mengembangkan ide baru menggunakan Vault sebagai inspirasi.

3. Memory Depth:
- "shallow": Pencarian terfokus ringan (topK 3). Cocok untuk Recall.
- "normal": Pencarian standar (topK 5). Cocok untuk Explain.
- "deep": Pencarian mendalam (topK 8). Cocok untuk Analyze, Critique, Compare.
- "very_deep": Pencarian sangat mendalam (topK 10, multi-kategori). Cocok untuk Synthesize.
- "broad": Pencarian eksploratif luas (topK 8, ambang batas rendah). Cocok untuk Brainstorm.

4. Aturan needRAG:
- Set needRAG = false HANYA jika intent adalah "smalltalk" (sapaan/basa-basi murni).
- Set needRAG = true untuk SEMUA intent lain.

5. Kategori Vault:
- "world": informasi eksternal, pengetahuan umum, sains, buku.
- "self": jurnal pribadi, refleksi, evaluasi emosi.
- "ideas": gagasan, konsep proyek, ide pengembangan.
- null jika relevan untuk semua/multi-kategori.

Output WAJIB berupa JSON valid saja tanpa teks tambahan:
{
  "needRAG": boolean,
  "intent": "memory_recall" | "reflection" | "analysis_critique" | "creation" | "topic_query" | "smalltalk",
  "reasoningStyle": "Recall" | "Explain" | "Analyze" | "Critique" | "Compare" | "Synthesize" | "Brainstorm",
  "memoryDepth": "shallow" | "normal" | "deep" | "very_deep" | "broad",
  "category": "world" | "self" | "ideas" | null,
  "confidence": number (0-1),
  "reason": "Penjelasan singkat alasan klasifikasi"
}`;

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
          { role: 'user', content: message },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });

    if (!groqResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Gagal memanggil API Groq Classifier.' }),
        { status: groqResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
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

    let category = jsonResult.category || null;
    if (typeof category === 'string') {
      category = category.trim().toLowerCase();
      if (['', 'null', 'all', 'none'].includes(category)) {
        category = null;
      }
    } else {
      category = null;
    }

    return new Response(
      JSON.stringify({
        needRAG: Boolean(jsonResult.needRAG),
        intent: jsonResult.intent || 'general',
        reasoningStyle: jsonResult.reasoningStyle || undefined,
        memoryDepth: jsonResult.memoryDepth || undefined,
        category,
        confidence: typeof jsonResult.confidence === 'number' ? jsonResult.confidence : 0.8,
        reason: jsonResult.reason || '',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Server error pada Classify' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
