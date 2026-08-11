import { useState } from 'react';
import { autoDetectMetadata, AutoDetectResult } from './autoDetectService';

export function useAutoDetect() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const runAutoDetect = async (
    content: string,
    currentTitle?: string
  ): Promise<AutoDetectResult | null> => {
    if (!content || !content.trim()) {
      setError('Isi catatan masih kosong. Tulis catatan terlebih dahulu untuk di-auto-detect.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await autoDetectMetadata({
        content,
        title: currentTitle,
      });
      setIsLoading(false);
      return result;
    } catch (err: any) {
      const errorMessage = err?.message || 'Terjadi kesalahan saat memproses Auto-Detect dengan Groq AI.';
      setError(errorMessage);
      setIsLoading(false);
      return null;
    }
  };

  return {
    runAutoDetect,
    isLoading,
    error,
    setError,
  };
}
