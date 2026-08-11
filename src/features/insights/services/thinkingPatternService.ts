import {
  ThinkingPattern,
  ThinkingPatternHistoryRecord,
  ThinkingPatternMetaRecord,
} from '../types/thinkingPattern';
import {
  initNoesisDB,
  THINKING_PATTERNS_STORE_NAME,
  THINKING_PATTERN_HISTORY_STORE_NAME,
  getAllEmbeddings,
  getAllPatternEmbeddings,
  savePatternEmbedding,
} from '../../../core/database/indexedDb';
import { NoteItem } from '../../vault/pages/VaultPage';
import { embeddingService } from '../../../core/rag/embedding';

const META_KEY = 'thinking_pattern_meta';

/**
 * Retrieve saved Thinking Patterns (excluding meta record)
 */
export const getSavedThinkingPatterns = async (): Promise<ThinkingPattern[]> => {
  try {
    const db = await initNoesisDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(THINKING_PATTERNS_STORE_NAME, 'readonly');
      const store = tx.objectStore(THINKING_PATTERNS_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        // Filter out meta record
        const patterns: ThinkingPattern[] = results.filter(
          (item: any) => item.id !== META_KEY && item.title
        );
        patterns.sort((a, b) => b.createdAt - a.createdAt);
        resolve(patterns);
      };

      request.onerror = () => {
        console.error('Failed to retrieve thinking patterns from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  } catch (err) {
    console.error('Error in getSavedThinkingPatterns:', err);
    return [];
  }
};

/**
 * Retrieve Thinking Pattern History records from IndexedDB
 */
export const getThinkingPatternHistory = async (): Promise<ThinkingPatternHistoryRecord[]> => {
  try {
    const db = await initNoesisDB();
    if (!db.objectStoreNames.contains(THINKING_PATTERN_HISTORY_STORE_NAME)) {
      return [];
    }
    return new Promise((resolve) => {
      const tx = db.transaction(THINKING_PATTERN_HISTORY_STORE_NAME, 'readonly');
      const store = tx.objectStore(THINKING_PATTERN_HISTORY_STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const results = (req.result || []) as ThinkingPatternHistoryRecord[];
        results.sort((a, b) => b.archivedAt - a.archivedAt);
        resolve(results);
      };

      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.error('Error in getThinkingPatternHistory:', err);
    return [];
  }
};

/**
 * Helper to generate change summary and changeType for pattern evolution tracking
 */
function generateChangeSummary(
  oldP: ThinkingPattern,
  newP?: ThinkingPattern
): { changeType: 'NEW_PATTERN' | 'UPDATED_PATTERN' | 'MERGED_PATTERN'; changeSummary: string } {
  if (!newP) {
    return {
      changeType: 'MERGED_PATTERN',
      changeSummary: 'Pola lama diarsipkan atau digabungkan ke dalam pola lain pada iterasi ini.',
    };
  }

  const oldNotes = new Set(oldP.relatedNoteIds || []);
  const newNotes = new Set(newP.relatedNoteIds || []);

  const added = [...newNotes].filter((id) => !oldNotes.has(id));
  const removed = [...oldNotes].filter((id) => !newNotes.has(id));
  const evidenceDiff = newP.evidenceCount - oldP.evidenceCount;

  const parts: string[] = [];

  if (oldP.title !== newP.title) {
    parts.push(`Judul diperbarui: "${oldP.title}" -> "${newP.title}"`);
  }

  if (added.length > 0 || removed.length > 0) {
    parts.push(`Perubahan catatan bukti: +${added.length} baru, -${removed.length} dilepas`);
  }

  if (evidenceDiff !== 0) {
    parts.push(`Jumlah bukti ${evidenceDiff > 0 ? '+' : ''}${evidenceDiff} (total ${newP.evidenceCount})`);
  }

  if (oldP.reasoning !== newP.reasoning) {
    parts.push('Penalaran AI diperdalam dengan konteks pengetahuan terkini');
  }

  if (parts.length === 0) {
    parts.push('Pola dikonfirmasi ulang tanpa perubahan materiil');
  }

  return {
    changeType: 'UPDATED_PATTERN',
    changeSummary: parts.join('. ') + '.',
  };
}

/**
 * Archive old patterns to thinkingPatternHistory before replacing
 * Includes Change Tracking & Relationships
 */
export const saveThinkingPatternHistory = async (history: ThinkingPatternHistoryRecord[]): Promise<void> => {
  const db = await initNoesisDB();
  if (!db.objectStoreNames.contains(THINKING_PATTERN_HISTORY_STORE_NAME)) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(THINKING_PATTERN_HISTORY_STORE_NAME, 'readwrite');
    const store = tx.objectStore(THINKING_PATTERN_HISTORY_STORE_NAME);
    const clearReq = store.clear();
    clearReq.onsuccess = () => {
      if (!history || history.length === 0) {
        resolve();
        return;
      }
      let remaining = history.length;
      for (const record of history) {
        const req = store.put(record);
        req.onsuccess = () => {
          remaining--;
          if (remaining === 0) resolve();
        };
        req.onerror = () => reject(req.error);
      }
    };
    clearReq.onerror = () => reject(clearReq.error);
  });
};

export const archiveCurrentPatterns = async (
  oldPatterns: ThinkingPattern[],
  analysisVersion: number = 1,
  newPatterns?: ThinkingPattern[]
): Promise<void> => {
  if (!oldPatterns || oldPatterns.length === 0) return;
  try {
    const db = await initNoesisDB();
    if (!db.objectStoreNames.contains(THINKING_PATTERN_HISTORY_STORE_NAME)) return;

    const newPatternsMap = new Map<string, ThinkingPattern>();
    if (newPatterns) {
      for (const p of newPatterns) {
        newPatternsMap.set(p.id, p);
      }
    }

    const now = Date.now();
    const historyRecords: ThinkingPatternHistoryRecord[] = oldPatterns.map((oldP) => {
      const newP = newPatternsMap.get(oldP.id);
      const { changeType, changeSummary } = generateChangeSummary(oldP, newP);

      return {
        id: `hist_${now}_${oldP.id}`,
        patternId: oldP.id,
        title: oldP.title,
        description: oldP.description,
        reasoning: oldP.reasoning,
        relatedNoteIds: oldP.relatedNoteIds || [],
        evidenceCount: oldP.evidenceCount || (oldP.relatedNoteIds ? oldP.relatedNoteIds.length : 0),
        createdAt: oldP.createdAt || now,
        archivedAt: now,
        analysisVersion,
        changeType,
        previousPatternId: oldP.id,
        changeSummary,
      };
    });

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(THINKING_PATTERN_HISTORY_STORE_NAME, 'readwrite');
      const store = tx.objectStore(THINKING_PATTERN_HISTORY_STORE_NAME);

      let remaining = historyRecords.length;
      for (const record of historyRecords) {
        const req = store.put(record);
        req.onsuccess = () => {
          remaining--;
          if (remaining === 0) resolve();
        };
        req.onerror = () => reject(req.error);
      }
    });
  } catch (err) {
    console.error('Error archiving thinking patterns to history:', err);
  }
};

