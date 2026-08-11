export class EmbeddingService {
  private generateLocalFallbackVector(text: string): number[] {
    const dim = 768;
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

  async getEmbedding(text: string): Promise<number[]> {
    if (!text || !text.trim()) return [];
    try {
      const response = await fetch('/api/embed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        return this.generateLocalFallbackVector(text);
      }

      const data = await response.json().catch(() => null);
      if (data && Array.isArray(data.embedding) && data.embedding.length > 0) {
        return data.embedding;
      }
      return this.generateLocalFallbackVector(text);
    } catch {
      return this.generateLocalFallbackVector(text);
    }
  }

  async getBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || !texts.length) return [];
    try {
      const response = await fetch('/api/embed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ texts }),
      });

      if (!response.ok) {
        return texts.map((t) => this.generateLocalFallbackVector(t));
      }

      const data = await response.json().catch(() => null);
      if (data && Array.isArray(data.embeddings) && data.embeddings.length === texts.length) {
        return data.embeddings;
      }
      return texts.map((t) => this.generateLocalFallbackVector(t));
    } catch {
      return texts.map((t) => this.generateLocalFallbackVector(t));
    }
  }
}

export const embeddingService = new EmbeddingService();
