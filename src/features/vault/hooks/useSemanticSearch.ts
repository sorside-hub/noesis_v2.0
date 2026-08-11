import { useState, useEffect, useCallback, useRef } from 'react';
import { retrievalService, SemanticSearchResult } from '../../../core/rag/retrieval';
import { NoteItem } from '../pages/VaultPage';

export interface SemanticSearchNoteResult {
  note: NoteItem;
  score: number;
  snippet: string;
}

export const useSemanticSearch = (notes: NoteItem[]) => {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<SemanticSearchNoteResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const lastSearchedQueryRef = useRef<string>('');

  // Reset search cache when notes change to ensure fresh results on next search
  useEffect(() => {
    lastSearchedQueryRef.current = '';
  }, [notes]);

  const performSearch = useCallback(
    async (searchQuery: string) => {
      const trimmed = searchQuery.trim();
      if (!trimmed) {
        setResults([]);
        setIsLoading(false);
        lastSearchedQueryRef.current = '';
        return;
      }

      if (trimmed === lastSearchedQueryRef.current) {
        return;
      }
      lastSearchedQueryRef.current = trimmed;

      setIsLoading(true);
      setError(null);

      try {
        // Calls retrievalService.search() with minScore 0.50 (50%) and max 10 results
        const rawResults: SemanticSearchResult[] = await retrievalService.search(
          trimmed,
          0.50,
          10
        );

        // Map noteId to actual NoteItem from notes array
        const mappedResults: SemanticSearchNoteResult[] = [];
        for (const item of rawResults) {
          const matchedNote = notes.find((n) => n.id === item.noteId);
          if (matchedNote) {
            mappedResults.push({
              note: matchedNote,
              score: item.score,
              snippet: item.snippet,
            });
          }
        }

        setResults(mappedResults);
      } catch (err: any) {
        console.error('Error in useSemanticSearch:', err);
        setError(err?.message || 'Gagal melakukan pencarian semantik.');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [notes]
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      if (query.trim()) {
        performSearch(query);
      } else {
        setResults([]);
        lastSearchedQueryRef.current = '';
      }
    }, 350);

    return () => clearTimeout(handler);
  }, [query, performSearch]);

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    performSearch,
  };
};