/**
 * Retrieve Thinking Pattern Analysis Metadata
 */
export const getThinkingPatternMeta = async (): Promise<ThinkingPatternMetaRecord | null> => {
  try {
    const db = await initNoesisDB();
    return new Promise((resolve) => {
      const tx = db.transaction(THINKING_PATTERNS_STORE_NAME, 'readonly');
      const store = tx.objectStore(THINKING_PATTERNS_STORE_NAME);
      const request = store.get(META_KEY);

      request.onsuccess = () => {
        resolve((request.result as ThinkingPatternMetaRecord) || null);
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    console.error('Error retrieving Thinking Pattern meta:', err);
    return null;
  }
};

/**
 * Save Thinking Pattern Analysis Metadata
 */
export const saveThinkingPatternMeta = async (meta: ThinkingPatternMetaRecord): Promise<void> => {
  try {
    const db = await initNoesisDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(THINKING_PATTERNS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(THINKING_PATTERNS_STORE_NAME);
      const req = store.put(meta);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Error saving Thinking Pattern meta:', err);
  }
};

/**
 * Save / replace Thinking Patterns in IndexedDB (preserving meta record)
 */
export const saveThinkingPatterns = async (patterns: ThinkingPattern[]): Promise<void> => {
  try {
    const db = await initNoesisDB();
    const existingMeta = await getThinkingPatternMeta();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(THINKING_PATTERNS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(THINKING_PATTERNS_STORE_NAME);

      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        const itemsToPut = [...patterns];
        if (existingMeta) {
          itemsToPut.push(existingMeta as any);
        }

        if (itemsToPut.length === 0) {
          resolve();
          return;
        }

        let remaining = itemsToPut.length;
        for (const item of itemsToPut) {
          const putReq = store.put(item);
          putReq.onsuccess = () => {
            remaining--;
            if (remaining === 0) resolve();
          };
          putReq.onerror = () => reject(putReq.error);
        }
      };
      clearReq.onerror = () => reject(clearReq.error);
    });
  } catch (err) {
    console.error('Error in saveThinkingPatterns:', err);
    throw err;
  }
};

/**
 * Incremental check: Determine if re-analysis is required based on note changes
 */
export const checkNeedsReanalysis = async (
  notes: NoteItem[]
): Promise<{ needsAnalysis: boolean; reason: string }> => {
  if (!notes || notes.length === 0) {
    return { needsAnalysis: false, reason: 'Tidak ada catatan.' };
  }

  const existingPatterns = await getSavedThinkingPatterns();
  if (existingPatterns.length === 0) {
    return { needsAnalysis: true, reason: 'Belum ada analisis pola sebelumnya.' };
  }

  const meta = await getThinkingPatternMeta();
  if (!meta) {
    return { needsAnalysis: true, reason: 'Metadata analisis sebelumnya tidak ditemukan.' };
  }

  // 1. Check note count
  if (notes.length !== meta.analyzedNoteCount) {
    return {
      needsAnalysis: true,
      reason: `Jumlah catatan telah berubah (${meta.analyzedNoteCount} -> ${notes.length}).`,
    };
  }

  // 2. Check note IDs set
  const currentIds = new Set(notes.map((n) => n.id));
  const previousIds = new Set(meta.analyzedNoteIds || []);
  for (const id of currentIds) {
    if (!previousIds.has(id)) {
      return { needsAnalysis: true, reason: 'Terdapat catatan baru dalam Vault.' };
    }
  }

  // 3. Check modification timestamp
  const getTimestamp = (val: any): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const parsed = Date.parse(val);
    return isNaN(parsed) ? 0 : parsed;
  };

  const latestNoteMod = Math.max(
    ...notes.map((n) => Math.max(getTimestamp(n.updatedAt), getTimestamp(n.createdAt), 0)),
    0
  );
  if (latestNoteMod > meta.lastAnalyzedAt) {
    return { needsAnalysis: true, reason: 'Terdapat catatan yang baru saja diperbarui.' };
  }

  return { needsAnalysis: false, reason: 'Catatan tidak berubah sejak analisis terakhir.' };
};

/**
 * Compute Cosine Similarity between two numerical vectors
 */
function computeCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Optimization & Validation Constants for Engine Discovery
const LARGE_DATASET_THRESHOLD = 30; // Datasets > 30 notes use Top-K comparison & adaptive payload context
const TOP_K_NEIGHBORS = 8; // Top-K most similar neighbors per note in large datasets
const MIN_CONNECTION_SIMILARITY = 0.38; // Strict threshold for semantic connections
const MIN_CLUSTER_EDGE_SIMILARITY = 0.45; // Similarity required for cluster formation
const MIN_INTRA_CLUSTER_SIMILARITY = 0.40; // Cohesion threshold to prevent weak chaining
const MIN_CLUSTER_AVG_SIMILARITY = 0.42; // Minimum average similarity for a valid cluster
const MAX_CLUSTER_SIZE = 6; // Cap cluster size to prevent oversized clusters
const MAX_CONTEXT_REPRESENTATIVE_NOTES = 30; // Max representative note snippets sent in context payload
const MAX_TOTAL_SNIPPET_CHARS = 10000; // Max total character budget for note content in prompt

function getStrengthLabel(sim: number): 'Sangat Kuat' | 'Kuat' | 'Moderat' {
  if (sim >= 0.70) return 'Sangat Kuat';
  if (sim >= 0.55) return 'Kuat';
  return 'Moderat';
}

function calculateIntraClusterCohesion(
  noteIds: string[],
  vectorMap: Map<string, number[]>
): number {
  if (noteIds.length < 2) return 1.0;
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < noteIds.length; i++) {
    for (let j = i + 1; j < noteIds.length; j++) {
      const vecA = vectorMap.get(noteIds[i]);
      const vecB = vectorMap.get(noteIds[j]);
      if (vecA && vecB) {
        sum += computeCosineSimilarity(vecA, vecB);
        pairs++;
      }
    }
  }
  return pairs > 0 ? sum / pairs : 0;
}

