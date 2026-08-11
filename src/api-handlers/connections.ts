export async function handleConnections(req: Request, env?: Record<string, any>): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const { candidates } = body;

    const rawCandidates = Array.isArray(candidates) ? candidates : [];

    if (rawCandidates.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Tidak ada kandidat pasangan koneksi yang disediakan.' }),
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

    let userPrompt = `Berikut adalah data pasangan kandidat entitas (catatan/tema) yang memiliki kemiripan semantik tinggi:\n\n`;

    rawCandidates.forEach((c: any, idx: number) => {
      userPrompt += `[KANDIDAT #${idx + 1}] (Candidate ID: ${c.candidateId}, Similarity: ${c.similarity})\n`;
      userPrompt += `SOURCE (${c.sourceType}): "${(c.sourceTitles || []).join(', ')}" [IDs: ${(c.sourceIds || []).join(', ')}]\n`;
      userPrompt += `Snippet Source: ${c.sourceContentSnippet || '-'}\n`;
      userPrompt += `TARGET (${c.targetType}): "${(c.targetTitles || []).join(', ')}" [IDs: ${(c.targetIds || []).join(', ')}]\n`;
      userPrompt += `Snippet Target: ${c.targetContentSnippet || '-'}\n\n`;
    });

    const systemPrompt = `Kamu adalah Noesis Connection Engine.
Tugasmu adalah menganalisis keterkaitan semantik antara kelompok entitas SUMBER (source) dan TARGET (target) berdasarkan bukti data nyata, lalu menyintesiskan Nama Hubungan (Title), Deskripsi Keterkaitan (Description), dan Bukti Data (Reasoning).

ATURAN STRICT CONNECTION ENGINE:
1. KETERKAITAN SEMANTIK ALAMI: Temukan hubungan konseptual / metodologis / substantif yang menghubungkan source dan target.
2. DILARANG PERSONALITY ANALYSIS: DILARANG KERAS membuat analisis kepribadian, kepribadian pengguna, diagnosa emosi/psikologis, atau asumsi karakter pribadi.
3. DILARANG PREDEFINED QUERY / ASSUMPTION: Jangan gunakan query tematik bawaan atau membuat asumsi tanpa bukti dalam teks.
4. EVIDENSI / REASONING BUKTI DATA: Lapangan \`reasoning\` HARUS menjelaskan secara spesifik bukti data konkret dari teks source dan target yang menunjukkan keterkaitan tersebut.
5. INPUT MATCHING: Pertahankan \`sourceIds\` dan \`targetIds\` persis dari data kandidat.
6. STRENGTH SCORE: Gunakan nilai \`strength\` berupa angka 0.0 - 1.0 yang mencerminkan kekuatan hubungan semantik.
7. CONNECTION TYPE: Tentukan \`connectionType\` ("theme_bridge" jika Theme ↔ Theme, "theme_evidence" jika Theme ↔ Note).
8. BAHASA INDONESIA: Gunakan bahasa Indonesia yang jelas, profesional, dan presisi.

STRUKTUR JSON OUTPUT (WAJIB JSON VALID SAJA):
{
  "connections": [
    {
      "candidateId": "candidate_xxx",
      "title": "Nama Hubungan Semantik (3-6 kata)",
      "description": "Deskripsi singkat (1-2 kalimat) menjelaskan keterkaitan alami antar entitas.",
      "sourceType": "theme",
      "targetType": "theme",
      "connectionType": "theme_bridge",
      "sourceIds": ["id_source"],
      "targetIds": ["id_target"],
      "strength": 0.85,
      "reasoning": "Bukti fakta konkret dari isi catatan/tema source dan target yang melandasi koneksi ini."
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
          console.warn(`[Connections AI] Gemini model ${model} failed, trying fallback:`, e);
        }
      }
    }

    // Fallback Attempt: Groq API
    if (!rawJsonResponse && groqApiKey) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json',
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

        if (res.ok) {
          const data = await res.json();
          rawJsonResponse = data?.choices?.[0]?.message?.content || '';
        }
      } catch (e) {
        console.warn('[Connections AI] Groq API call failed:', e);
      }
    }

    if (!rawJsonResponse) {
      return new Response(
        JSON.stringify({ error: 'Gagal mendapatkan sintesis AI untuk Connections.' }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    let parsedResult: any = null;
    try {
      parsedResult = JSON.parse(rawJsonResponse);
    } catch {
      const match = rawJsonResponse.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsedResult = JSON.parse(match[0]);
        } catch (e) {
          console.error('[Connections AI] Failed to parse JSON match:', e);
        }
      }
    }

    if (!parsedResult || !Array.isArray(parsedResult.connections)) {
      return new Response(
        JSON.stringify({ error: 'Format JSON dari AI tidak sesuai struktur Connections.' }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify(parsedResult), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error in handleConnections API route:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal Server Error pada Connections API.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
