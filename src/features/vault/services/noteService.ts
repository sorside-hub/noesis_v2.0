import { NoteItem, CategoryId } from '../pages/VaultPage';
import { initNoesisDB, STORE_NAME, addToSyncQueue, getAllEmbeddings, deleteEmbeddingsByNoteId } from '../../../core/database/indexedDb';
import { extractWikilinks } from '../../../shared/utils/wikilink';
import { ragService } from '../../../core/rag/ragService';
import { syncEngine } from '../../../core/sync/syncEngine';

export const migrateCategory = (cat: string): CategoryId => {
  if (cat === 'learn') return 'world';
  if (cat === 'reflect') return 'self';
  if (cat === 'create') return 'ideas';
  if (cat === 'world' || cat === 'self' || cat === 'ideas') return cat as CategoryId;
  return 'self';
};

export const INITIAL_NOTES: NoteItem[] = [];

/**
 * Retrieves all notes from NoesisDB.
 */
export const getNotes = async (): Promise<NoteItem[]> => {
  try {
    const db = await initNoesisDB();
    const fetchedNotes = await new Promise<NoteItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('Gagal mengambil data dari NoesisDB:', request.error);
        reject(request.error);
      };
    });

    if (!fetchedNotes || fetchedNotes.length === 0) {
      return [];
    }

    // Auto-migrate legacy categories and missing type
    let hasMigration = false;
    const migratedNotes = fetchedNotes.map((note) => {
      const updatedCat = migrateCategory(note.category);
      const updatedType = note.type || 'unknown';
      if (updatedCat !== note.category || updatedType !== note.type) {
        hasMigration = true;
        return { ...note, category: updatedCat, type: updatedType };
      }
      return note;
    });

    if (hasMigration) {
      for (const n of migratedNotes) {
        saveNote(n).catch((err) => console.error('Error saving migrated note:', err));
      }
    }

    return migratedNotes;
  } catch (err) {
    console.error('Error IndexedDB getNotes:', err);
    return [];
  }
};

/**
 * Retrieves a single note by ID from NoesisDB.
 */
export const getNoteById = async (id: string): Promise<NoteItem | null> => {
  if (!id) return null;
  try {
    const db = await initNoesisDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const note = request.result;
        if (note) {
          const updatedCat = migrateCategory(note.category);
          const updatedType = note.type || 'unknown';
          if (updatedCat !== note.category || updatedType !== note.type) {
            note.category = updatedCat;
            note.type = updatedType;
            saveNote(note).catch(console.error);
          }
        }
        resolve(note || null);
      };

      request.onerror = () => {
        console.error('Gagal mengambil catatan dari NoesisDB:', request.error);
        reject(request.error);
      };
    });
  } catch (err) {
    console.error('Error IndexedDB getNoteById:', err);
    return null;
  }
};

/**
 * Saves or puts a note item into NoesisDB.
 */
export const saveNote = async (note: NoteItem): Promise<void> => {
  try {
    const db = await initNoesisDB();
    const existing = await getNoteById(note.id);
    const currentVersion = note.version || existing?.version || 0;
    const nextVersion = currentVersion + 1;

    // Check distillation stale status
    let distilledContent = note.distilledContent || existing?.distilledContent;
    let distilledAt = note.distilledAt || existing?.distilledAt;
    let distilledMetadata = note.distilledMetadata || existing?.distilledMetadata;

    if (distilledContent) {
      const distilVersion = distilledMetadata?.noteVersion;
      if (distilVersion !== undefined && nextVersion > distilVersion) {
        distilledMetadata = {
          ...distilledMetadata,
          isStale: true,
        };
      }
    }

    const noteToSave: NoteItem = {
      ...note,
      type: note.type || 'unknown',
      outgoingLinks: extractWikilinks(note.content),
      distilledContent,
      distilledAt,
      distilledMetadata,
      syncStatus: 'pending',
      updatedAt: note.updatedAt || new Date().toISOString(),
      version: nextVersion,
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(noteToSave);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('Gagal menyimpan catatan ke NoesisDB:', request.error);
        reject(request.error);
      };
    });

    // Queue mutation for Cloud Sync
    addToSyncQueue({
      entityType: 'note',
      entityId: noteToSave.id,
      action: 'upsert',
      payload: noteToSave,
    }).catch((err) => console.error('[SyncQueue] Error enqueueing save:', err));

    // Trigger RAG Pipeline (Chunking -> Embedding -> IndexedDB & Supabase Sync)
    await ragService.processAndStoreNote({
      id: note.id,
      title: note.title,
      content: note.content,
      category: note.category,
      type: note.type || 'unknown',
      tags: note.tags || [],
      createdAt: String(note.createdAt || Date.now()),
      updatedAt: String(note.updatedAt || Date.now()),
    }).catch((err) => console.error('RAG Pipeline Save Error:', err));

    // Non-blocking background sync trigger AFTER RAG processing
    syncEngine.triggerSync().catch((err) => console.error('[SyncEngine] Background sync error:', err));
  } catch (err) {
    console.error('Error IndexedDB saveNote:', err);
  }
};

/**
 * Updates a note item in NoesisDB (alias for saveNote).
 */
export const updateNote = async (note: NoteItem): Promise<void> => {
  return saveNote(note);
};

/**
 * Deletes a note by ID from NoesisDB.
 */
