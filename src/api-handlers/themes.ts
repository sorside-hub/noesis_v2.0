export async function handleThemes(req: Request, env?: Record<string, any>): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const { clusters, notes } = body;

    const rawClusters = Array.isArray(clusters) ? clusters : [];
    const rawNotes = Array.isArray(notes) ? notes : [];

    if (rawClusters.length === 0 || rawNotes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Tidak ada cluster catatan yang disediakan untuk analisis tema.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const geminiApiKey =
      env?.GEMINI_API_KEY ||
      env?.VITE_GEMINI_API_KEY ||
      (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '');

    const groqApiKey =
      env?.GROQ_API_KEY ||
      env?.VITE_GROQ_API_KEY ||
      (typeof process !== 'undefined' ? process.env?.GROQ_API_KEY : '');

    if (!geminiApiKey && !groqApiKey) {
      return new Response(
        JSON.stringify({
          error: 'API Key (GEMINI_API_KEY atau GROQ_API_KEY) belum dikonfigurasi pada environment.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const notesMap = new Map<string, any>(rawNotes.map((n: any) => [n.id, n]));

    let userPrompt = `Berikut adalah data cluster semantik catatan dari Vault pengguna:\n\n`;

    rawClusters.forEach((c: any, idx: number) => {
      userPrompt += `[CLUSTER #${idx + 1}] (Cluster ID: ${c.clusterId}, Avg Similarity: ${c.avgSimilarity})\n`;
      const clusterNoteIds: string[] = c.noteIds || [];
      clusterNoteIds.forEach((nId) => {
        const note = notesMap.get(nId);
        if (note) {
          const contentSnippet = (note.content || '').slice(0, 300);
          userPrompt += `- Note ID: "${note.id}" | Title: "${note.title || 'Tanpa Judul'}" | Category: ${note.category || 'Umum'} | Tags: ${(note.tags || []).join(', ')}\n  Snippet: ${contentSnippet}\n`;
        }
      });
      userPrompt += `\n`;
    });

    const systemPrompt = `Kamu adalah Noesis Themes Engine.
Tugasmu adalah menganalisis kelompok/cluster catatan yang memiliki kemiripan topik semantik dan menyintesiskan Nama Tema (Title) dan Deskripsi Tema yang ringkas, presisi, dan substantif.

ATURAN STRICT THEMES ENGINE:
1. TOPIK SUBSTANTIF ORGANIK: Tema adalah topik besar yang sering muncul dan berkembang dari isi catatan pengguna (contoh: 'Arsitektur Sistem & Perangkat Lunak', 'Manajemen Keuangan & Anggaran', 'Filsafat Stoikisme', 'Strategi Pemasaran Produk').
2. DILARANG PERSONALITY ANALYSIS: DILARANG KERAS membuat analisis kepribadian, diagnosa psikologis, karakter pribadi, atau prediksi perilaku pengguna.
3. DILARANG PREDEFINED TOPIC: Temukan nama dan deskripsi tema murni dari keterkaitan alami isi catatan dalam cluster.
4. EVIDENSI KONKRET: Setiap tema HARUS memuat \`relatedNoteIds\` berupa array ID catatan asli dalam cluster tersebut.
5. STRENGTH SCORE: Berikan nilai \`strength\` angka desimal 0.0 sampai 1.0 berdasarkan tingkat kerapatan dan kohesi topik.
6. BAHASA INDONESIA: Gunakan bahasa Indonesia yang jelas, profesional, dan ringkas.

STRUKTUR JSON OUTPUT (WAJIB JSON VALID SAJA):
{
  "themes": [
    {
      "title": "Nama Topik Utama (3-6 kata)",
      "description": "Deskripsi singkat (1-2 kalimat) merangkum topik utama dari catatan dalam cluster ini.",
      "relatedNoteIds": ["id_note_1", "id_note_2"],
      "strength": 0.85
    }
  ]
}`;

    let rawJsonResponse = '';

    // Primary Attempt: Gemini API
    if (geminiApiKey) {
      const modelsToTry = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-lite'];
      for (const model of modelsToTry) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
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
              break;
            }
          }
        } catch (e) {
          console.warn(`[Themes AI] Gemini model ${model} failed, trying fallback:`, e);
        }
      }
    }

    // Fallback Attempt: Groq API
    if (!rawJsonResponse && groqApiKey) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqApiKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.2,
            response_format: { type: 'json_object' },
          }),
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          rawJsonResponse = groqData?.choices?.[0]?.message?.content || '';
        }
      } catch (e) {
        console.warn('[Themes AI] Groq fallback failed:', e);
      }
    }

    if (!rawJsonResponse) {
      return new Response(
        JSON.stringify({ error: 'Gagal mendapatkan respons AI untuk pembentukan Themes.' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Clean JSON formatting if necessary
    const cleanedText = rawJsonResponse
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleanedText);
    const themes = Array.isArray(parsed?.themes) ? parsed.themes : [];

    return new Response(JSON.stringify({ themes }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in handleThemes:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Terjadi kesalahan internal pada Themes Engine.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