export interface SemanticCluster {
  clusterId: string;
  noteIds: string[];
  noteTitles?: string[];
  avgSimilarity: number;
}

export interface SemanticConnection {
  sourceNoteId: string;
  targetNoteId: string;
  sourceTitle: string;
  targetTitle: string;
  similarityScore: number;
  strengthLabel: 'Sangat Kuat' | 'Kuat' | 'Moderat';
}

export interface OrganicKnowledgeContext {
  sanitizedNotes: {
    id: string;
    title: string;
    content: string;
    category: string;
    type: string;
    tags: string[];
    isRepresentative?: boolean;
  }[];
  clusters: SemanticCluster[];
  connections: SemanticConnection[];
  metaInfo?: {
    totalNotes: number;
    selectedNoteCount: number;
    comparisonStrategy: 'full' | 'top_k';
    similarityThreshold: number;
    maxClusterSize: number;
    isCompressed: boolean;
  };
}

/**
 * Organic Knowledge Context Preparation based on Semantic Similarity & Cohesive Clustering
 * Includes Adaptive Context Payload Selection & Payload Compression for large datasets
 */
export const prepareOrganicKnowledgeContext = async (
  notes: NoteItem[]
): Promise<OrganicKnowledgeContext> => {
  if (!notes || notes.length < 2) {
    throw new Error('Data tidak cukup. Diperlukan minimal 2 catatan di Vault untuk menganalisis pola pemikiran.');
  }

  const rawTitleMap = new Map<string, string>(notes.map((n) => [n.id, n.title || 'Catatan Tanpa Judul']));

  // Fetch or calculate embeddings for each note
  const noteVectorMap = new Map<string, number[]>();

  try {
    const storedEmbeddings = await getAllEmbeddings().catch(() => []);
    if (storedEmbeddings && storedEmbeddings.length > 0) {
      const chunkGroup = new Map<string, number[][]>();
      for (const emb of storedEmbeddings) {
        if (emb && emb.noteId && Array.isArray(emb.vector) && emb.vector.length > 0) {
          if (!chunkGroup.has(emb.noteId)) chunkGroup.set(emb.noteId, []);
          chunkGroup.get(emb.noteId)!.push(emb.vector);
        }
      }

      for (const [noteId, vectors] of chunkGroup.entries()) {
        if (vectors.length > 0) {
          const dim = vectors[0].length;
          const meanVec = new Array(dim).fill(0);
          for (const v of vectors) {
            for (let i = 0; i < dim; i++) {
              meanVec[i] += v[i];
            }
          }
          for (let i = 0; i < dim; i++) {
            meanVec[i] /= vectors.length;
          }
          noteVectorMap.set(noteId, meanVec);
        }
      }
    }
  } catch (e) {
    console.warn('[ThinkingPattern] Error reading IndexedDB embeddings:', e);
  }

  // Generate vectors for missing notes
  const missingNotes = notes.filter((n) => !noteVectorMap.has(n.id));
  if (missingNotes.length > 0) {
    const textsToEmbed = missingNotes.map(
      (n) => `${n.title || ''}\n${n.category || ''}\n${(n.content || '').slice(0, 500)}`
    );
    try {
      const generatedVectors = await embeddingService.getBatchEmbeddings(textsToEmbed);
      missingNotes.forEach((n, idx) => {
        if (generatedVectors[idx] && generatedVectors[idx].length > 0) {
          noteVectorMap.set(n.id, generatedVectors[idx]);
        }
      });
    } catch (e) {
      console.warn('[ThinkingPattern] Error batch generating embeddings for missing notes:', e);
    }
  }

  // Scalability-Aware Similarity Calculation
  const connectionMap = new Map<string, SemanticConnection>();
  const isLargeDataset = notes.length > LARGE_DATASET_THRESHOLD;

  if (!isLargeDataset) {
    // Strategy A: Full pairwise comparison O(N^2)
    for (let i = 0; i < notes.length; i++) {
      const noteA = notes[i];
      const vecA = noteVectorMap.get(noteA.id);
      if (!vecA) continue;

      for (let j = i + 1; j < notes.length; j++) {
        const noteB = notes[j];
        const vecB = noteVectorMap.get(noteB.id);
        if (!vecB) continue;

        const sim = computeCosineSimilarity(vecA, vecB);
        if (sim >= MIN_CONNECTION_SIMILARITY) {
          const key = [noteA.id, noteB.id].sort().join(':::');
          connectionMap.set(key, {
            sourceNoteId: noteA.id,
            targetNoteId: noteB.id,
            sourceTitle: noteA.title || 'Catatan Tanpa Judul',
            targetTitle: noteB.title || 'Catatan Tanpa Judul',
            similarityScore: Number(sim.toFixed(3)),
            strengthLabel: getStrengthLabel(sim),
          });
        }
      }
    }
  } else {
    // Strategy B: Scalable Top-K Nearest Similarity O(N * K)
    for (let i = 0; i < notes.length; i++) {
      const noteA = notes[i];
      const vecA = noteVectorMap.get(noteA.id);
      if (!vecA) continue;

      const candidates: { noteB: typeof noteA; sim: number }[] = [];

      for (let j = 0; j < notes.length; j++) {
        if (i === j) continue;
        const noteB = notes[j];
        const vecB = noteVectorMap.get(noteB.id);
        if (!vecB) continue;

        const sim = computeCosineSimilarity(vecA, vecB);
        if (sim >= MIN_CONNECTION_SIMILARITY) {
          candidates.push({ noteB, sim });
        }
      }

      candidates.sort((a, b) => b.sim - a.sim);
      const topK = candidates.slice(0, TOP_K_NEIGHBORS);

      for (const item of topK) {
        const key = [noteA.id, item.noteB.id].sort().join(':::');
        if (!connectionMap.has(key)) {
          connectionMap.set(key, {
            sourceNoteId: noteA.id,
            targetNoteId: item.noteB.id,
            sourceTitle: noteA.title || 'Catatan Tanpa Judul',
            targetTitle: item.noteB.title || 'Catatan Tanpa Judul',
            similarityScore: Number(item.sim.toFixed(3)),
            strengthLabel: getStrengthLabel(item.sim),
          });
        }
      }
    }
  }

  const connections = Array.from(connectionMap.values());
  connections.sort((a, b) => b.similarityScore - a.similarityScore);

  // Cohesive Semantic Graph Clustering
  const candidateEdges = connections.filter((c) => c.similarityScore >= MIN_CLUSTER_EDGE_SIMILARITY);
  const clusters: SemanticCluster[] = [];
  let clusterIdx = 1;

  for (const edge of candidateEdges) {
    const { sourceNoteId, targetNoteId } = edge;

    const sourceCluster = clusters.find((c) => c.noteIds.includes(sourceNoteId));
    const targetCluster = clusters.find((c) => c.noteIds.includes(targetNoteId));

    if (!sourceCluster && !targetCluster) {
      const vecA = noteVectorMap.get(sourceNoteId);
      const vecB = noteVectorMap.get(targetNoteId);
      if (vecA && vecB) {
        const pairSim = computeCosineSimilarity(vecA, vecB);
        if (pairSim >= MIN_CLUSTER_EDGE_SIMILARITY) {
          clusters.push({
            clusterId: `cluster_${clusterIdx++}`,
            noteIds: [sourceNoteId, targetNoteId],
            avgSimilarity: Number(pairSim.toFixed(3)),
          });
        }
      }
    } else if (sourceCluster && !targetCluster) {
      tryAddToCluster(sourceCluster, targetNoteId, noteVectorMap);
    } else if (!sourceCluster && targetCluster) {
      tryAddToCluster(targetCluster, sourceNoteId, noteVectorMap);
    } else if (sourceCluster && targetCluster && sourceCluster !== targetCluster) {
      if (sourceCluster.noteIds.length + targetCluster.noteIds.length <= MAX_CLUSTER_SIZE) {
        const mergedIds = Array.from(new Set([...sourceCluster.noteIds, ...targetCluster.noteIds]));
        const cohesion = calculateIntraClusterCohesion(mergedIds, noteVectorMap);
        if (cohesion >= MIN_INTRA_CLUSTER_SIMILARITY) {
          sourceCluster.noteIds = mergedIds;
          sourceCluster.avgSimilarity = Number(cohesion.toFixed(3));
          const idx = clusters.indexOf(targetCluster);
          if (idx !== -1) clusters.splice(idx, 1);
        }
      }
    }
  }

  function tryAddToCluster(
    cluster: SemanticCluster,
    candidateId: string,
    vectorMap: Map<string, number[]>
  ) {
    if (cluster.noteIds.length >= MAX_CLUSTER_SIZE) return;
    const candidateVec = vectorMap.get(candidateId);
    if (!candidateVec) return;

    let simSum = 0;
    for (const memberId of cluster.noteIds) {
      const memberVec = vectorMap.get(memberId);
      if (memberVec) {
        simSum += computeCosineSimilarity(candidateVec, memberVec);
      }
    }
    const avgToCluster = simSum / cluster.noteIds.length;

    if (avgToCluster >= MIN_INTRA_CLUSTER_SIMILARITY) {
      cluster.noteIds.push(candidateId);
      const newCohesion = calculateIntraClusterCohesion(cluster.noteIds, vectorMap);
      cluster.avgSimilarity = Number(newCohesion.toFixed(3));
    }
  }

  const validClusters = clusters
    .filter((c) => c.noteIds.length >= 2 && c.avgSimilarity >= MIN_CLUSTER_AVG_SIMILARITY)
    .map((c) => ({
      ...c,
      noteTitles: c.noteIds.map((id) => rawTitleMap.get(id) || 'Tanpa Judul'),
    }));

  if (connections.length === 0 && validClusters.length === 0 && notes.length > 3) {
    throw new Error('Tidak cukup keterkaitan semantik antar catatan untuk mengekstrak pola pemikiran.');
  }

  // -------------------------------------------------------------
  // ADAPTIVE CONTEXT SELECTION & COMPRESSION FOR AI PAYLOAD
  // -------------------------------------------------------------
  // 1. Identify priority notes (members of clusters or top connections)
  const priorityNoteScores = new Map<string, number>();

  for (const c of validClusters) {
    for (const id of c.noteIds) {
      priorityNoteScores.set(id, (priorityNoteScores.get(id) || 0) + 10);
    }
  }

  for (const conn of connections) {
    priorityNoteScores.set(conn.sourceNoteId, (priorityNoteScores.get(conn.sourceNoteId) || 0) + 5);
    priorityNoteScores.set(conn.targetNoteId, (priorityNoteScores.get(conn.targetNoteId) || 0) + 5);
  }

  // Rank notes by priority score
  const rankedNotes = [...notes].sort((a, b) => {
    const scoreA = priorityNoteScores.get(a.id) || 0;
    const scoreB = priorityNoteScores.get(b.id) || 0;
    return scoreB - scoreA;
  });

  // Select top representative notes
  const selectedCount = isLargeDataset
    ? Math.min(MAX_CONTEXT_REPRESENTATIVE_NOTES, rankedNotes.length)
    : rankedNotes.length;

  const selectedIds = new Set(rankedNotes.slice(0, selectedCount).map((n) => n.id));

  // Determine character truncation budget per note based on dataset size
  const charBudgetPerNote = isLargeDataset ? 350 : 600;

  let totalChars = 0;
  const sanitizedNotes = notes
    .filter((note) => selectedIds.has(note.id))
    .map((note) => {
      let snippet = note.content || '';
      if (snippet.length > charBudgetPerNote) {
        snippet = snippet.slice(0, charBudgetPerNote) + '...';
      }
      totalChars += snippet.length;

      return {
        id: note.id,
        title: note.title || 'Catatan Tanpa Judul',
        content: snippet,
        category: note.category || 'general',
        type: note.type || 'note',
        tags: Array.isArray(note.tags) ? note.tags : [],
        isRepresentative: true,
      };
    });

  // Second pass: Ensure total snippet chars stay strictly within MAX_TOTAL_SNIPPET_CHARS
  if (totalChars > MAX_TOTAL_SNIPPET_CHARS && sanitizedNotes.length > 0) {
    const perNoteCap = Math.floor(MAX_TOTAL_SNIPPET_CHARS / sanitizedNotes.length);
    for (const item of sanitizedNotes) {
      if (item.content.length > perNoteCap) {
        item.content = item.content.slice(0, perNoteCap) + '...';
      }
    }
  }

  return {
    sanitizedNotes,
    clusters: validClusters,
    connections: connections.slice(0, 20),
    metaInfo: {
      totalNotes: notes.length,
      selectedNoteCount: sanitizedNotes.length,
      comparisonStrategy: isLargeDataset ? 'top_k' : 'full',
      similarityThreshold: MIN_CONNECTION_SIMILARITY,
      maxClusterSize: MAX_CLUSTER_SIZE,
      isCompressed: isLargeDataset,
    },
  };
};