export const deleteNote = async (id: string): Promise<void> => {
  try {
    const db = await initNoesisDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('Gagal menghapus catatan dari NoesisDB:', request.error);
        reject(request.error);
      };
    });

    // Queue delete mutation for Cloud Sync
    addToSyncQueue({
      entityType: 'note',
      entityId: id,
      action: 'delete',
    }).catch((err) => console.error('[SyncQueue] Error enqueueing delete:', err));

    // Non-blocking background sync trigger
    syncEngine.triggerSync().catch((err) => console.error('[SyncEngine] Background sync error:', err));

    // Remove RAG embeddings for deleted note
    ragService.removeNoteEmbeddings(id).catch((err) => console.error('RAG Delete Error:', err));
  } catch (err) {
    console.error('Error IndexedDB deleteNote:', err);
  }
};

/**
 * Backfills any existing local notes that lack syncStatus into syncQueue.
 */
export const backfillLocalDataToSyncQueue = async (): Promise<void> => {
  try {
    const notes = await getNotes();
    let queuedCount = 0;
    for (const note of notes) {
      if (!note.syncStatus || note.syncStatus === 'pending' || typeof note.version !== 'number') {
        note.syncStatus = 'pending';
        if (typeof note.version !== 'number') {
          note.version = 1;
        }
        await addToSyncQueue({
          entityType: 'note',
          entityId: note.id,
          action: 'upsert',
          payload: note,
        });
        queuedCount++;
      }
    }
    if (queuedCount > 0) {
      console.log(`[Backfill] Enqueued ${queuedCount} legacy local notes for Cloud Sync.`);
      syncEngine.triggerSync().catch(() => {});
    }
  } catch (err) {
    console.error('Error backfillLocalDataToSyncQueue:', err);
  }
};

/**
 * Loads notes from NoesisDB.
 */
export const seedInitialNotesIfEmpty = async (_initialNotes?: NoteItem[]): Promise<NoteItem[]> => {
  return await getNotes();
};

// Backwards compatibility aliases
export const getNotesFromIDB = getNotes;
export const saveNoteToIDB = saveNote;
export const deleteNoteFromIDB = deleteNote;

/**
 * Searches notes in NoesisDB with scoped category filtering and query matching.
 */
export const searchNotes = async (
  query: string,
  category: CategoryId = 'all'
): Promise<NoteItem[]> => {
  try {
    const allNotes = await getNotes();
    return filterNotesByQueryAndCategory(allNotes, query, category);
  } catch (err) {
    console.error('Error IndexedDB searchNotes:', err);
    return [];
  }
};

/**
 * Moves a note to trash by setting deletedAt timestamp.
 */
export const moveToTrash = async (id: string): Promise<void> => {
  try {
    const note = await getNoteById(id);
    if (!note) return;
    note.deletedAt = new Date().toISOString();
    await saveNote(note);
    // Remove RAG embeddings while in trash so semantic search won't match trashed notes
    ragService.removeNoteEmbeddings(id).catch((err) => console.error('RAG Delete Error:', err));
  } catch (err) {
    console.error('Error moving note to trash:', err);
  }
};

/**
 * Restores a note from trash by resetting deletedAt to null.
 */
export const restoreNoteFromTrash = async (id: string): Promise<void> => {
  try {
    const note = await getNoteById(id);
    if (!note) return;
    note.deletedAt = null;
    await saveNote(note);
  } catch (err) {
    console.error('Error restoring note from trash:', err);
  }
};

/**
 * Pure helper function to filter notes by query string and category scope.
 * Matches against title, tags, and content. Excludes notes in trash.
 */
export const filterNotesByQueryAndCategory = (
  notes: NoteItem[],
  query: string,
  category: CategoryId = 'all'
): NoteItem[] => {
  const trimmed = query.trim().toLowerCase();

  return notes.filter((note) => {
    // 0. Exclude trashed notes
    if (note.deletedAt) {
      return false;
    }

    // 1. Filter by category if category is not 'all'
    if (category !== 'all' && note.category !== category) {
      return false;
    }

    // 2. Filter by search query (title, tags, content)
    if (!trimmed) {
      return true;
    }

    const titleMatch = note.title.toLowerCase().includes(trimmed);
    const tagMatch = note.tags?.some((t) => t.toLowerCase().includes(trimmed));
    const contentMatch = note.content.toLowerCase().includes(trimmed);

    return titleMatch || Boolean(tagMatch) || contentMatch;
  });
};

/**
 * Cleans up orphaned embeddings/chunks that no longer have a corresponding note.
 */
export const cleanOrphanEmbeddings = async (): Promise<number> => {
  try {
    const notes = await getNotes();
    const validNoteIds = new Set(notes.map((n) => n.id));
    const embeddings = await getAllEmbeddings();

    const orphanNoteIds = new Set<string>();
    for (const emb of embeddings) {
      if (!validNoteIds.has(emb.noteId)) {
        orphanNoteIds.add(emb.noteId);
      }
    }

    let cleanedCount = 0;
    for (const orphanId of orphanNoteIds) {
      await deleteEmbeddingsByNoteId(orphanId);
      cleanedCount++;
    }
    return cleanedCount;
  } catch (err) {
    console.error('Error cleaning orphan embeddings:', err);
    return 0;
  }
};

/**
 * Permanently deletes all notes in the trash (notes with deletedAt set).
 */
export const emptyTrashNotes = async (): Promise<number> => {
  try {
    const notes = await getNotes();
    const trashNotes = notes.filter((n) => Boolean(n.deletedAt));
    for (const note of trashNotes) {
      await deleteNote(note.id);
    }
    return trashNotes.length;
  } catch (err) {
    console.error('Error emptying trash notes:', err);
    return 0;
  }
};

