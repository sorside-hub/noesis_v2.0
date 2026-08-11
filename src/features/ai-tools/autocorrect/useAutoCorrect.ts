import { useState } from 'react';
import { autoCorrectContent, AutoCorrectResult } from './autoCorrectService';

export function useAutoCorrect() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const runAutoCorrect = async (content: string): Promise<AutoCorrectResult | null> => {
    if (!content || !content.trim()) {
      setError('Isi catatan masih kosong. Tulis catatan terlebih dahulu untuk diperbaiki.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await autoCorrectContent({ content });
      setIsLoading(false);
      return result;
    } catch (err: any) {
      const errorMessage = err?.message || 'Terjadi kesalahan saat memproses Auto Correct dengan Groq AI.';
      setError(errorMessage);
      setIsLoading(false);
      return null;
    }
  };

  return {
    runAutoCorrect,
    isLoading,
    error,
    setError,
  };
}
