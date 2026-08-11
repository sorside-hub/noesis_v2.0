import { RetrievalResult } from '../../shared/types';

export class HybridRrfService {
  private kConstant: number = 60;

  /**
   * Reciprocal Rank Fusion (RRF)
   * Formula: RRF_score(d) = sum( 1 / (k + rank_i(d)) )
   */
  combine(
    vectorResults: RetrievalResult[],
    bm25Results: RetrievalResult[],
    topK: number = 10
  ): RetrievalResult[] {
    const maxRrf = 2 / (this.kConstant + 1); // Max RRF contribution for top rank in both (~0.03278)

    const vectorScoreMap = new Map<string, number>();
    vectorResults.forEach((v) => {
      vectorScoreMap.set(v.chunk.id, v.score);
    });

    const rrfScores = new Map<string, { chunk: any; rrfScore: number; vectorScore?: number }>();

    // Process vector search rankings
    vectorResults.forEach((res, index) => {
      const rank = index + 1;
      const key = res.chunk.id;
      const rrfContribution = 1 / (this.kConstant + rank);

      const existing = rrfScores.get(key);
      if (existing) {
        existing.rrfScore += rrfContribution;
      } else {
        rrfScores.set(key, { chunk: res.chunk, rrfScore: rrfContribution, vectorScore: res.score });
      }
    });

    // Process BM25 search rankings
    bm25Results.forEach((res, index) => {
      const rank = index + 1;
      const key = res.chunk.id;
      const rrfContribution = 1 / (this.kConstant + rank);

      const existing = rrfScores.get(key);
      if (existing) {
        existing.rrfScore += rrfContribution;
      } else {
        rrfScores.set(key, { chunk: res.chunk, rrfScore: rrfContribution });
      }
    });

    // Sort combined results by highest RRF score
    const merged = Array.from(rrfScores.values()).sort(
      (a, b) => b.rrfScore - a.rrfScore
    );

    return merged.slice(0, topK).map((item) => {
      // Use actual vector cosine score if available, or normalize RRF score to 0..1 scale
      let finalScore = item.vectorScore;
      if (finalScore === undefined || finalScore <= 0) {
        finalScore = Math.min(1, item.rrfScore / maxRrf);
      }
      return {
        chunk: item.chunk,
        score: finalScore,
      };
    });
  }
}

export const hybridRrfService = new HybridRrfService();
