import { retrievalService, RetrievalMethod } from './retrieval';
import { sendMessageStream } from '../ai/gemini';
import { Message, MessageModelMeta, RAGMode, RAGStatusMetadata } from '../../shared/types';
import { groqClassifier, ClassificationResult } from '../ai/classifier';

export type ReasoningStyle =
  | 'Recall'
  | 'Explain'
  | 'Analyze'
  | 'Critique'
  | 'Compare'
  | 'Synthesize'
  | 'Brainstorm';

export type MemoryDepth = 'shallow' | 'normal' | 'deep' | 'very_deep' | 'broad';

/**
 * Determines Reasoning Style for Smart Mode based on Classifier output, query keywords, or intent.
 */
export function determineReasoningStyle(
  classifiedStyle?: string,
  intent?: string,
  query: string = ''
): ReasoningStyle {
  if (classifiedStyle) {
    const validStyles: ReasoningStyle[] = ['Recall', 'Explain', 'Analyze', 'Critique', 'Compare', 'Synthesize', 'Brainstorm'];
    const match = validStyles.find((s) => s.toLowerCase() === classifiedStyle.toLowerCase().trim());
    if (match) return match;
  }

  const q = query.toLowerCase();

  // High-priority keyword triggers
  if (q.includes('kritik') || q.includes('kelemahan') || q.includes('risiko') || q.includes('kekurangan') || q.includes('evaluasi') || q.includes('masukan')) {
    return 'Critique';
  }
  if (q.includes('bandingkan') || q.includes('perbandingan') || q.includes(' bedanya ') || q.includes(' vs ') || q.includes('vs.')) {
    return 'Compare';
  }
  if (q.includes('pola') || q.includes('sintesis') || q.includes('gabungkan') || q.includes('kesimpulan dari catatan') || q.includes('pola yang kamu lihat')) {
    return 'Synthesize';
  }
  if (q.includes('hubungan') || q.includes('kaitan') || q.includes('korelasi') || q.includes('hubungkan')) {
    return 'Analyze';
  }
  if (q.includes('ide lanjutan') || q.includes('kembangkan') || q.includes('brainstorm') || q.includes('inovasi') || q.includes('bagaimana jika')) {
    return 'Brainstorm';
  }

  // Intent-based fallback mapping
  switch (intent) {
    case 'memory_recall':
      return 'Recall';
    case 'topic_query':
      return 'Explain';
    case 'analysis_critique':
      return 'Analyze';
    case 'reflection':
      return 'Synthesize';
    case 'creation':
      return 'Brainstorm';
    default:
      if (q.includes('jelaskan') || q.includes('apa itu') || q.includes('bagaimana')) {
        return 'Explain';
      }
      return 'Analyze';
  }
}

/**
 * Determines Memory Depth based on Classifier output or Reasoning Style
 */
export function determineMemoryDepth(
  classifiedDepth?: string,
  style?: ReasoningStyle
): MemoryDepth {
  if (classifiedDepth) {
    const validDepths: MemoryDepth[] = ['shallow', 'normal', 'deep', 'very_deep', 'broad'];
    const match = validDepths.find((d) => d.toLowerCase() === classifiedDepth.toLowerCase().trim());
    if (match) return match;
  }

  switch (style) {
    case 'Recall':
      return 'shallow';
    case 'Explain':
      return 'normal';
    case 'Analyze':
    case 'Critique':
    case 'Compare':
      return 'deep';
    case 'Synthesize':
      return 'very_deep';
    case 'Brainstorm':
      return 'broad';
    default:
      return 'normal';
  }
}

/**
 * Calculates composite Memory Confidence based on score, average score, result count, and category diversity.
 */
export function calculateMemoryConfidence(chunks: any[], targetTopK: number) {
  if (!chunks || chunks.length === 0) {
    return {
      level: 'low' as const,
      highestScore: 0,
      avgScore: 0,
      compositeScore: 0,
      categories: [] as string[],
    };
  }

  const highestScore = chunks.reduce((max, c) => Math.max(max, c.score || 0), 0);
  const topN = chunks.slice(0, 3);
  const avgScore = topN.reduce((sum, c) => sum + (c.score || 0), 0) / topN.length;
  const countRatio = Math.min(chunks.length / targetTopK, 1.0);

  const uniqueCategories = Array.from(
    new Set(chunks.map((c) => (c.chunk.category || 'self').toLowerCase().trim()))
  );
  const categoryDiversityBonus = uniqueCategories.length > 1 ? 0.10 : 0.05;

  const compositeScore = (highestScore * 0.50) + (avgScore * 0.30) + (countRatio * 0.10) + (categoryDiversityBonus * 0.10);

  let level: 'high' | 'medium' | 'low' = 'low';
  if (highestScore >= 0.70 || compositeScore >= 0.65) {
    level = 'high';
  } else if (highestScore >= 0.40 || compositeScore >= 0.40) {
    level = 'medium';
  } else {
    level = 'low';
  }

  return {
    level,
    highestScore,
    avgScore,
    compositeScore,
    categories: uniqueCategories,
  };
}