/**
 * Pattern Identity Matching Helper: Compare raw new pattern against existing active patterns
 * Uses Semantic Vector Similarity as primary matcher + Jaccard token/note similarity as secondary
 */
function findMatchingExistingPattern(
  rawP: any,
  rawEmbedding: number[],
  existingPatterns: ThinkingPattern[],
  existingEmbeddingsMap: Map<string, number[]>
): ThinkingPattern | null {
  if (!existingPatterns || existingPatterns.length === 0) return null;

  const rawTitle = (rawP.title || '').toLowerCase().trim();
  const rawDesc = (rawP.description || '').toLowerCase().trim();
  const rawRelatedIds = new Set<string>(
    Array.isArray(rawP.relatedNoteIds) ? rawP.relatedNoteIds : []
  );

  let bestMatch: ThinkingPattern | null = null;
  let maxScore = 0;

  const tokenize = (str: string) =>
    new Set(str.match(/\w+/g)?.filter((w) => w.length > 2) || []);

  const tokensRaw = tokenize(`${rawTitle} ${rawDesc}`);

  for (const existing of existingPatterns) {
    const exTitle = (existing.title || '').toLowerCase().trim();
    const exDesc = (existing.description || '').toLowerCase().trim();
    const exRelatedIds = new Set<string>(existing.relatedNoteIds || []);

    // 1. Semantic Embedding Cosine Similarity
    let semanticSim = 0;
    const existingVec = existingEmbeddingsMap.get(existing.id);
    if (rawEmbedding && rawEmbedding.length > 0 && existingVec && existingVec.length > 0) {
      semanticSim = computeCosineSimilarity(rawEmbedding, existingVec);
    }

    // 2. Token Jaccard Similarity
    const tokensEx = tokenize(`${exTitle} ${exDesc}`);
    let textIntersect = 0;
    for (const t of tokensRaw) {
      if (tokensEx.has(t)) textIntersect++;
    }
    const textUnion = new Set([...tokensRaw, ...tokensEx]).size;
    const textSim = textUnion > 0 ? textIntersect / textUnion : 0;

    // 3. Related Note Overlap Similarity
    let noteIntersect = 0;
    for (const id of rawRelatedIds) {
      if (exRelatedIds.has(id)) noteIntersect++;
    }
    const noteUnion = new Set([...rawRelatedIds, ...exRelatedIds]).size;
    const noteSim = noteUnion > 0 ? noteIntersect / noteUnion : 0;

    // Combined Score calculation:
    // When semantic vector similarity is present, weigh it heavily (70%), text (15%), note overlap (15%)
    let combinedScore = 0;
    if (semanticSim > 0) {
      combinedScore = 0.70 * semanticSim + 0.15 * textSim + 0.15 * noteSim;
    } else {
      combinedScore = 0.50 * textSim + 0.50 * noteSim;
    }

    const titleExact =
      rawTitle === exTitle ||
      (rawTitle.length > 5 && (rawTitle.includes(exTitle) || exTitle.includes(rawTitle)));

    if (titleExact) combinedScore = Math.max(combinedScore, 0.75);

    // Matching condition: combinedScore >= 0.52 OR semanticSim >= 0.65
    if (combinedScore > maxScore && (combinedScore >= 0.52 || semanticSim >= 0.65)) {
      maxScore = combinedScore;
      bestMatch = existing;
    }
  }

  return bestMatch;
}

