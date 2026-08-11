import { NoteItem } from '../../vault/pages/VaultPage';
import { Theme } from '../types/theme';
import { NoteChunkEmbedding } from '../../../shared/types';
import { ConnectionCandidate } from '../types/connection';
import {
  computeCosineSimilarity,
  extractNoteVectorMap,
  generateLocalTermVector,
} from './themeClustering';

interface EntityVector {
  id: string;
  title: string;
  type: 'note' | 'theme';
  vector: number[];
  snippet: string;
  relatedNoteIds?: string[];
}

/**
 * Extracts connection candidates between Notes and Themes based on strong cosine similarity.
 *
 * Rules:
 * - Reuses existing embeddings (or local term vector fallback) without re-generating.
 * - Only pairings with strong similarity (>= 0.55 threshold) are selected.
 * - Excludes trivial parent-child pairs (e.g. Note inside its own Theme).
 * - Prioritizes strongest semantic bridges.
 */
export function extractConnectionCandidates(
  notes: NoteItem[],
  themes: Theme[],
  storedEmbeddings: NoteChunkEmbedding[],
  minSimilarityThreshold = 0.55
): ConnectionCandidate[] {
  if ((!notes || notes.length === 0) && (!themes || themes.length === 0)) {
    return [];
  }

  // 1. Build note vector map from precomputed embeddings
  const noteVectorMap = extractNoteVectorMap(notes, storedEmbeddings);

  // 2. Build entity vector list
  const entities: EntityVector[] = [];

  // Add notes
  notes.forEach((n) => {
    const vec = noteVectorMap.get(n.id);
    if (vec && vec.length > 0) {
      entities.push({
        id: n.id,
        title: n.title || 'Catatan Tanpa Judul',
        type: 'note',
        vector: vec,
        snippet: (n.content || '').slice(0, 300),
      });
    }
  });

  // Add themes
  themes.forEach((t) => {
    const relatedIds = t.relatedNoteIds || [];
    const validNoteVectors: number[][] = [];

    relatedIds.forEach((nId) => {
      const vec = noteVectorMap.get(nId);
      if (vec && vec.length > 0) {
        validNoteVectors.push(vec);
      }
    });

    let themeVec: number[];

    if (validNoteVectors.length > 0) {
      const dim = validNoteVectors[0].length;
      const meanVec = new Array(dim).fill(0);
      validNoteVectors.forEach((v) => {
        if (v.length === dim) {
          for (let i = 0; i < dim; i++) {
            meanVec[i] += v[i];
          }
        }
      });
      for (let i = 0; i < dim; i++) {
        meanVec[i] /= validNoteVectors.length;
      }
      const norm = Math.sqrt(meanVec.reduce((sum, val) => sum + val * val, 0));
      themeVec = norm > 0 ? meanVec.map((val) => val / norm) : meanVec;
    } else {
      const themeText = `${t.title || ''} ${t.description || ''}`;
      themeVec = generateLocalTermVector(themeText);
    }

    entities.push({
      id: t.id,
      title: t.title || 'Tema Tanpa Judul',
      type: 'theme',
      vector: themeVec,
      snippet: t.description || '',
      relatedNoteIds: relatedIds,
    });
  });

  if (entities.length < 2) return [];

  // 3. Pairwise cosine similarity calculation
  const candidatePairs: {
    source: EntityVector;
    target: EntityVector;
    similarity: number;
  }[] = [];

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const entA = entities[i];
      const entB = entities[j];

      // Exclude Note ↔ Note as primary user-facing connection (used only for internal engine calculations)
      if (entA.type === 'note' && entB.type === 'note') {
        continue;
      }

      // Exclude trivial containment (e.g. Note A is already part of Theme B)
      if (entA.type === 'note' && entB.type === 'theme' && entB.relatedNoteIds?.includes(entA.id)) {
        continue;
      }
      if (entB.type === 'note' && entA.type === 'theme' && entA.relatedNoteIds?.includes(entB.id)) {
        continue;
      }

      // Calculate cosine similarity
      const similarity = computeCosineSimilarity(entA.vector, entB.vector);

      if (similarity >= minSimilarityThreshold) {
        // Normalize direction so Theme is source if pairing Theme and Note
        let source = entA;
        let target = entB;

        if (entA.type === 'note' && entB.type === 'theme') {
          source = entB;
          target = entA;
        }

        candidatePairs.push({
          source,
          target,
          similarity,
        });
      }
    }
  }

  // 4. Sort by priority tier first (Theme ↔ Theme = 1, Theme ↔ Note = 2), then similarity descending
  candidatePairs.sort((a, b) => {
    const tierA = (a.source.type === 'theme' && a.target.type === 'theme') ? 1 : 2;
    const tierB = (b.source.type === 'theme' && b.target.type === 'theme') ? 1 : 2;

    if (tierA !== tierB) {
      return tierA - tierB;
    }
    return b.similarity - a.similarity;
  });

  // 5. Select top candidates (max 8)
  const topPairs = candidatePairs.slice(0, 8);

  // 6. Map to ConnectionCandidate format
  return topPairs.map((pair, idx) => {
    const isThemeBridge = pair.source.type === 'theme' && pair.target.type === 'theme';
    const connectionType: 'theme_bridge' | 'theme_evidence' = isThemeBridge ? 'theme_bridge' : 'theme_evidence';

    return {
      candidateId: `candidate_${Date.now()}_${idx + 1}`,
      sourceIds: [pair.source.id],
      targetIds: [pair.target.id],
      sourceTitles: [pair.source.title],
      targetTitles: [pair.target.title],
      sourceType: pair.source.type,
      targetType: pair.target.type,
      connectionType,
      similarity: Math.round(pair.similarity * 100) / 100,
      sourceContentSnippet: pair.source.snippet,
      targetContentSnippet: pair.target.snippet,
    };
  });
}
