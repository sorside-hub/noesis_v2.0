import { GoogleGenAI, Type } from "@google/genai";
import { getGeminiApiKeys } from "./geminiHelper";

export async function handleReflections(req: Request, env?: Record<string, any>): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const { themes = [], thinkingPatterns = [], connections = [], notes = [] } = body;

    const geminiApiKeys = getGeminiApiKeys(env);

    const groqApiKey =
      env?.GROQ_API_KEY ||
      env?.VITE_GROQ_API_KEY ||
      (typeof process !== 'undefined' ? process.env?.GROQ_API_KEY : '');

    if (geminiApiKeys.length === 0 && !groqApiKey) {
      return new Response(
        JSON.stringify({
          error: 'API Key (GEMINI_API_KEY atau GROQ_API_KEY) belum dikonfigurasi.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }


    // Construct high-quality context text about themes, thinking patterns, connections, and notes
    let dataContext = `DATA GRAPH PENGETAHUAN NOESIS:\n\n`;

    dataContext += `[CATATAN DI VAULT (Jumlah: ${notes.length})]\n`;
    notes.slice(0, 15).forEach((note: any) => {
      dataContext += `- ID: "${note.id}" | Judul: "${note.title || 'Tanpa Judul'}" | Kategori: "${note.category || 'Umum'}" | Tag: ${(note.tags || []).join(', ')}\n`;
      if (note.content) {
        dataContext += `  Konten: ${note.content.slice(0, 250)}\n`;
      }
    });

    dataContext += `\n[TEMA YANG TERBENTUK (Jumlah: ${themes.length})]\n`;
    themes.slice(0, 10).forEach((t: any) => {
      dataContext += `- ID: "${t.id}" | Nama Tema: "${t.title}" | Deskripsi: "${t.description}" | ID Catatan Terkait: ${(t.relatedNoteIds || []).join(', ')}\n`;
    });

    dataContext += `\n[POLA PIKIR YANG TERDETEKSI (Jumlah: ${thinkingPatterns.length})]\n`;
    thinkingPatterns.slice(0, 10).forEach((p: any) => {
      dataContext += `- ID: "${p.id}" | Pola Pikir: "${p.title}" | Penjelasan: "${p.description}" | ID Catatan Bukti: ${(p.relatedNoteIds || []).join(', ')}\n`;
    });

    dataContext += `\n[HUBUNGAN IDE / CONNECTIONS (Jumlah: ${connections.length})]\n`;
    connections.slice(0, 10).forEach((c: any) => {
      dataContext += `- ID: "${c.id}" | Nama Hubungan: "${c.title}" | Penjelasan: "${c.description}" | ID Sumber: ${(c.sourceIds || []).join(', ')} | ID Target: ${(c.targetIds || []).join(', ')}\n`;
    });

    const systemPrompt = `Kamu adalah Noesis Reflection Synthesis Engine.
Tugasmu adalah menghasilkan refleksi berbasis bukti (evidence-based reflections) berdasarkan pola kognitif, tema, hubungan ide, dan catatan yang ada di graph pengetahuan pengguna.

ATURAN STRICT GENERASI REFLEKSI:
1. NO PERSONALITY ANALYSIS: Jangan membuat analisis kepribadian, profiling karakter, diagnosis psikologis, atau penghakiman sifat pengguna.
2. NO DIAGNOSIS: Dilarang keras memberikan saran medis, klinis, atau diagnosis psikologi.
3. NO UNSUPPORTED ASSUMPTIONS: Jangan membuat asumsi di luar data catatan nyata yang diberikan. Refleksi harus murni menjembatani benang merah dari data yang ada.
4. EVIDENSI JELAS: Setiap objek refleksi harus menautkan array ID yang valid dari sumber data ke dalam \`relatedThemeIds\`, \`relatedConnectionIds\`, dan \`relatedNoteIds\`. Jika tidak ada relasi langsung ke salah satunya, biarkan berupa array kosong.
5. KLASIFIKASI REFLEKSI (type): Kamu wajib mengklasifikasikan setiap refleksi ke dalam salah satu dari tipe berikut:
   - "creative_reflection" (jika menyoroti koneksi kreatif antara konsep berbeda)
   - "pattern_reflection" (jika menyoroti pola berpikir atau struktur kognitif yang berulang)
   - "growth_reflection" (jika menunjukkan area pembelajaran atau potensi pendalaman wawasan)
   - "tension_reflection" (jika menyoroti anomali atau pertentangan sudut pandang antar catatan)
6. DASAR PEMBENTUKAN (formationBasis): Tuliskan 1-3 kalimat penjelasan mengapa refleksi ini terbentuk dari relasi beberapa catatan tertentu (sebutkan beberapa judul catatan terkait). Jelaskan juga konsep utama yang menghubungkan semuanya secara sinergis.
7. PERBAIKAN PERTANYAAN INDUKTIF (question): Pertanyaan reflektif tidak boleh terlalu akademis/kaku (hindari contoh seperti "Bagaimana pemahaman tentang X dapat memperkaya metodologi..."). Gunakan gaya eksplorasi personal yang hangat dan mendalam, misalnya: "Apakah cara kamu menyusun musik memiliki pola yang sama dengan cara kamu menyusun ide?". Harus menggunakan kata "kamu" agar kontemplatif personal. Pertanyaan tidak boleh berupa nasihat, kesimpulan, atau diagnosis.
8. STRUKTUR REFLEKSI:
   - type: Tipe klasifikasi dari aturan #5.
   - title: Judul refleksi yang ringkas, bernuansa kontemplatif praktis (3-6 kata).
   - observation: Pernyataan objektif merangkum benang merah yang terlihat dari data.
   - formationBasis: Penjelasan dasar pembentukan dari aturan #6.
   - question: Pertanyaan pemantik eksplorasi personal dari aturan #7.
   - context: Penjelasan singkat mengapa hal ini berharga bagi eksplorasi kognitif mereka.
9. BAHASA INDONESIA: Gunakan bahasa Indonesia yang santun, kontemplatif, tajam, profesional, dan ringkas.

Hasilkan minimal 2 dan maksimal 4 refleksi yang paling berharga dari data di atas.`;

    let rawJsonResponse = '';

    // Primary & Secondary: Google Gen AI / Gemini Keys
    for (const geminiApiKey of geminiApiKeys) {
      if (rawJsonResponse) break;

      try {
        const ai = new GoogleGenAI({
          apiKey: geminiApiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });

        const response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: `${systemPrompt}\n\n${dataContext}`,
          config: {
            temperature: 0.3,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                reflections: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING, description: "Unik ID untuk refleksi ini, gunakan format 'refl_' ditambah string acak atau timestamp." },
                      type: { type: Type.STRING, description: "Salah satu dari: creative_reflection, pattern_reflection, growth_reflection, tension_reflection" },
                      title: { type: Type.STRING },
                      observation: { type: Type.STRING },
                      formationBasis: { type: Type.STRING },
                      question: { type: Type.STRING },
                      context: { type: Type.STRING },
                      relatedThemeIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                      relatedConnectionIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                      relatedNoteIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                    required: ["id", "type", "title", "observation", "formationBasis", "question", "context", "relatedThemeIds", "relatedConnectionIds", "relatedNoteIds"]
                  }
                }
              },
              required: ["reflections"]
            }
          }
        });

        if (response?.text) {
          rawJsonResponse = response.text;
          break;
        }
      } catch (geminiError) {
        console.warn('[Reflection AI] Google Gen AI SDK failed, trying fallback raw fetch:', geminiError);
        
        // Fallback to raw fetch if SDK fails for any model mismatch or custom issue
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${geminiApiKey}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [{ text: `${systemPrompt}\n\n${dataContext}` }],
                },
              ],
              generationConfig: {
                temperature: 0.3,
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
        } catch (fetchError) {
          console.error('[Reflection AI] Gemini raw fetch fallback also failed:', fetchError);
        }
      }
    }


    // Fallback: Groq API
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
              { role: 'user', content: dataContext },
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' },
          }),
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          rawJsonResponse = groqData?.choices?.[0]?.message?.content || '';
        }
      } catch (groqError) {
        console.warn('[Reflection AI] Groq fallback failed:', groqError);
      }
    }

    if (!rawJsonResponse) {
      return new Response(
        JSON.stringify({ error: 'Gagal menghasilkan refleksi menggunakan AI.' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const cleanedText = rawJsonResponse
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleanedText);
    const reflections = (Array.isArray(parsed?.reflections) ? parsed.reflections : []).map((refl: any, index: number) => {
      const now = Date.now();
      return {
        id: refl.id || `refl_${now}_${index}_${Math.random().toString(36).substring(2, 6)}`,
        type: refl.type || 'pattern_reflection',
        title: refl.title || 'Refleksi Sintetis',
        observation: refl.observation || '',
        formationBasis: refl.formationBasis || 'Refleksi ini terbentuk dari jalinan relasi ide dalam catatan Anda.',
        question: refl.question || '',
        context: refl.context || '',
        relatedThemeIds: Array.isArray(refl.relatedThemeIds) ? refl.relatedThemeIds : [],
        relatedConnectionIds: Array.isArray(refl.relatedConnectionIds) ? refl.relatedConnectionIds : [],
        relatedNoteIds: Array.isArray(refl.relatedNoteIds) ? refl.relatedNoteIds : [],
        createdAt: now + index,
      };
    });

    return new Response(JSON.stringify({ reflections }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in handleReflections:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Terjadi kesalahan internal pada Reflection Engine.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
