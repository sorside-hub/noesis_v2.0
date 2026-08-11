import { getAllEmbeddings } from '../database/indexedDb';
import { embeddingService } from './embedding';
import { bm25Service } from './bm25';
import { hybridRrfService } from './hybridRrf';
import { getNotes } from '../../features/vault/services/noteService';
import { RetrievalResult, NoteChunkEmbedding } from '../../shared/types';

export type RetrievalMethod = 'vector' | 'bm25' | 'hybrid';

export interface RetrievalSearchOptions {
  method?: RetrievalMethod;
  topK?: number;
  threshold?: number;
  categoryFilter?: string | string[];
  typeFilter?: string | string[];
  tagFilter?: string | string[];
}

export interface SemanticSearchResult {
  noteId: string;
  score: number;
  snippet: string;
  chunkId: string;
}

export class RetrievalService {
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA.length || !vecB.length || vecA.length !== vecB.length) return 0;
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

  private buildFilterFn(
    categoryFilter?: string | string[],
    typeFilter?: string | string[],
    tagFilter?: string | string[]
  ): ((chunk: NoteChunkEmbedding) => boolean) | undefined {
    const parseFilter = (filter?: string | string[]): string[] => {
      if (!filter) return [];
      const list = Array.isArray(filter) ? filter : [filter];
      return list
        .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s && s !== 'all');
    };

    const categories = parseFilter(categoryFilter);
    const types = parseFilter(typeFilter);
    const tags = parseFilter(tagFilter).map((t) => t.replace(/^#/, ''));

    const hasCategory = categories.length > 0;
    const hasType = types.length > 0;
    const hasTag = tags.length > 0;

    if (!hasCategory && !hasType && !hasTag) return undefined;

    return (chunk: NoteChunkEmbedding) => {
      // 1. Category filter using chunk metadata directly
      if (hasCategory) {
        const chunkCategory = (chunk.category || '').toLowerCase().trim();
        if (!categories.includes(chunkCategory)) {
          return false;
        }
      }

      // 2. Type filter using chunk metadata directly
      if (hasType) {
        const chunkType = (chunk.type || '').toLowerCase().trim();
        if (!types.includes(chunkType)) {
          return false;
        }
      }

      // 3. Tag filter using chunk metadata directly
      if (hasTag) {
        const chunkTagsClean = (chunk.tags || []).map((t) =>
          t.replace(/^#/, '').toLowerCase().trim()
        );
        const hasMatchingTag = tags.some((tag) => chunkTagsClean.includes(tag));
        if (!hasMatchingTag) {
          return false;
        }
      }

      return true;
    };
  }

  /**
   * Internal vector search execution
   */
  private async searchVector(
    query: string,
    topK: number = 10,
    threshold: number = 0,
    filterFn?: (chunk: NoteChunkEmbedding) => boolean
  ): Promise<RetrievalResult[]> {
    if (!query || !query.trim()) return [];

    const queryVector = await embeddingService.getEmbedding(query);
    if (!queryVector || queryVector.length === 0) return [];

    let allChunkEmbeddings = await getAllEmbeddings();
    if (!allChunkEmbeddings || allChunkEmbeddings.length === 0) return [];

    if (filterFn) {
      allChunkEmbeddings = allChunkEmbeddings.filter(filterFn);
    }

    if (allChunkEmbeddings.length === 0) return [];

    const results: RetrievalResult[] = allChunkEmbeddings
      .map((chunk) => {
        const score = this.cosineSimilarity(queryVector, chunk.embedding);
        return { chunk, score };
      })
      .filter((res) => res.score >= threshold)
      .sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }

  /**
   * Unified search interface supporting vector, bm25, and hybrid (RRF) methods.
   */
  async search(
    query: string,
    options?: RetrievalSearchOptions
  ): Promise<RetrievalResult[]>;
  async search(
    query: string,
    minScore?: number,
    maxResults?: number
  ): Promise<SemanticSearchResult[]>;
  async search(
    query: string,
    arg2?: number | RetrievalSearchOptions,
    arg3: number = 10
  ): Promise<any> {
    if (!query || !query.trim()) return [];

    // Check if arg2 is legacy minScore (number) for SemanticSearchResult[] caller
    if (typeof arg2 === 'number') {
      const minScore = arg2;
      const maxResults = arg3;
      const vectorChunks = await this.searchVector(query, 50, minScore);

      const noteMap = new Map<string, SemanticSearchResult>();
      for (const item of vectorChunks) {
        const existing = noteMap.get(item.chunk.noteId);
        if (!existing || item.score > existing.score) {
          noteMap.set(item.chunk.noteId, {
            noteId: item.chunk.noteId,
            score: item.score,
            snippet: item.chunk.content,
            chunkId: item.chunk.id,
          });
        }
      }

      return Array.from(noteMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
    }

    // Options-based multi-method search
    const opts = arg2 || {};
    const method: RetrievalMethod = opts.method || 'hybrid';
    const topK: number = opts.topK || 10;
    const threshold: number = opts.threshold || 0;

    const filterFn = this.buildFilterFn(opts.categoryFilter, opts.typeFilter, opts.tagFilter);

    switch (method) {
      case 'vector':
        return this.searchVector(query, topK, threshold, filterFn);

      case 'bm25':
        return bm25Service.search(query, topK, filterFn);

      case 'hybrid':
      default: {
        // Run vector search and bm25 search concurrently
        const [vectorResults, bm25Results] = await Promise.all([
          this.searchVector(query, topK * 2, threshold, filterFn),
          bm25Service.search(query, topK * 2, filterFn),
        ]);

        return hybridRrfService.combine(vectorResults, bm25Results, topK);
      }
    }
  }

  /**
   * Helper method for RAG router or other services
   */
  async searchRelevantChunks(
    query: string,
    topK: number = 5,
    method: RetrievalMethod = 'hybrid',
    threshold: number = 0,
    categoryFilter: string | string[] = 'all',
    tagFilter: string | string[] = 'all',
    typeFilter: string | string[] = 'all'
  ): Promise<RetrievalResult[]> {
    return this.search(query, {
      method,
      topK,
      threshold,
      categoryFilter,
      typeFilter,
      tagFilter,
    });
  }
}

export const retrievalService = new RetrievalService();
