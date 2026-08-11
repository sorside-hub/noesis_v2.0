import { useState, useEffect, useCallback, useMemo } from 'react';
import { NoteItem, CategoryId } from '../pages/VaultPage';
import {
  getNotes,
  saveNote,
  updateNote as updateNoteInService,
  deleteNote as deleteNoteInService,
  moveToTrash as moveToTrashInService,
  restoreNoteFromTrash as restoreNoteFromTrashInService,
  emptyTrashNotes as emptyTrashNotesInService,
  filterNotesByQueryAndCategory,
  searchNotes as searchNotesInService,
  backfillLocalDataToSyncQueue,
} from '../services/noteService';
import { syncEngine } from '../../../core/sync/syncEngine';

export const useNotes = () => {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Mengambil semua catatan dari IndexedDB melalui noteService.
   */
  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedNotes = await getNotes();
      console.log(`[AUDIT SYNC] Jumlah notes yang dikirim ke React state (setNotes): ${fetchedNotes.length}`);
      setNotes(fetchedNotes);
    } catch (err: any) {
      console.error('Error saat memuat catatan di useNotes:', err);
      setError(err?.message || 'Gagal memuat catatan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes().then(() => {
      backfillLocalDataToSyncQueue().catch(() => {});
      syncEngine.triggerSync().catch(() => {});
    });

    const unsubscribe = syncEngine.onSyncComplete(() => {
      console.log('[useNotes] Sync complete event received. Reloading notes into React state...');
      loadNotes();
    });

    return () => {
      unsubscribe();
    };
  }, [loadNotes]);

  /**
   * Catatan aktif (tidak ada di sampah)
   */
  const activeNotes = useMemo(() => {
    return notes.filter((n) => !n.deletedAt);
  }, [notes]);

  /**
   * Catatan yang berada di sampah
   */
  const trashNotes = useMemo(() => {
    return notes.filter((n) => Boolean(n.deletedAt));
  }, [notes]);

  /**
   * Membuat catatan baru melalui noteService lalu memperbarui state.
   */
  const createNote = useCallback(async (note: NoteItem) => {
    try {
      await saveNote(note);
      setNotes((prev) => [note, ...prev.filter((n) => n.id !== note.id)]);
    } catch (err: any) {
      console.error('Error saat membuat catatan:', err);
      setError(err?.message || 'Gagal membuat catatan.');
      throw err;
    }
  }, []);

  /**
   * Memperbarui catatan melalui noteService lalu memperbarui state.
   */
  const updateNote = useCallback(async (note: NoteItem) => {
    try {
      await updateNoteInService(note);
      setNotes((prev) =>
        prev.map((n) => (n.id === note.id ? note : n))
      );
    } catch (err: any) {
      console.error('Error saat memperbarui catatan:', err);
      setError(err?.message || 'Gagal memperbarui catatan.');
      throw err;
    }
  }, []);

  /**
   * Memindahkan catatan ke Sampah (Soft Delete).
   */
  const moveToTrash = useCallback(async (id: string) => {
    try {
      const nowISO = new Date().toISOString();
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, deletedAt: nowISO } : n))
      );
      await moveToTrashInService(id);
    } catch (err: any) {
      console.error('Error saat memindahkan catatan ke sampah:', err);
      setError(err?.message || 'Gagal memindahkan catatan ke sampah.');
      throw err;
    }
  }, []);

  /**
   * Memulihkan catatan dari Sampah.
   */
  const restoreNote = useCallback(async (id: string) => {
    try {
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, deletedAt: null } : n))
      );
      await restoreNoteFromTrashInService(id);
    } catch (err: any) {
      console.error('Error saat memulihkan catatan dari sampah:', err);
      setError(err?.message || 'Gagal memulihkan catatan.');
      throw err;
    }
  }, []);

  /**
   * Menghapus catatan secara permanen dari NoesisDB.
   */
  const deleteNotePermanently = useCallback(async (id: string) => {
    try {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      await deleteNoteInService(id);
    } catch (err: any) {
      console.error('Error saat menghapus catatan secara permanen:', err);
      setError(err?.message || 'Gagal menghapus catatan.');
      throw err;
    }
  }, []);

  /**
   * Mengosongkan seluruh sampah secara permanen.
   */
  const emptyTrash = useCallback(async () => {
    try {
      setNotes((prev) => prev.filter((n) => !n.deletedAt));
      await emptyTrashNotesInService();
    } catch (err: any) {
      console.error('Error saat mengosongkan sampah:', err);
      setError(err?.message || 'Gagal mengosongkan sampah.');
      throw err;
    }
  }, []);

  /**
   * Default delete function calls moveToTrash for soft delete safety.
   */
  const deleteNote = useCallback(async (id: string) => {
    await moveToTrash(id);
  }, [moveToTrash]);

  /**
   * Mengubah status isPinned sebuah catatan melalui noteService.
   */
  const togglePin = useCallback(async (id: string) => {
    try {
      let updatedNote: NoteItem | undefined;
      setNotes((prev) =>
        prev.map((n) => {
          if (n.id === id) {
            updatedNote = { ...n, isPinned: !n.isPinned };
            return updatedNote;
          }
          return n;
        })
      );

      if (updatedNote) {
        await updateNoteInService(updatedNote);
      }
    } catch (err: any) {
      console.error('Error saat mengubah status pin:', err);
      setError(err?.message || 'Gagal mengubah status pin.');
    }
  }, []);

  /**
   * Mencari/memfilter catatan berdasarkan query dan category scope via noteService.
   */
  const searchNotes = useCallback(
    (query: string, category: CategoryId = 'all'): NoteItem[] => {
      return filterNotesByQueryAndCategory(notes, query, category);
    },
    [notes]
  );

  /**
   * Mencari catatan langsung dari IndexedDB melalui noteService.
   */
  const searchNotesAsync = useCallback(
    async (query: string, category: CategoryId = 'all'): Promise<NoteItem[]> => {
      return await searchNotesInService(query, category);
    },
    []
  );

  return {
    notes,
    activeNotes,
    trashNotes,
    loading,
    error,
    loadNotes,
    createNote,
    updateNote,
    deleteNote,
    moveToTrash,
    restoreNote,
    deleteNotePermanently,
    emptyTrash,
    togglePin,
    searchNotes,
    searchNotesAsync,
  };
};