/**
 * Calculate Evidence Metrics: evidenceCount, relatedTopicCount, evidenceStrength
 */
function computeEvidenceMetrics(
  relatedNoteIds: string[],
  notesMap: Map<string, NoteItem>,
  clusters: SemanticCluster[],
  connections: SemanticConnection[]
): {
  evidenceCount: number;
  relatedTopicCount: number;
  evidenceStrength: 'Strong' | 'Moderate' | 'Weak';
} {
  const noteSet = new Set(relatedNoteIds);
  const evidenceCount = noteSet.size;

  const topicSet = new Set<string>();
  for (const id of relatedNoteIds) {
    const n = notesMap.get(id);
    if (n) {
      if (n.category) topicSet.add(n.category.toLowerCase());
      if (Array.isArray(n.tags)) {
        n.tags.forEach((t) => topicSet.add(t.toLowerCase()));
      }
    }
  }
  const relatedTopicCount = topicSet.size;

  let maxClusterSim = 0;
  for (const c of clusters) {
    const intersect = c.noteIds.filter((id) => noteSet.has(id));
    if (intersect.length >= 2 && c.avgSimilarity > maxClusterSim) {
      maxClusterSim = c.avgSimilarity;
    }
  }

  let hasStrongConnection = false;
  for (const conn of connections) {
    if (noteSet.has(conn.sourceNoteId) && noteSet.has(conn.targetNoteId)) {
      if (conn.similarityScore >= 0.55) {
        hasStrongConnection = true;
        break;
      }
    }
  }

  let evidenceStrength: 'Strong' | 'Moderate' | 'Weak' = 'Weak';
  if (evidenceCount >= 4 || maxClusterSim >= 0.55 || hasStrongConnection) {
    evidenceStrength = 'Strong';
  } else if (evidenceCount >= 2 || maxClusterSim >= 0.40) {
    evidenceStrength = 'Moderate';
  }

  return { evidenceCount, relatedTopicCount, evidenceStrength };
}

