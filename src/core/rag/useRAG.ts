import { useState, useCallback } from 'react';
import { ragService } from './ragService';
import { retrievalService } from './retrieval';
import { Note, RetrievalResult } from '../../shared/types';

export function useRAG() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRetrieving, setIsRetrieving] = useState(false);

  const processNote = useCallback(async (note: Note) => {
    setIsProcessing(true);
    try {
      await ragService.processAndStoreNote(note);
    } catch (err) {
      console.error('Error in RAG pipeline processing:', err);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const searchContext = useCallback(
    async (query: string, topK: number = 5): Promise<RetrievalResult[]> => {
      setIsRetrieving(true);
      try {
        return await retrievalService.searchRelevantChunks(query, topK);
      } catch (err) {
        console.error('Error in RAG retrieval:', err);
        return [];
      } finally {
        setIsRetrieving(false);
      }
    },
    []
  );

  return {
    processNote,
    searchContext,
    isProcessing,
    isRetrieving,
  };
}
