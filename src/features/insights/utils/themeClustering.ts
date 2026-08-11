import { NoteItem } from '../../vault/pages/VaultPage';
import { NoteChunkEmbedding } from '../../../shared/types';
import { ThemeCluster } from '../types/theme';

/**
 * Compute Cosine Similarity between two numerical vectors
 */
export function computeCosineSimilarity(vecA: number[], vecB: number[]): number {
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

/**
 * Generate local term-frequency vector fallback if no precomputed embedding exists for a note
 */
export function generateLocalTermVector(text: string): number[] {
  const dim = 256;
  const vec = new Array(dim).fill(0);
  const words = text.toLowerCase().match(/\w+/g) || [];
  for (const word of words) {
    for (let i = 0; i < word.length; i++) {
      const charCode = word.charCodeAt(i);
      const idx = (charCode * (i + 1) * 31) % dim;
      vec[idx] += 1;
    }
  }
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  return norm > 0 ? vec.map((v) => v / norm) : vec;
}

/**
 * Extract note vector map purely using existing embeddings from IndexedDB cache
 */
export function extractNoteVectorMap(
  notes: NoteItem[],
  storedEmbeddings: NoteChunkEmbedding[]
): Map<string, number[]> {
  const noteVectorMap = new Map<string, number[]>();
  const chunkGroup = new Map<string, number[][]>();

  // Group stored embeddings by noteId
  for (const emb of storedEmbeddings) {
    if (!emb || !emb.noteId) continue;
    const vec = (emb as any).vector || emb.embedding;
    if (Array.isArray(vec) && vec.length > 0) {
      if (!chunkGroup.has(emb.noteId)) chunkGroup.set(emb.noteId, []);
      chunkGroup.get(emb.noteId)!.push(vec);
    }
  }

  // Calculate centroid vector for each note with existing embeddings
  for (const note of notes) {
    const vectors = chunkGroup.get(note.id);
    if (vectors && vectors.length > 0) {
      const dim = vectors[0].length;
      const meanVec = new Array(dim).fill(0);
      for (const vec of vectors) {
        if (vec.length === dim) {
          for (let i = 0; i < dim; i++) {
            meanVec[i] += vec[i];
          }
        }
      }
      for (let i = 0; i < dim; i++) {
        meanVec[i] /= vectors.length;
      }
      // Normalize
      const norm = Math.sqrt(meanVec.reduce((sum, val) => sum + val * val, 0));
      const normalized = norm > 0 ? meanVec.map((v) => v / norm) : meanVec;
      noteVectorMap.set(note.id, normalized);
    } else {
      // Fallback local vector without calling external API
      const combinedText = `${note.title || ''} ${note.content || ''} ${(note.tags || []).join(' ')}`;
      noteVectorMap.set(note.id, generateLocalTermVector(combinedText));
    }
  }

  return noteVectorMap;
}

/**
 * Cluster notes based on semantic similarity of topic content
 */
export function clusterNotesByTopic(
  notes: NoteItem[],
  noteVectorMap: Map<string, number[]>,
  minSimilarityThreshold = 0.40
): ThemeCluster[] {
  if (notes.length < 2) return [];

  const noteMap = new Map(notes.map((n) => [n.id, n]));
  const noteIds = notes.map((n) => n.id);
  const n = noteIds.length;

  // Build similarity graph
  const adj = new Map<string, { targetId: string; sim: number }[]>();
  for (const id of noteIds) adj.set(id, []);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const idA = noteIds[i];
      const idB = noteIds[j];
      const vecA = noteVectorMap.get(idA);
      const vecB = noteVectorMap.get(idB);
      if (vecA && vecB) {
        const sim = computeCosineSimilarity(vecA, vecB);
        if (sim >= minSimilarityThreshold) {
          adj.get(idA)!.push({ targetId: idB, sim });
          adj.get(idB)!.push({ targetId: idA, sim });
        }
      }
    }
  }

  // Connected components / Greedy Topic Clustering
  const visited = new Set<string>();
  const rawClusters: { ids: string[]; avgSim: number }[] = [];

  for (const startId of noteIds) {
    if (visited.has(startId)) continue;

    const neighbors = adj.get(startId) || [];
    if (neighbors.length === 0) continue; // Skip unlinked notes for multi-note clusters

    // BFS or Greedy Component
    const clusterNoteIds: string[] = [startId];
    visited.add(startId);

    // Sort neighbors by similarity descending
    const sortedNeighbors = [...neighbors].sort((a, b) => b.sim - a.sim);
    let totalSim = 0;
    let simCount = 0;

    for (const neighbor of sortedNeighbors) {
      if (visited.has(neighbor.targetId)) continue;
      // Max 10 notes per theme cluster
      if (clusterNoteIds.length >= 10) break;

      clusterNoteIds.push(neighbor.targetId);
      visited.add(neighbor.targetId);
      totalSim += neighbor.sim;
      simCount++;
    }

    if (clusterNoteIds.length >= 2) {
      const avgSim = simCount > 0 ? totalSim / simCount : minSimilarityThreshold;
      rawClusters.push({ ids: clusterNoteIds, avgSim });
    }
  }

  // If no multi-note cluster formed due to high threshold, lower threshold once
  if (rawClusters.length === 0 && minSimilarityThreshold > 0.25) {
    return clusterNotesByTopic(notes, noteVectorMap, 0.28);
  }

  return rawClusters.map((c, index) => ({
    clusterId: `cluster_${index + 1}`,
    noteIds: c.ids,
    noteTitles: c.ids.map((id) => noteMap.get(id)?.title || 'Catatan Tanpa Judul'),
    avgSimilarity: Math.round(c.avgSim * 100) / 100,
  }));
}
