import { initNoesisDB, STORE_NAME, DISTIL_STORE_NAME, DISTIL_STORE_NAME as DISTIL_STORE, DistillationRecord, addToSyncQueue } from '../../../core/database/indexedDb';
import { syncEngine } from '../../../core/sync/syncEngine';
import { NoteItem } from '../../vault/pages/VaultPage';

/**
 * Saves or updates a distillation result in NoesisDB distillations store,
 * updates the distilledContent & metadata on the NoteItem, and queues sync mutation to Supabase.
 */
export const saveDistillation = async (
  noteId: string,
  title: string,
  distilledText: string
): Promise<void> => {
  if (!noteId || !distilledText) return;
  try {
    const db = await initNoesisDB();

    if (db.objectStoreNames.contains(DISTIL_STORE_NAME)) {
      const nowIso = new Date().toISOString();

      // Read existing note to get version and current fields
      const getNotePromise = new Promise<NoteItem | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(noteId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });

      const existingNote = await getNotePromise;
      const noteVersion = existingNote?.version || 1;

      const record: DistillationRecord = {
        noteId,
        title: title || 'Tanpa Judul',
        content: distilledText,
        updatedAt: nowIso,
        noteVersion,
        isStale: false,
        metadata: {
          noteVersion,
          isStale: false,
        },
      };

      // 1. Save to IndexedDB distillations store
      const tx = db.transaction([DISTIL_STORE_NAME, STORE_NAME], 'readwrite');
      const distilStore = tx.objectStore(DISTIL_STORE_NAME);
      distilStore.put(record);

      // 2. Update NoteItem in IndexedDB notes store
      let updatedNoteToSync: NoteItem | null = null;
      const noteStore = tx.objectStore(STORE_NAME);
      const getReq = noteStore.get(noteId);
      getReq.onsuccess = () => {
        const noteToUpdate: NoteItem = getReq.result || {
          id: noteId,
          title: title || 'Tanpa Judul',
          content: '',
          category: 'self',
          type: 'concept',
          createdAt: nowIso,
        };

        noteToUpdate.distilledContent = distilledText;
        noteToUpdate.distilledAt = nowIso;
        noteToUpdate.distilledMetadata = {
          noteVersion,
          isStale: false,
        };
        noteToUpdate.syncStatus = 'pending';
        noteToUpdate.updatedAt = nowIso;

        updatedNoteToSync = noteToUpdate;
        noteStore.put(noteToUpdate);
      };

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      // 3. Queue mutation for Cloud Sync if updatedNoteToSync exists
      if (updatedNoteToSync) {
        await addToSyncQueue({
          entityType: 'note',
          entityId: noteId,
          action: 'upsert',
          payload: updatedNoteToSync,
        });

        // 4. Trigger SyncEngine
        syncEngine.triggerSync().catch((err) =>
          console.error('[SyncEngine] Background sync error after distillation:', err)
        );
      }
    }
  } catch (err) {
    console.error('Gagal menyimpan hasil distilasi ke NoesisDB:', err);
  }
};

/**
 * Updates an existing distillation record (alias to saveDistillation).
 */
export const updateDistillation = async (
  noteId: string,
  title: string,
  distilledText: string
): Promise<void> => {
  return saveDistillation(noteId, title, distilledText);
};

/**
 * Retrieves a distillation record from NoesisDB by noteId.
 */
export const getDistillation = async (
  noteId: string
): Promise<DistillationRecord | null> => {
  if (!noteId) return null;
  try {
    const db = await initNoesisDB();
    if (!db.objectStoreNames.contains(DISTIL_STORE_NAME)) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(DISTIL_STORE_NAME, 'readonly');
      const store = tx.objectStore(DISTIL_STORE_NAME);
      const request = store.get(noteId);
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => resolve(null);
    });
  } catch (err) {
    console.error('Gagal mengambil distilasi dari NoesisDB:', err);
    return null;
  }
};

// Backwards compatibility aliases
export const saveDistillationToIDB = saveDistillation;
export const getDistillationFromIDB = getDistillation;