/**
 * Pattern Validation Layer: Validate AI generated patterns before saving
 */
export function validateGeneratedPattern(
  pattern: {
    title?: string;
    description?: string;
    reasoning?: string;
    relatedNoteIds?: string[];
  },
  evidenceCount: number,
  validNoteIds: Set<string>,
  organicContext: OrganicKnowledgeContext
): { isValid: boolean; reason?: string } {
  // 1. All relatedNoteIds must exist in Vault
  const related = Array.isArray(pattern.relatedNoteIds) ? pattern.relatedNoteIds : [];
  if (related.length === 0) {
    return { isValid: false, reason: 'Tidak ada relatedNoteIds yang disertakan.' };
  }

  const invalidNotes = related.filter((id) => !validNoteIds.has(id));
  if (invalidNotes.length > 0) {
    return {
      isValid: false,
      reason: `Catatan terkait berikut tidak ditemukan di Vault: ${invalidNotes.join(', ')}`,
    };
  }

  // 2. Minimal ada 2 note sumber
  if (related.length < 2) {
    return {
      isValid: false,
      reason: `Pola memerlukan minimal 2 catatan sumber (ditemukan: ${related.length}).`,
    };
  }

  // 3. reasoning wajib tersedia
  if (!pattern.reasoning || pattern.reasoning.trim().length < 5) {
    return {
      isValid: false,
      reason: 'Penalaran (reasoning) pola tidak boleh kosong dan harus memiliki konten memadai.',
    };
  }

  // 4. Pattern harus memiliki evidence
  if (evidenceCount < 1) {
    return {
      isValid: false,
      reason: 'Pola tidak memiliki cukup bukti pendukung (evidenceCount < 1).',
    };
  }

  // 5. Hubungan semantic sumber harus memenuhi threshold
  const noteSet = new Set(related);
  let hasValidSemanticLink = false;

  for (const cluster of organicContext.clusters) {
    const intersect = cluster.noteIds.filter((id) => noteSet.has(id));
    if (intersect.length >= 2 && cluster.avgSimilarity >= MIN_CONNECTION_SIMILARITY) {
      hasValidSemanticLink = true;
      break;
    }
  }

  if (!hasValidSemanticLink) {
    for (const conn of organicContext.connections) {
      if (noteSet.has(conn.sourceNoteId) && noteSet.has(conn.targetNoteId)) {
        if (conn.similarityScore >= MIN_CONNECTION_SIMILARITY) {
          hasValidSemanticLink = true;
          break;
        }
      }
    }
  }

  if (!hasValidSemanticLink) {
    return {
      isValid: false,
      reason: 'Keterkaitan semantik antar catatan sumber tidak memenuhi threshold minimal (0.38).',
    };
  }

  return { isValid: true };
}

