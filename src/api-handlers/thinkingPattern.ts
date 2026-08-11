import { getGeminiApiKeys } from './geminiHelper';

export async function handleThinkingPattern(req: Request, env?: Record<string, any>): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const { sanitizedNotes, notes, clusters, connections, metaInfo } = body;

    const rawNotes = sanitizedNotes || notes || [];
    const rawClusters = Array.isArray(clusters) ? clusters : [];
    const rawConnections = Array.isArray(connections) ? connections : [];

    if (!Array.isArray(rawNotes) || rawNotes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Tidak ada catatan yang disediakan untuk dianalisis.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const geminiApiKeys = getGeminiApiKeys(env);

    const groqApiKey =
      env?.GROQ_API_KEY ||
      env?.VITE_GROQ_API_KEY ||
      (typeof process !== 'undefined' ? process.env?.GROQ_API_KEY : '');

    if (geminiApiKeys.length === 0 && !groqApiKey) {
      return new Response(
        JSON.stringify({
          error:
            'API Key (GEMINI_API_KEY atau GROQ_API_KEY) belum dikonfigurasi pada environment.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const notesSummaryText = rawNotes
      .map(
        (n: any, idx: number) =>
          `[Note Source #${idx + 1}] ID: "${n.id}" | Title: "${n.title || 'Tanpa Judul'}" | Category: ${n.category || 'Umum'} | Type: ${n.type || 'note'} | Tags: ${
            Array.isArray(n.tags) && n.tags.length > 0 ? n.tags.join(', ') : '-'
          }\nContent Snippet:\n${n.content}\n`
      )
      .join('\n---\n');

    let userPrompt = `Berikut adalah data klaster semantik, korelasi antar-catatan, dan detail pengetahuan dari Vault pengguna:\n\n`;

    if (metaInfo) {
      userPrompt += `[DISCOVERY ENGINE METADATA]\n- Total Note: ${metaInfo.totalNotes} | Strategy: ${metaInfo.comparisonStrategy} | Similarity Threshold: ${metaInfo.similarityThreshold} | Max Cluster Size: ${metaInfo.maxClusterSize}\n\n`;
    }

    if (rawClusters.length > 0) {
      userPrompt += `[KLASTER SEMANTIK KOHESIF TERDETEKSI]\n`;
      rawClusters.forEach((c: any, idx: number) => {
        const titles = Array.isArray(c.noteTitles) && c.noteTitles.length > 0
          ? ` | Titles: ${c.noteTitles.map((t: string) => `"${t}"`).join(', ')}`
          : '';
        userPrompt += `- Klaster #${idx + 1} (Skor Kohesi/Avg Similarity: ${c.avgSimilarity}, Note Count: ${(c.noteIds || []).length}): Note IDs: [${(c.noteIds || []).join(', ')}]${titles}\n`;
      });
      userPrompt += `\n`;
    }

    if (rawConnections.length > 0) {
      userPrompt += `[HUBUNGAN SEMANTIK ANTA-CATATAN (SIMILARITY STRENGTH ENRICHED)]\n`;
      rawConnections.forEach((conn: any) => {
        const strength = conn.strengthLabel ? ` (${conn.strengthLabel})` : '';
        userPrompt += `- Source: "${conn.sourceTitle}" (ID: ${conn.sourceNoteId}) <---> Target: "${conn.targetTitle}" (ID: ${conn.targetNoteId}) [Similarity Strength: ${conn.similarityScore}${strength}]\n`;
      });
      userPrompt += `\n`;
    }

    userPrompt += `[DETAIL ISI CATATAN VAULT]\n${notesSummaryText}`;

    const systemPrompt = `Kamu adalah Noesis Thinking Pattern Discovery Engine.
Tugasmu adalah menganalisis struktur hubungan semantik dan klaster pengetahuan alami antar catatan pengguna untuk menemukan pola cara berpikir (Thinking Pattern) murni dari data empiris yang tersedia.

ATURAN STRICT DISCOVERY & EVIDENSI:
1. MURNI OBSERVAKSI & KNOWLEDGE-BASED: Temukan pola kerangka kognitif alami dari data fisik catatan. DILARANG membatasi diri pada preset atau template tertentu. Nama pattern harus spesifik dan reflektif terhadap sintesis ide (contoh: "Systems Architecture Synthesizer", "Modular Problem Deconstructor", "Theoretical to Practical Bridge", "Cross-Domain Analogy Framework").
2. BUKAN PERSONALITY TEST / BUKAN LABEL KARAKTER: DILARANG KERAS membuat diagnosa kepribadian, trait emosional/psikologis (seperti "Introvert", "Melancholic", "Optimistic", "Perfectionist", "Anxious Thinker"), atau penghakiman karakter pribadi. Fokus HANYA pada struktur keterkaitan ide dan cara konsep saling terhubung.
3. EVIDENCE-BASED WAJIB: Setiap pattern HARUS menyertakan bukti empiris eksplisit. Wajib menyebutkan ID & Judul catatan terkait serta menjelaskan bagaimana konsep di dalamnya berhubungan dengan tingkat keterkaitan (similarity strength) yang relevan.
4. AMBANG KETERKAITAN & VALIDASI: Jika catatan atau klaster yang diberikan tidak memiliki keterkaitan konsep yang cukup kuat untuk membentuk pola pemikiran yang valid, kembalikan array "patterns" kosong [].
5. BAHASA INDONESIA: Berikan judul, deskripsi observasional (1-2 kalimat), dan reasoning bukti empiris dalam bahasa Indonesia yang tajam, rasional, dan profesional.

STRUKTUR JSON OUTPUT (WAJIB JSON VALID SAJA):
{
  "patterns": [
    {
      "title": "Nama Pola Kognitif Observasional Organik",
      "description": "Deskripsi observasional mengenai kerangka kerja ide yang terwujud dari catatan.",
      "reasoning": "Bukti konkret dari catatan dan hubungan konsep yang mendukung pola ini (wajib sebutkan ID dan Judul catatan).",
      "relatedNoteIds": ["id_note_1", "id_note_2"],
      "confidence": 0.90
    }
  ]
}`;

    let rawJsonResponse = '';

    // Primary & Secondary Attempts: Gemini API Keys
    const modelsToTry = ['gemini-3.1-pro-preview'];
    thinkingLoop: for (const model of modelsToTry) {
      for (const geminiApiKey of geminiApiKeys) {
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
                responseMimeType: 'application/json',
                temperature: 0.3,
              },
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const textResult = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (textResult) {
              rawJsonResponse = textResult;
              break thinkingLoop;
            }
          }
        } catch (gemErr) {
          console.warn(`[Thinking Pattern Handler] Gemini model ${model} failed`, gemErr);
        }
      }
    }

    // Fallback Attempt: Groq AI
    if (!rawJsonResponse && groqApiKey) {
      try {
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
            response_format: { type: 'json_object' },
            temperature: 0.3,
          }),
        });

        if (groqResponse.ok) {
          const data = await groqResponse.json();
          rawJsonResponse = data.choices?.[0]?.message?.content || '';
        }
      } catch (groqErr) {
        console.warn('[Thinking Pattern Handler] Groq fallback failed', groqErr);
      }
    }

    if (!rawJsonResponse) {
      return new Response(
        JSON.stringify({
          error: 'Layanan AI sedang tidak dapat merespon. Silakan periksa kunci API Anda.',
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    let jsonResult: any = {};
    try {
      jsonResult = JSON.parse(rawJsonResponse);
    } catch {
      const match = rawJsonResponse.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          jsonResult = JSON.parse(match[0]);
        } catch {}
      }
    }

    const patterns = Array.isArray(jsonResult.patterns) ? jsonResult.patterns : [];

    return new Response(JSON.stringify({ patterns }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: err?.message || 'Terjadi kesalahan server pada Thinking Pattern API.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
