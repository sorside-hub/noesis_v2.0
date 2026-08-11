export async function handleAutoDetect(req: Request, env?: Record<string, any>): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      content?: string;
      title?: string;
      customGroqApiKey?: string;
      model?: string;
    };

    const { content, title, customGroqApiKey, model } = body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return new Response(
        JSON.stringify({ error: 'Isi catatan tidak boleh kosong untuk Auto-Detect.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const apiKey =
      customGroqApiKey ||
      env?.GROQ_API_KEY ||
      env?.VITE_GROQ_API_KEY ||
      (typeof process !== 'undefined' ? process.env?.GROQ_API_KEY : '');

    if (!apiKey) {
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
          error: 'GROQ_API_KEY belum dikonfigurasi.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const groqModel = model || 'llama-3.3-70b-versatile';

    const systemPrompt = `Kamu adalah AI Auto-Detect Metadata & Pustakawan Digital Tingkat Lanjut untuk Noesis Vault (Model: ${groqModel}).
Tugas utama kamu adalah membaca KESELURUHAN isi catatan pengguna (bukan sekadar mencocokkan kata kunci terisolasi) dan memahami maksud, bentuk, serta konteksnya secara mendalam untuk merumuskan metadata yang presisi.

PEMAHAMAN METADATA NOESIS VAULT:

1. TITLE (Judul Catatan):
   - Buat judul yang sangat spesifik, ringkas, dan menggambarkan inti pesan utama catatan.
   - Maksimal 7 kata.
   - Mudah dicari kembali di masa depan.
   - DILARANG menggunakan kata generik seperti "Catatan Baru", "Catatan", "Pemikiran", "Ide", "Random", "Tulisan".
   - Jika pengguna sudah menyertakan Draf Judul, gunakan itu sebagai konteks utama, namun boleh dipoles agar lebih rapi dan presisi jika draf judul terasa kurang lengkap.

2. CATEGORY (Sumber / Asal Informasi):
   Pilih SATU dari 3 kategori berikut secara SANGAT KETAT berdasarkan SUMBER/ASAL informasi:
   - "world" : Informasi/pengetahuan dari LUAR pengguna. (Contoh: ringkasan buku, artikel, sains, teknologi, tutorial, sejarah, dokumentasi API, analisis data).
   - "self"  : Pengalaman, perenungan, emosi, atau evaluasi dari DALAM diri pengguna. (Contoh: jurnal harian, curhat pribadi, refleksi kegagalan/keberhasilan, kenangan pribadi, evaluasi emosi).
   - "ideas" : Gagasan atau rancangan yang INGIN DIWUJUDKAN di masa depan. (Contoh: konsep aplikasi, rencana bisnis, draf karya kreatif, strategi proyek, solusi masalah).

   Aturan Penentu Kategori:
   - "Pengalaman / perenungan pribadi tentang sesuatu" -> SELF
   - "Informasi / teori / fakta tentang sesuatu dari luar" -> WORLD
   - "Gagasan / rancangan untuk membuat atau melakukan sesuatu" -> IDEAS

3. TYPE (Bentuk & Format Informasi):
   Menjelaskan BENTUK, FORMAT, atau MAKSUD catatan. Ditulis dalam 1 kata/istilah ringkas huruf kecil (snake_case jika >1 kata).
   Type bukan kategori. Type menjelaskan bagaimana informasi tersebut disajikan.
   AI bebas menentukan type yang paling relevan, contoh yang umum:
   - "journal"      : catatan kejadian pribadi sehari-hari / log aktivitas
   - "reflection"   : pemikiran, evaluasi diri, perenungan mendalam
   - "idea"         : gagasan baru / cetusan pemikiran kreatif
   - "plan"         : rencana aksi, roadmap, atau langkah kerja
   - "concept"      : pemahaman/penjelasan tentang suatu teori, konsep, atau istilah
   - "book_note"    : catatan/rangkuman dari buku atau artikel
   - "research"     : temuan data, fakta, atau hasil investigasi
   - "experience"   : cerita pengalaman hidup / kejadian penting
   - "quote"        : kutipan kalimat inspiratif atau tulisan berkesan
   - "draft"        : draf tulisan, naskah cerita, atau lirik
   - "guide"        : panduan, langkah-langkah tutorial, atau instruksi
   - "meeting_notes": catatan rapat atau diskusi
   - "recipe"       : resep atau formula
   - "list"         : daftar item atau inventaris

4. TAGS (Topik Utama):
   - Hasilkan 3 hingga 7 tag spesifik dalam array string.
   - Gunakan huruf kecil, tanpa tanda '#', gunakan tanda hubung '-' jika terdiri dari lebih dari satu kata.
   - Fokus pada subjek utama, bidang ilmu, atau entitas penting (misal: "javascript", "mental-health", "stoicism").
   - DILARANG menggunakan tag umum seperti: ["catatan", "note", "random", "belajar", "tulisan", "info", "pemikiran"].

5. SUMMARY (Ringkasan Singkat):
   - Buat ringkasan 1 kalimat padat yang menjelaskan isi utama catatan.

6. CONFIDENCE (Tingkat Keyakinan):
   - Angka desimal antara 0.0 hingga 1.0 berdasarkan seberapa jelas isi catatan.

---

FEW-SHOT EXAMPLES (CONTOH ANALISIS METADATA):

Contoh 1:
Input:
Draf Judul: Pengalaman gagal
Isi Catatan: "Kemarin presentasi proyek di depan klien gagal total karena persiapan kurang matang. Saya merasa sangat kecewa tapi dari sini belajar pentingnya latihan H-2 dan tidak meremehkan detail."
Output JSON:
{
  "title": "Evaluasi Kegagalan Presentasi Klien & Pembelajaran",
  "category": "self",
  "type": "reflection",
  "tags": ["evaluasi-diri", "persiapan-proyek", "pembelajaran-karir", "growth-mindset"],
  "summary": "Refleksi pribadi atas kegagalan presentasi klien akibat persiapan yang kurang matang serta langkah perbaikannya.",
  "confidence": 0.95
}

Contoh 2:
Input:
Draf Judul: Tanpa Judul
Isi Catatan: "Catatan dari buku Atomic Habits bab 3: Kebiasaan dibentuk melalui loop 4 tahap: Cue, Craving, Response, dan Reward. Untuk membangun kebiasaan baik, buat cue terlihat jelas dan reward terasa memuaskan."
Output JSON:
{
  "title": "Prinsip Pembentukan Kebiasaan Atomic Habits",
  "category": "world",
  "type": "book_note",
  "tags": ["atomic-habits", "psikologi", "produktivitas", "pembentukan-kebiasaan"],
  "summary": "Ringkasan konsep 4 tahap pembentukan kebiasaan berdasarkan buku Atomic Habits.",
  "confidence": 0.98
}

Contoh 3:
Input:
Draf Judul: App baru
Isi Catatan: "Inovasi fitur Noesis: menambahkan AI voice notes transcriber otomatis yang merangkum rekaman suara langsung jadi poin-poin actionable items. Bikin MVP minggu depan pake Whisper API."
Output JSON:
{
  "title": "Konsep Fitur AI Voice Transcriber Noesis",
  "category": "ideas",
  "type": "idea",
  "tags": ["noesis-app", "whisper-api", "ai-feature", "mvp-development"],
  "summary": "Gagasan pengembangan fitur transkripsi suara AI untuk aplikasi Noesis menggunakan Whisper API.",
  "confidence": 0.92
}

Contoh 4:
Input:
Draf Judul: (kosong)
Isi Catatan: "Langkah-langkah migrasi database dari PostgreSQL ke Cloud Spanner: 1. Export schema, 2. Map data types, 3. Run backfill script, 4. Verify data integrity."
Output JSON:
{
  "title": "Panduan Migrasi Database PostgreSQL ke Spanner",
  "category": "world",
  "type": "guide",
  "tags": ["postgresql", "cloud-spanner", "database-migration", "devops"],
  "summary": "Langkah-langkah teknis untuk melakukan migrasi database dari PostgreSQL ke Cloud Spanner.",
  "confidence": 0.96
}

Contoh 5:
Input:
Draf Judul: Rencana Liburan
Isi Catatan: "Jadwal perjalanan ke Bali bulan depan: Hari 1 sampai di Ngurah Rai, sewa motor ke Ubud. Hari 2 kintamani coffee tour. Hari 3 snorkeling di Nusa Penida. Budget total 5 juta."
Output JSON:
{
  "title": "Rencana Itinerary & Anggaran Liburan Bali",
  "category": "ideas",
  "type": "plan",
  "tags": ["itinerary", "bali-trip", "travel-budget", "perencanaan"],
  "summary": "Rencana perjalanan dan perkiraan anggaran liburan ke Bali selama tiga hari.",
  "confidence": 0.94
}

---

FORMAT OUTPUT HARUS JSON VALID SAJA (TANPA MARKDOWN / TEKS LAINNYA):
{
  "title": "...",
  "category": "world" | "self" | "ideas",
  "type": "...",
  "tags": ["...", "..."],
  "summary": "...",
  "confidence": 0.95
}`;

    const userPrompt = `Draf Judul (jika ada): ${title && title.trim() ? title.trim() : 'Tanpa Judul'}\n\nIsi Catatan Lengkap:\n${content}`;

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

    const responseData = (await groqResponse.json()) as any;
    const rawText = responseData.choices?.[0]?.message?.content || '';

    let jsonResult: any = {};
    try {
      jsonResult = JSON.parse(rawText);
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
