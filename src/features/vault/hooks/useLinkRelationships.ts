import { useState, useEffect, useCallback, useMemo } from 'react';
import { NoteItem } from '../pages/VaultPage';
import { extractWikilinks } from '../../../shared/utils/wikilink';
import { getBacklinksFromDB, filterBacklinksFromNotes } from '../services/linkService';

interface UseLinkRelationshipsParams {
  currentNoteId?: string;
  noteTitle?: string;
  noteContent?: string;
  allNotes?: NoteItem[];
}

export function useLinkRelationships({
  currentNoteId,
  noteTitle = '',
  noteContent = '',
  allNotes,
}: UseLinkRelationshipsParams) {
  const [backlinks, setBacklinks] = useState<NoteItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Extract outgoing links in real-time from content
  const outgoingLinks = useMemo(() => {
    return extractWikilinks(noteContent);
  }, [noteContent]);

  // Fetch backlinks matching the active note's title
  const fetchBacklinks = useCallback(async () => {
    if (!noteTitle || !noteTitle.trim()) {
      setBacklinks([]);
      return;
    }

    setIsLoading(true);
    try {
      if (allNotes && allNotes.length > 0) {
        const results = filterBacklinksFromNotes(allNotes, noteTitle, currentNoteId);
        setBacklinks(results);
      } else {
        const results = await getBacklinksFromDB(noteTitle, currentNoteId);
        setBacklinks(results);
      }
    } catch (err) {
      console.error('Error loading backlinks:', err);
      setBacklinks([]);
    } finally {
      setIsLoading(false);
    }
  }, [noteTitle, currentNoteId, allNotes]);

  useEffect(() => {
    fetchBacklinks();
  }, [fetchBacklinks]);

  return {
    outgoingLinks,
    backlinks,
    isLoading,
    refreshBacklinks: fetchBacklinks,
  };
}