/**
 * Returns specific instructions for Gemini according to Reasoning Style
 */
function getReasoningStyleInstruction(style: ReasoningStyle): string {
  switch (style) {
    case 'Recall':
      return `[REASONING STYLE: RECALL (Mengingat Informasi)]
- Tujuan: Mengingat dan menyajikan kembali informasi spesifik dari catatan Vault pengguna.
- Instruksi: Ekstrak fakta, ide, atau kutipan penting dari catatan pengguna. Sajikan secara terstruktur, jelas, dan rapi. Tambahkan sedikit penjelasan konteks bila diperlukan.`;

    case 'Explain':
      return `[REASONING STYLE: EXPLAIN (Menjelaskan Konsep)]
- Tujuan: Menjelaskan konsep yang tercatat di Vault dan memperkayanya dengan pengetahuan umum AI.
- Instruksi: Jelaskan isi catatan pengguna secara jernih, lalu tambahkan pengetahuan umum AI, contoh konkret, latar belakang sejarah/teori, atau tokoh terkait untuk memberikan wawasan yang lebih dalam.`;

    case 'Analyze':
      return `[REASONING STYLE: ANALYZE (Menganalisis & Mencari Hubungan)]
- Tujuan: Mencari korelasi, hubungan logis, dan makna di balik catatan pengguna.
- Instruksi: Analisis bagaimana poin-poin dalam Vault berhubungan satu sama lain atau dengan pertanyaan pengguna. Jelaskan implikasi logis, motif, atau kaitan tersembunyi.`;

    case 'Critique':
      return `[REASONING STYLE: CRITIQUE (Mengevaluasi & Mengkritik Ide)]
- Tujuan: Melakukan evaluasi kritis terhadap ide, konsep, atau rencana pengguna dari Vault.
- Instruksi: Pahami tujuan ide pengguna. Berikan evaluasi mendalam: temukan potensi kelemahan, risiko yang belum terpikirkan, tantangan implementasi, sudut pandang berlawanan, serta saran konkret untuk memperkuat ide tersebut.`;

    case 'Compare':
      return `[REASONING STYLE: COMPARE (Membandingkan Perspektif/Catatan)]
- Tujuan: Membandingkan dua atau lebih catatan, konsep, atau evolusi pemikiran pengguna.
- Instruksi: Bandingkan catatan/konsep secara berdampingan. Tunjukkan persamaan, perbedaan, kelebihan, kekurangan, atau bagaimana sudut pandang pengguna telah berkembang dari waktu ke waktu.`;

    case 'Synthesize':
      return `[REASONING STYLE: SYNTHESIZE (Merangkum & Sintesis Lintas Catatan)]
- Tujuan: Menggabungkan beberapa catatan (lintas kategori World, Self, Ideas) menjadi insight baru.
- Instruksi: Hubungkan titik-titik dari berbagai catatan pengguna. Tarik pola besar (meta-insight) yang muncul dari gabungan catatan tersebut secara holistik.`;

    case 'Brainstorm':
      return `[REASONING STYLE: BRAINSTORM (Mengembangkan Ide Baru)]
- Tujuan: Mengembangkan ide baru menggunakan Vault pengguna sebagai pijakan inspirasi.
- Instruksi: Gunakan catatan Vault sebagai bahan mentah. Hasilkan ide-ide lanjutan yang kreatif, variasi konsep, skenario eksekusi, atau langkah aksi nyata.`;

    default:
      return `[REASONING STYLE: ANALYZE]
- Instruksi: Pahami konteks catatan Vault dan berikan analisis mendalam.`;
  }
}

