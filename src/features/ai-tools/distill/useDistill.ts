import { useState, useCallback, useRef } from 'react';
import { getDistillation, saveDistillation } from './distillService';
import { DistillationRecord } from '../../../core/database/indexedDb';

export interface RunDistillParams {
  id?: string;
  noteId?: string;
  title?: string;
  content: string;
  customGroqApiKey?: string;
  model?: string;
}

export const useDistill = () => {
  const [distillation, setDistillation] = useState<DistillationRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Mengecek apakah hasil distill untuk note tersebut sudah ada di IndexedDB via distillService.
   */
  const loadDistillation = useCallback(async (noteId: string): Promise<DistillationRecord | null> => {
    if (!noteId) {
      setDistillation(null);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const record = await getDistillation(noteId);
      setDistillation(record);
      return record;
    } catch (err: any) {
      console.error('Error saat memuat hasil distilasi di useDistill:', err);
      setError(err?.message || 'Gagal memuat hasil distilasi.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Mengirim isi catatan ke API Distill, memproses streaming AI,
   * lalu menyimpan hasilnya melalui distillService.
   */
  const runDistill = useCallback(async (params: RunDistillParams): Promise<string | null> => {
    const { content, title = 'Tanpa Judul', customGroqApiKey, model = 'llama-3.3-70b-versatile' } = params;
    const targetNoteId = params.noteId || params.id || '';

    if (!content || !content.trim()) {
      const errMsg = 'Isi catatan tidak boleh kosong untuk didistil.';
      setError(errMsg);
      return null;
    }

    setLoading(true);
    setError(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/distil', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content,
          customGroqApiKey,
          model,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Gagal terhubung ke layanan distilasi Groq AI.');
      }

      if (!response.body) {
        throw new Error('Response stream tidak tersedia.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                accumulated += parsed.text;
                // Live update distillation state while streaming
                setDistillation({
                  noteId: targetNoteId,
                  title,
                  content: accumulated,
                  updatedAt: new Date().toISOString(),
                });
              }
            } catch {}
          }
        }
      }

      // Save complete result to IndexedDB via distillService
      if (accumulated && targetNoteId) {
        await saveDistillation(targetNoteId, title, accumulated);
        const finalRecord: DistillationRecord = {
          noteId: targetNoteId,
          title,
          content: accumulated,
          updatedAt: new Date().toISOString(),
        };
        setDistillation(finalRecord);
      }

      return accumulated;
    } catch (err: any) {
      if (err.name === 'AbortError') return null;
      const errMsg = err?.message || 'Terjadi kesalahan saat memproses distilasi.';
      setError(errMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Membersihkan hasil sementara dari state.
   */
  const clearDistillation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setDistillation(null);
    setLoading(false);
    setError(null);
  }, []);

  return {
    distillation,
    loading,
    error,
    loadDistillation,
    runDistill,
    clearDistillation,
  };
};
