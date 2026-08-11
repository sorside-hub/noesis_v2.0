import { getAllEmbeddings } from '../database/indexedDb';
import { RetrievalResult, NoteChunkEmbedding } from '../../shared/types';

export class BM25Service {
  private k1: number = 1.2;
  private b: number = 0.75;

  private tokenize(text: string): string[] {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((term) => term.length > 1);
  }

  async search(
    query: string,
    topK: number = 10,
    filterFn?: (chunk: NoteChunkEmbedding) => boolean
  ): Promise<RetrievalResult[]> {
    if (!query || !query.trim()) return [];

    let allChunkEmbeddings = await getAllEmbeddings();
    if (!allChunkEmbeddings || allChunkEmbeddings.length === 0) return [];

    if (filterFn) {
      allChunkEmbeddings = allChunkEmbeddings.filter(filterFn);
    }

    if (allChunkEmbeddings.length === 0) return [];

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const N = allChunkEmbeddings.length;

    // Pre-tokenize document contents and calculate average length
    const docTokensList = allChunkEmbeddings.map((chunk) =>
      this.tokenize(chunk.content)
    );
    const totalDocLen = docTokensList.reduce(
      (acc, tokens) => acc + tokens.length,
      0
    );
    const avgdl = totalDocLen / N || 1;

    // Compute Document Frequency (DF) for query terms
    const dfMap = new Map<string, number>();
    for (const term of new Set(queryTokens)) {
      let count = 0;
      for (const docTokens of docTokensList) {
        if (docTokens.includes(term)) {
          count++;
        }
      }
      dfMap.set(term, count);
    }

    // Score documents with BM25 formula
    const scoredDocs: RetrievalResult[] = [];

    for (let i = 0; i < N; i++) {
      const chunk = allChunkEmbeddings[i];
      const docTokens = docTokensList[i];
      const docLen = docTokens.length;
      if (docLen === 0) continue;

      const tfMap = new Map<string, number>();
      for (const term of docTokens) {
        tfMap.set(term, (tfMap.get(term) || 0) + 1);
      }

      let score = 0;
      for (const term of queryTokens) {
        const tf = tfMap.get(term) || 0;
        if (tf === 0) continue;

        const df = dfMap.get(term) || 0;
        const idf = Math.max(0, Math.log((N - df + 0.5) / (df + 0.5) + 1));

        const numerator = tf * (this.k1 + 1);
        const denominator =
          tf + this.k1 * (1 - this.b + this.b * (docLen / avgdl));

        score += idf * (numerator / denominator);
      }

      if (score > 0) {
        scoredDocs.push({ chunk, score });
      }
    }

    return scoredDocs.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}

export const bm25Service = new BM25Service();