export interface RouteMessageOptions {
  message: string;
  history?: Message[];
  ragMode?: RAGMode;
  searchMethod?: RetrievalMethod;
  topK?: number;
  similarityThreshold?: number;
  categoryFilter?: string | string[];
  typeFilter?: string | string[];
  tagFilter?: string | string[];
  onChunk?: (chunk: string) => void;
  onMeta?: (meta: MessageModelMeta) => void;
  onStatus?: (status: string) => void;
}

export interface RouteMessageResult {
  fullText: string;
  wasRetrievalUsed: boolean;
  modelMeta?: MessageModelMeta;
  retrievedContexts?: {
    chunkId: string;
    noteId: string;
    title: string;
    noteTitle: string;
    category: string;
    type: string;
    tags: string[];
    score: number;
    snippet: string;
  }[];
  ragStatus?: RAGStatusMetadata;
}

export class RAGRouter {
  /**
   * Routes chat message according to selected RAG Mode:
   * - Smart: AI determines Vault context as thinking material + applies Reasoning Style, Memory Depth & Composite Confidence
   * - On: Vault-focused direct answer from notes
   * - Off: Disables retrieval, routes directly to normal Gemini
   */
  async routeAndExecute({
    message,
    history = [],
    ragMode = 'smart',
    searchMethod = 'hybrid',
    topK = 5,
    similarityThreshold = 0,
    categoryFilter = 'all',
    typeFilter = 'all',
    tagFilter = 'all',
    onChunk,
    onMeta,
    onStatus,
  }: RouteMessageOptions): Promise<RouteMessageResult> {
    const startTime = performance.now();
    let capturedMeta: MessageModelMeta | undefined = undefined;
    const handleMeta = (meta: MessageModelMeta) => {
      capturedMeta = meta;
      if (onMeta) onMeta(meta);
    };

    // Mode OFF -> Directly call Gemini normal, skip retrieval entirely
    if (ragMode === 'off') {
      onStatus?.('✍️ Menyusun jawaban...');
      const fullText = await sendMessageStream(message, history, onChunk, handleMeta);
      const processingTime = Math.round(performance.now() - startTime);

      return {
        fullText,
        wasRetrievalUsed: false,
        modelMeta: capturedMeta,
        ragStatus: {
          mode: 'off',
          usedVault: false,
          processingTime,
        },
      };
    }

    let candidateChunks: any[] = [];
    let classification: ClassificationResult | null = null;
    let reasoningStyle: ReasoningStyle = 'Analyze';
    let memoryDepth: MemoryDepth = 'normal';

    if (ragMode === 'smart') {
      onStatus?.('⚡ Menganalisis konteks & intent...');
      try {
        classification = await groqClassifier.classifyIntent(message);
      } catch (err) {
        console.warn('[Smart RAG Router] Groq classifier error, falling back:', err);
        classification = null;
      }

      reasoningStyle = determineReasoningStyle(
        classification?.reasoningStyle,
        classification?.intent,
        message
      );
      memoryDepth = determineMemoryDepth(
        classification?.memoryDepth,
        reasoningStyle
      );

      if (classification) {
        if (!classification.needRAG) {
          // Smalltalk / greeting
          candidateChunks = [];
          onStatus?.('✍️ Menyusun jawaban...');
        } else {
          // Substantive query -> Thinking with Vault
          onStatus?.('🧠 Memeriksa Vault untuk bahan berpikir...');

          let smartCategoryFilter: string | string[] = 'all';
          if (classification.category) {
            const rawCat = classification.category.toLowerCase().trim();
            if (['world', 'self', 'ideas'].includes(rawCat)) {
              smartCategoryFilter = [rawCat];
            }
          }

          // Determine retrieval strategy parameters based on Memory Depth
          let targetTopK = 5;
          let methodToUse: RetrievalMethod = 'hybrid';
          let minThreshold = 0.20;

          switch (memoryDepth) {
            case 'shallow':
              targetTopK = 3;
              methodToUse = 'bm25';
              minThreshold = 0.25;
              break;
            case 'normal':
              targetTopK = 5;
              methodToUse = 'hybrid';
              minThreshold = 0.20;
              break;
            case 'deep':
              targetTopK = 8;
              methodToUse = 'hybrid';
              minThreshold = 0.15;
              break;
            case 'very_deep':
              targetTopK = 10;
              methodToUse = 'hybrid';
              minThreshold = 0.12;
              break;
            case 'broad':
              targetTopK = 8;
              methodToUse = 'vector';
              minThreshold = 0.10;
              break;
          }

          // Step 1: Primary Category Retrieval
          candidateChunks = await retrievalService.searchRelevantChunks(
            message,
            targetTopK,
            methodToUse,
            minThreshold,
            smartCategoryFilter,
            'all',
            'all'
          );

          // Step 2: Multi-Note / Cross-Category Expansion for deep/very_deep/broad
          if (
            (candidateChunks.length < Math.min(targetTopK, 4) || ['deep', 'very_deep', 'broad'].includes(memoryDepth)) &&
            smartCategoryFilter !== 'all'
          ) {
            const extraChunks = await retrievalService.searchRelevantChunks(
              message,
              targetTopK,
              'hybrid',
              minThreshold,
              'all',
              'all',
              'all'
            );

            // Merge unique chunks
            const existingIds = new Set(candidateChunks.map((c) => c.chunk.id));
            for (const chunk of extraChunks) {
              if (!existingIds.has(chunk.chunk.id)) {
                candidateChunks.push(chunk);
              }
            }
          }
        }
      } else {
        // Fallback if classifier failed
        onStatus?.('🧠 Memeriksa Vault...');
        candidateChunks = await retrievalService.searchRelevantChunks(
          message,
          5,
          'hybrid',
          0.15,
          'all',
          'all',
          'all'
        );
      }
    } else if (ragMode === 'on') {
      // ON MODE: Always use retrieval with user's manual configuration
      onStatus?.('🧠 Mencari di Vault...');
      candidateChunks = await retrievalService.searchRelevantChunks(
        message,
        topK,
        searchMethod,
        similarityThreshold,
        categoryFilter,
        typeFilter,
        tagFilter
      );
    }

    // Evaluate Composite Memory Confidence
    const targetTopK = memoryDepth === 'shallow' ? 3 : memoryDepth === 'very_deep' ? 10 : 5;
    const confidenceResult = calculateMemoryConfidence(candidateChunks, targetTopK);

    let confidenceLevel: 'high' | 'medium' | 'low' = confidenceResult.level;
    let usedVault = false;

    if (candidateChunks.length > 0) {
      if (confidenceLevel === 'high' || confidenceLevel === 'medium') {
        usedVault = true;
      } else {
        // Score < 40% (low confidence) -> Ignore Vault content
        usedVault = false;
      }
    }

    // MODE ON forced vault usage if chunks found
    if (ragMode === 'on' && candidateChunks.length > 0) {
      usedVault = true;
    }

    if (usedVault && candidateChunks.length > 0) {
      onStatus?.('🔎 Menemukan konteks Vault relevan...');

      // Format retrieved chunks with rich metadata
      const contextText = candidateChunks
        .map((c, i) => {
          const metaParts: string[] = [];
          if (c.chunk.title) metaParts.push(`Judul: ${c.chunk.title}`);
          if (c.chunk.category) metaParts.push(`Kategori: ${c.chunk.category.toUpperCase()}`);
          if (c.chunk.type) metaParts.push(`Tipe: ${c.chunk.type}`);
          if (c.chunk.tags && c.chunk.tags.length > 0) metaParts.push(`Tag: ${c.chunk.tags.join(', ')}`);
          const metaHeader = metaParts.length > 0 ? ` [${metaParts.join(' | ')}]` : '';

          return `[Catatan ${i + 1} - Relevansi: ${Math.round(c.score * 100)}%${metaHeader}]:\n${c.chunk.content}`;
        })
        .join('\n\n');

      let confidenceGuidance = '';
      if (ragMode === 'smart') {
        if (confidenceLevel === 'high') {
          confidenceGuidance = `[EVALUASI RELEVANSI VAULT: TINGGI (Composite Score ${Math.round(confidenceResult.compositeScore * 100)}%, Highest ${Math.round(confidenceResult.highestScore * 100)}%)]
- Catatan Vault adalah SUMBER UTAMA dan PERSPEKTIF PRIMER dalam berpikir dan menjawab.
- Pahami konteks catatan secara utuh dan jadikan landasan argumen utama.
- Pengetahuan umum AI digunakan HANYA untuk memperjelas, memperluas, memberi latar belakang sejarah/teori, atau melengkapi insight.`;
        } else {
          confidenceGuidance = `[EVALUASI RELEVANSI VAULT: SEDANG (Composite Score ${Math.round(confidenceResult.compositeScore * 100)}%, Highest ${Math.round(confidenceResult.highestScore * 100)}%)]
- Pengetahuan umum AI menjadi PENJELASAN UTAMA.
- Catatan Vault dijadikan sebagai REFERENSI TAMBAHAN, latar belakang, atau koneksi ke pemikiran/jurnal pengguna.
- Hubungkan penjelasan utama pengetahuan umum dengan sudut pandang dari catatan pengguna.`;
        }
      }

      const styleInstruction = ragMode === 'smart' ? getReasoningStyleInstruction(reasoningStyle) : '';

      const uniqueNoteTitles = Array.from(
        new Set(candidateChunks.map((c) => c.chunk.title || 'Catatan Tanpa Judul'))
      );

      const memoryAwarenessBrief = ragMode === 'smart'
        ? `[MEMORY AWARENESS BRIEF]
- Memory Confidence: ${confidenceLevel.toUpperCase()} (Composite Score: ${Math.round(confidenceResult.compositeScore * 100)}%, Highest Score: ${Math.round(confidenceResult.highestScore * 100)}%)
- Reasoning Style: ${reasoningStyle}
- Memory Depth: ${memoryDepth}
- Retrieved Chunks: ${candidateChunks.length} chunk(s) dari ${uniqueNoteTitles.length} catatan
- Kategori Terlibat: ${confidenceResult.categories.map((c) => c.toUpperCase()).join(', ')}
- Ringkasan Catatan Terkait:
${uniqueNoteTitles.slice(0, 5).map((t, i) => `  ${i + 1}. "${t}"`).join('\n')}`
        : '';

      const augmentedMessage = ragMode === 'smart'
        ? `SYSTEM MANDATE (SMART MODE - THINKING WITH VAULT):
"Kamu bukan mesin pencari catatan.
Kamu adalah AI partner yang berpikir bersama Vault pengguna.
Gunakan Vault sebagai konteks utama.
Pahami hubungan antar catatan.
Temukan pola.
Lakukan reasoning sesuai tujuan pengguna.
Gunakan pengetahuan umum untuk memperjelas, memperluas, membandingkan, mengkritik, atau mengembangkan jawaban.
Jangan menggantikan isi Vault jika Vault sudah memiliki konteks yang relevan."

${memoryAwarenessBrief}

${styleInstruction}

${confidenceGuidance}

[KONTEKS DARI VAULT CATATAN PENGGUNA]
Berikut adalah catatan/informasi dari Vault pengguna yang digunakan sebagai acuan berpikir utama:

${contextText}

---
[PESAN PENGGUNA]
${message}`
        : `[KONTEKS DARI VAULT CATATAN PENGGUNA]
Berikut adalah catatan/informasi dari Vault pengguna:

${contextText}

---
[PESAN PENGGUNA]
${message}

Instruksi Mode ON (Vault-Focused):
1. Jawablah pertanyaan pengguna secara presisi berdasarkan catatan pengguna di Vault di atas.
2. Fokus pada informasi yang ada di dalam catatan tersebut.`;

      onStatus?.('✍️ Menyusun jawaban...');
      const fullText = await sendMessageStream(augmentedMessage, history, onChunk, handleMeta);
      const processingTime = Math.round(performance.now() - startTime);

      const retrievedContexts = candidateChunks.map((c) => ({
        chunkId: c.chunk.id,
        noteId: String(c.chunk.noteId),
        title: c.chunk.title || 'Catatan Tanpa Judul',
        noteTitle: c.chunk.title || 'Catatan Tanpa Judul',
        category: c.chunk.category || 'self',
        type: c.chunk.type || 'unknown',
        tags: c.chunk.tags || [],
        score: c.score,
        snippet: c.chunk.content,
      }));

      const ragStatus: RAGStatusMetadata = ragMode === 'smart' ? {
        mode: 'smart',
        usedVault: true,
        intent: classification?.intent,
        reasoningStyle,
        memoryDepth,
        confidenceLevel,
        compositeScore: confidenceResult.compositeScore,
        searchMethod: 'hybrid',
        category: classification?.category || 'all',
        typeFilter: 'all',
        tags: 'all',
        topK: candidateChunks.length,
        sourcesCount: uniqueNoteTitles.length,
        chunksRetrieved: candidateChunks.length,
        chunksUsed: candidateChunks.length,
        highestScore: confidenceResult.highestScore,
        processingTime,
      } : {
        mode: 'on',
        usedVault: true,
        searchMethod,
        category: categoryFilter,
        typeFilter: typeFilter,
        tags: tagFilter,
        topK,
        sourcesCount: uniqueNoteTitles.length,
        chunksRetrieved: candidateChunks.length,
        chunksUsed: candidateChunks.length,
        highestScore: confidenceResult.highestScore,
        processingTime,
      };

      return {
        fullText,
        wasRetrievalUsed: true,
        modelMeta: capturedMeta,
        retrievedContexts,
        ragStatus,
      };
    } else {
      // Direct call to Gemini (No Vault chunks, or Low Confidence < 40%, or smalltalk)
      onStatus?.('✍️ Menyusun jawaban...');

      let promptToSend = message;

      if (ragMode === 'smart') {
        const styleInstruction = getReasoningStyleInstruction(reasoningStyle);

        if (candidateChunks.length > 0 && confidenceResult.highestScore < 0.40) {
          // Evaluated but confidence low (<40%) -> Ignore Vault notes explicitly
          promptToSend = `SYSTEM MANDATE (SMART MODE - THINKING WITH VAULT):
"Kamu bukan mesin pencari catatan.
Kamu adalah AI partner yang berpikir bersama Vault pengguna.
Gunakan Vault sebagai konteks utama jika relevan, namun jika catatan yang ditemukan kurang relevan, gunakan pengetahuan umum secara mandiri."

${styleInstruction}

[EVALUASI RELEVANSI VAULT: RENDAH (Composite Score ${Math.round(confidenceResult.compositeScore * 100)}%, Highest ${Math.round(confidenceResult.highestScore * 100)}% < 40%)]
Sistem telah memeriksa Vault pengguna namun tingkat relevansi catatan yang ditemukan kurang memadai (<40%).
Abaikan catatan Vault tersebut dan jangan memaksa merujuk ke catatan yang tidak relevan.
Jawablah pertanyaan pengguna secara komprehensif, bijak, dan berwawasan mendalam menggunakan pengetahuan umum AI.

---
[PESAN PENGGUNA]
${message}`;
        } else if (classification?.needRAG) {
          // Vault check yielded no chunks
          promptToSend = `SYSTEM MANDATE (SMART MODE - THINKING WITH VAULT):
"Kamu bukan mesin pencari catatan.
Kamu adalah AI partner yang berpikir bersama Vault pengguna."

${styleInstruction}

Instruksi Smart Mode (Thinking with Vault - Fallback Pengetahuan Umum):
Sistem telah memeriksa Vault pengguna namun tidak menemukan catatan khusus yang relevan untuk pertanyaan ini.
Jawablah pertanyaan pengguna secara komprehensif, bijak, dan berwawasan mendalam menggunakan pengetahuan umum AI. Jika pengguna meminta analisis, kritik, perbandingan, atau pengembangan ide, berikan analisis mendalam terbaikmu.

---
[PESAN PENGGUNA]
${message}`;
        }
      }

      const fullText = await sendMessageStream(promptToSend, history, onChunk, handleMeta);
      const processingTime = Math.round(performance.now() - startTime);

      const ragStatus: RAGStatusMetadata = ragMode === 'smart' ? {
        mode: 'smart',
        usedVault: false,
        intent: classification?.intent,
        reasoningStyle,
        memoryDepth,
        confidenceLevel: candidateChunks.length > 0 ? 'low' : undefined,
        compositeScore: confidenceResult.compositeScore,
        searchMethod: 'hybrid',
        category: classification?.category || 'all',
        typeFilter: 'all',
        tags: 'all',
        topK: 5,
        sourcesCount: 0,
        chunksRetrieved: candidateChunks.length,
        chunksUsed: 0,
        highestScore: candidateChunks.length > 0 ? confidenceResult.highestScore : 0,
        processingTime,
      } : {
        mode: 'on',
        usedVault: false,
        searchMethod,
        category: categoryFilter,
        typeFilter: typeFilter,
        tags: tagFilter,
        topK,
        sourcesCount: 0,
        chunksRetrieved: 0,
        chunksUsed: 0,
        processingTime,
      };

      return {
        fullText,
        wasRetrievalUsed: false,
        modelMeta: capturedMeta,
        ragStatus,
      };
    }
  }
}

export const ragRouter = new RAGRouter();