export interface GenerateThinkingPatternResult {
  patterns: ThinkingPattern[];
  fromCache: boolean;
  message?: string;
}

/**
 * Generate Thinking Patterns with Organic Knowledge Clustering, Adaptive Context Payload, Pattern History, Pattern Validation, and Identity Evolution
 */
export const generateThinkingPatterns = async (
  notes: NoteItem[],
  forceReanalyze: boolean = false
): Promise<GenerateThinkingPatternResult> => {
  if (!notes || notes.length < 2) {
    throw new Error('Vault Anda belum memiliki cukup catatan untuk dianalisis (minimal 2 catatan).');
  }

  // Retrieve existing patterns & meta
  const existingPatterns = await getSavedThinkingPatterns();
  const existingMeta = await getThinkingPatternMeta();

  // Incremental check unless forceReanalyze is requested
  if (!forceReanalyze) {
    const { needsAnalysis } = await checkNeedsReanalysis(notes);
    if (!needsAnalysis) {
      const cachedPatterns = await getSavedThinkingPatterns();
      if (cachedPatterns.length > 0) {
        if (existingMeta) {
          await saveThinkingPatternMeta({
            ...existingMeta,
            analysisMode: 'incremental',
          });
        }
        return {
          patterns: cachedPatterns,
          fromCache: true,
          message: 'Menggunakan hasil analisis terkini (incremental / tidak ada perubahan catatan).',
        };
      }
    }
  }

  const currentVersion = (existingMeta?.analysisVersion || 0) + 1;

  // Retrieve stored pattern embeddings for existing patterns
  const existingPatternEmbeddings = await getAllPatternEmbeddings().catch(() => []);
  const existingEmbeddingsMap = new Map<string, number[]>();
  for (const record of existingPatternEmbeddings) {
    if (record && record.patternId && Array.isArray(record.embedding) && record.embedding.length > 0) {
      existingEmbeddingsMap.set(record.patternId, record.embedding);
    }
  }

  // Ensure all existing active patterns have an embedding in memory / storage
  const missingExistingPatterns = existingPatterns.filter((p) => !existingEmbeddingsMap.has(p.id));
  if (missingExistingPatterns.length > 0) {
    const textsToEmbed = missingExistingPatterns.map(
      (p) => `${p.title || ''}\n${p.description || ''}\n${p.reasoning || ''}`
    );
    const vecs = await embeddingService.getBatchEmbeddings(textsToEmbed).catch(() => []);
    for (let i = 0; i < missingExistingPatterns.length; i++) {
      const p = missingExistingPatterns[i];
      if (vecs[i] && vecs[i].length > 0) {
        existingEmbeddingsMap.set(p.id, vecs[i]);
        await savePatternEmbedding(p.id, vecs[i]).catch(() => {});
      }
    }
  }

  // Prepare organic knowledge context payload with adaptive context selection & compression
  const organicContext = await prepareOrganicKnowledgeContext(notes);

  const response = await fetch('/api/thinking-pattern', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(organicContext),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Gagal menganalisis pola pemikiran (Status ${response.status})`);
  }

  const result = await response.json();
  const rawPatterns = Array.isArray(result.patterns) ? result.patterns : [];

  if (rawPatterns.length === 0) {
    throw new Error('AI tidak menemukan pola pemikiran yang memenuhi kriteria keterkaitan dari catatan.');
  }

  // Generate embeddings for newly generated raw AI patterns
  const rawPatternTexts = rawPatterns.map(
    (p: any) => `${p.title || ''}\n${p.description || ''}\n${p.reasoning || ''}`
  );
  const newPatternEmbeddings = await embeddingService.getBatchEmbeddings(rawPatternTexts).catch(() => []);

  const now = Date.now();
  const validNoteIds = new Set(notes.map((n) => n.id));
  const notesMap = new Map<string, NoteItem>(notes.map((n) => [n.id, n]));

  // Process raw AI patterns with Validation Layer & Semantic Pattern Identity Matching
  const formattedPatterns: ThinkingPattern[] = [];
  const invalidGenerations: { pattern: any; reason: string }[] = [];

  for (let idx = 0; idx < rawPatterns.length; idx++) {
    const p = rawPatterns[idx];
    const pEmbedding = newPatternEmbeddings[idx] || [];

    let related = Array.isArray(p.relatedNoteIds)
      ? p.relatedNoteIds.filter((id: string) => validNoteIds.has(id))
      : [];

    // Compute Evidence Metrics
    const { evidenceCount, relatedTopicCount, evidenceStrength } = computeEvidenceMetrics(
      related,
      notesMap,
      organicContext.clusters,
      organicContext.connections
    );

    // Pattern Validation Layer Check
    const validation = validateGeneratedPattern(p, evidenceCount, validNoteIds, organicContext);
    if (!validation.isValid) {
      console.warn(
        `[ThinkingPattern Validation Failed] Skipping pattern #${idx + 1}:`,
        validation.reason,
        p
      );
      invalidGenerations.push({
        pattern: p,
        reason: validation.reason || 'Validation error',
      });
      continue; // Do NOT save invalid generation
    }

    let conf = typeof p.confidence === 'number' ? p.confidence : 0.88;
    if (conf > 1) conf = conf / 100;
    if (conf < 0) conf = 0.5;

    // Semantic Pattern Identity Matching against previous active patterns
    const matchedExisting = findMatchingExistingPattern(
      p,
      pEmbedding,
      existingPatterns,
      existingEmbeddingsMap
    );

    let finalPattern: ThinkingPattern;

    if (matchedExisting) {
      // Evolve existing pattern identity
      finalPattern = {
        id: matchedExisting.id,
        title: p.title || matchedExisting.title,
        description: p.description || matchedExisting.description,
        reasoning: p.reasoning || matchedExisting.reasoning,
        relatedNoteIds: related,
        confidence: conf,
        evidenceCount,
        relatedTopicCount,
        evidenceStrength,
        firstDetectedAt: matchedExisting.firstDetectedAt || matchedExisting.createdAt || now,
        lastDetectedAt: now,
        occurrenceCount: (matchedExisting.occurrenceCount || 1) + 1,
        previousPatternId: matchedExisting.id,
        createdAt: now,
      };
    } else {
      // Create new pattern identity
      const newId = `pattern_${now}_${idx + 1}`;
      finalPattern = {
        id: newId,
        title: p.title || `Pola Pemikiran #${idx + 1}`,
        description: p.description || '',
        reasoning: p.reasoning || '',
        relatedNoteIds: related,
        confidence: conf,
        evidenceCount,
        relatedTopicCount,
        evidenceStrength,
        firstDetectedAt: now,
        lastDetectedAt: now,
        occurrenceCount: 1,
        previousPatternId: undefined,
        createdAt: now,
      };
    }

    formattedPatterns.push(finalPattern);

    // Save pattern embedding to thinkingPatternEmbeddings store
    if (pEmbedding && pEmbedding.length > 0) {
      await savePatternEmbedding(finalPattern.id, pEmbedding).catch((err) => {
        console.warn(`[ThinkingPattern] Failed to save pattern embedding for ${finalPattern.id}`, err);
      });
    }
  }

  if (formattedPatterns.length === 0) {
    if (invalidGenerations.length > 0) {
      throw new Error(
        `Pola pemikiran yang dihasilkan AI tidak memenuhi kriteria validasi (${invalidGenerations[0].reason}).`
      );
    }
    throw new Error('AI tidak menemukan pola pemikiran yang valid dari catatan.');
  }

  // ARCHIVE OLD PATTERNS to IndexedDB history with Change Tracking & Relationships
  if (existingPatterns.length > 0) {
    await archiveCurrentPatterns(existingPatterns, currentVersion - 1, formattedPatterns);
  }

  // Save updated patterns to IndexedDB active store
  await saveThinkingPatterns(formattedPatterns);

  // Save analysis metadata with analysisMode: 'full' for complete AI synthesis
  const parseTs = (val: any): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const p = Date.parse(val);
    return isNaN(p) ? 0 : p;
  };
  const latestNoteMod = Math.max(
    ...notes.map((n) => Math.max(parseTs(n.updatedAt), parseTs(n.createdAt), 0)),
    0
  );
  const metaRecord: ThinkingPatternMetaRecord = {
    id: META_KEY,
    analyzedNoteCount: notes.length,
    analyzedNoteIds: notes.map((n) => n.id),
    lastAnalyzedAt: now,
    latestNoteUpdatedAt: latestNoteMod,
    analysisVersion: currentVersion,
    analysisMode: 'full',
  };
  await saveThinkingPatternMeta(metaRecord);

  return {
    patterns: formattedPatterns,
    fromCache: false,
    message: 'Analisis pola pemikiran baru berhasil diselesaikan.',
  };
};
