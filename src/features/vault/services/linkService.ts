import { NoteItem } from '../pages/VaultPage';
import { getNotes } from './noteService';
import { extractWikilinks } from '../../../shared/utils/wikilink';

/**
 * Returns outgoing links extracted from note content.
 */
export function getOutgoingLinksFromContent(content: string): string[] {
  return extractWikilinks(content);
}

/**
 * Finds all notes in IndexedDB that reference the given note title in their outgoingLinks or content.
 */
export async function getBacklinksFromDB(
  noteTitle: string,
  currentNoteId?: string
): Promise<NoteItem[]> {
  if (!noteTitle || !noteTitle.trim()) return [];
  const trimmedTitle = noteTitle.trim().toLowerCase();

  const allNotes = await getNotes();
  return filterBacklinksFromNotes(allNotes, trimmedTitle, currentNoteId);
}

/**
 * Synchronously filters notes that have an outgoing link pointing to noteTitle.
 */
export function filterBacklinksFromNotes(
  allNotes: NoteItem[],
  noteTitle: string,
  currentNoteId?: string
): NoteItem[] {
  if (!noteTitle || !noteTitle.trim()) return [];
  const trimmedTitle = noteTitle.trim().toLowerCase();

  return allNotes.filter((note) => {
    if (currentNoteId && note.id === currentNoteId) return false;

    // Check outgoingLinks array first, or fallback to extractWikilinks from content
    const outgoing =
      note.outgoingLinks && note.outgoingLinks.length > 0
        ? note.outgoingLinks
        : extractWikilinks(note.content);

    return outgoing.some((link) => link.trim().toLowerCase() === trimmedTitle);
  });
}
