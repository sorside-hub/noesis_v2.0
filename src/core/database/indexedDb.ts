import { NoteChunkEmbedding, SyncQueueItem } from '../../shared/types';
import { Connection } from '../../features/insights/types/connection';
import { Reflection } from '../../features/insights/types/reflection';

const DB_NAME = 'NoesisDB';
const DB_VERSION = 12;
const STORE_NAME = 'notes';
const DISTIL_STORE_NAME = 'distillations';
const EMBEDDINGS_STORE_NAME = 'embeddings';
const SYNC_QUEUE_STORE_NAME = 'syncQueue';
const THINKING_PATTERNS_STORE_NAME = 'thinkingPatterns';
const THINKING_PATTERN_HISTORY_STORE_NAME = 'thinkingPatternHistory';
const THINKING_PATTERN_EMBEDDINGS_STORE_NAME = 'thinkingPatternEmbeddings';
const THEMES_STORE_NAME = 'themes';
const CONNECTIONS_STORE_NAME = 'connections';
const REFLECTIONS_STORE_NAME = 'reflections';

export {
  DB_NAME,
  DB_VERSION,
  STORE_NAME,
  DISTIL_STORE_NAME,
  EMBEDDINGS_STORE_NAME,
  SYNC_QUEUE_STORE_NAME,
  THINKING_PATTERNS_STORE_NAME,
  THINKING_PATTERN_HISTORY_STORE_NAME,
  THINKING_PATTERN_EMBEDDINGS_STORE_NAME,
  THEMES_STORE_NAME,
  CONNECTIONS_STORE_NAME,
  REFLECTIONS_STORE_NAME,
};

export interface PatternEmbeddingRecord {
  id: string;
  patternId: string;
  embedding: number[];
  createdAt: number;
}

export interface DistillationRecord {
  noteId: string;
  title: string;
  content: string;
  updatedAt: string;
  noteVersion?: number;
  isStale?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Initializes and opens the IndexedDB database "NoesisDB".
 */
export const initNoesisDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB tidak didukung pada browser ini.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      let store: IDBObjectStore;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      } else {
        store = (event.target as IDBOpenDBRequest).transaction!.objectStore(STORE_NAME);
      }

      if (!store.indexNames.contains('category')) {
        store.createIndex('category', 'category', { unique: false });
      }
      if (!store.indexNames.contains('createdAt')) {
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!store.indexNames.contains('isPinned')) {
        store.createIndex('isPinned', 'isPinned', { unique: false });
      }
      if (!store.indexNames.contains('tags')) {
        store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      }
      if (!store.indexNames.contains('outgoingLinks')) {
        store.createIndex('outgoingLinks', 'outgoingLinks', { unique: false, multiEntry: true });
      }

      if (!db.objectStoreNames.contains(DISTIL_STORE_NAME)) {
        const distilStore = db.createObjectStore(DISTIL_STORE_NAME, { keyPath: 'noteId' });
        distilStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(EMBEDDINGS_STORE_NAME)) {
        const embeddingStore = db.createObjectStore(EMBEDDINGS_STORE_NAME, { keyPath: 'id' });
        embeddingStore.createIndex('noteId', 'noteId', { unique: false });
      }

      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE_NAME)) {
        const syncStore = db.createObjectStore(SYNC_QUEUE_STORE_NAME, { keyPath: 'id' });
        syncStore.createIndex('status', 'status', { unique: false });
        syncStore.createIndex('entityType', 'entityType', { unique: false });
        syncStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(THINKING_PATTERNS_STORE_NAME)) {
        const patternStore = db.createObjectStore(THINKING_PATTERNS_STORE_NAME, { keyPath: 'id' });
        patternStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(THINKING_PATTERN_HISTORY_STORE_NAME)) {
        const historyStore = db.createObjectStore(THINKING_PATTERN_HISTORY_STORE_NAME, { keyPath: 'id' });
        historyStore.createIndex('patternId', 'patternId', { unique: false });
        historyStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(THINKING_PATTERN_EMBEDDINGS_STORE_NAME)) {
        const pEmbStore = db.createObjectStore(THINKING_PATTERN_EMBEDDINGS_STORE_NAME, { keyPath: 'id' });
        pEmbStore.createIndex('patternId', 'patternId', { unique: true });
        pEmbStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(THEMES_STORE_NAME)) {
        const themeStore = db.createObjectStore(THEMES_STORE_NAME, { keyPath: 'id' });
        themeStore.createIndex('createdAt', 'createdAt', { unique: false });
        themeStore.createIndex('strength', 'strength', { unique: false });
      }

      if (!db.objectStoreNames.contains(CONNECTIONS_STORE_NAME)) {
        const connStore = db.createObjectStore(CONNECTIONS_STORE_NAME, { keyPath: 'id' });
        connStore.createIndex('createdAt', 'createdAt', { unique: false });
        connStore.createIndex('strength', 'strength', { unique: false });
      }

      if (!db.objectStoreNames.contains(REFLECTIONS_STORE_NAME)) {
        const reflStore = db.createObjectStore(REFLECTIONS_STORE_NAME, { keyPath: 'id' });
        reflStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      console.error('Error saat membuka NoesisDB (IndexedDB):', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

export const deleteEmbeddingsByNoteId = async (noteId: string): Promise<void> => {
  const db = await initNoesisDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(EMBEDDINGS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(EMBEDDINGS_STORE_NAME);
    const index = store.index('noteId');
    const request = index.getAllKeys(noteId);

    request.onsuccess = () => {
      const keys = request.result;
      if (!keys || keys.length === 0) {
        resolve();
        return;
      }
      let pending = keys.length;
      for (const key of keys) {
        const deleteReq = store.delete(key);
        deleteReq.onsuccess = () => {
          pending--;
          if (pending === 0) resolve();
        };
        deleteReq.onerror = () => reject(deleteReq.error);
      }
    };
    request.onerror = () => reject(request.error);
  });
};

export const saveEmbeddings = async (noteId: string, chunks: NoteChunkEmbedding[]): Promise<void> => {
  await deleteEmbeddingsByNoteId(noteId);
  if (!chunks || chunks.length === 0) return;

  const db = await initNoesisDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(EMBEDDINGS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(EMBEDDINGS_STORE_NAME);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);

    for (const chunk of chunks) {
      store.put(chunk);
    }
  });
};

export const getAllEmbeddings = async (): Promise<NoteChunkEmbedding[]> => {
  const db = await initNoesisDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(EMBEDDINGS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(EMBEDDINGS_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

export const getEmbeddingsByNoteId = async (noteId: string): Promise<NoteChunkEmbedding[]> => {
  const db = await initNoesisDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(EMBEDDINGS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(EMBEDDINGS_STORE_NAME);
    const index = store.index('noteId');
    const request = index.getAll(noteId);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Queue management helpers for Local-First Sync Engine.
 */
export const addToSyncQueue = async (
  item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'updatedAt' | 'retryCount' | 'status'>
): Promise<string> => {
  const db = await initNoesisDB();
  const id = `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();
  const newItem: SyncQueueItem = {
    ...item,
    id,
    status: 'pending',
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SYNC_QUEUE_STORE_NAME);
    const req = store.put(newItem);

    req.onsuccess = () => resolve(id);
    req.onerror = () => reject(req.error);
  });
};

export const getPendingSyncItems = async (): Promise<SyncQueueItem[]> => {
  const db = await initNoesisDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE_NAME, 'readonly');
    const store = tx.objectStore(SYNC_QUEUE_STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const items: SyncQueueItem[] = req.result || [];
      const pending = items.filter((i) => i.status === 'pending' || i.status === 'error');
      pending.sort((a, b) => a.createdAt - b.createdAt);
      resolve(pending);
    };
    req.onerror = () => reject(req.error);
  });
};

export const updateSyncQueueItem = async (item: SyncQueueItem): Promise<void> => {
  const db = await initNoesisDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SYNC_QUEUE_STORE_NAME);
    const req = store.put({ ...item, updatedAt: Date.now() });

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const deleteSyncQueueItem = async (id: string): Promise<void> => {
  const db = await initNoesisDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SYNC_QUEUE_STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const savePatternEmbedding = async (
  patternId: string,
  embedding: number[]
): Promise<void> => {
  if (!patternId || !embedding || embedding.length === 0) return;
  const db = await initNoesisDB();
  if (!db.objectStoreNames.contains(THINKING_PATTERN_EMBEDDINGS_STORE_NAME)) return;

  const record: PatternEmbeddingRecord = {
    id: patternId,
    patternId,
    embedding,
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(THINKING_PATTERN_EMBEDDINGS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(THINKING_PATTERN_EMBEDDINGS_STORE_NAME);
    const req = store.put(record);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const getPatternEmbedding = async (
  patternId: string
): Promise<PatternEmbeddingRecord | null> => {
  if (!patternId) return null;
  const db = await initNoesisDB();
  if (!db.objectStoreNames.contains(THINKING_PATTERN_EMBEDDINGS_STORE_NAME)) return null;

  return new Promise((resolve) => {
    const tx = db.transaction(THINKING_PATTERN_EMBEDDINGS_STORE_NAME, 'readonly');
    const store = tx.objectStore(THINKING_PATTERN_EMBEDDINGS_STORE_NAME);
    const req = store.get(patternId);

    req.onsuccess = () => resolve((req.result as PatternEmbeddingRecord) || null);
    req.onerror = () => resolve(null);
  });
};

export const getAllPatternEmbeddings = async (): Promise<PatternEmbeddingRecord[]> => {
  const db = await initNoesisDB();
  if (!db.objectStoreNames.contains(THINKING_PATTERN_EMBEDDINGS_STORE_NAME)) return [];

  return new Promise((resolve) => {
    const tx = db.transaction(THINKING_PATTERN_EMBEDDINGS_STORE_NAME, 'readonly');
    const store = tx.objectStore(THINKING_PATTERN_EMBEDDINGS_STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => resolve((req.result as PatternEmbeddingRecord[]) || []);
    req.onerror = () => resolve([]);
  });
};

export const deletePatternEmbedding = async (patternId: string): Promise<void> => {
  if (!patternId) return;
  const db = await initNoesisDB();
  if (!db.objectStoreNames.contains(THINKING_PATTERN_EMBEDDINGS_STORE_NAME)) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(THINKING_PATTERN_EMBEDDINGS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(THINKING_PATTERN_EMBEDDINGS_STORE_NAME);
    const req = store.delete(patternId);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const getSavedThemesFromDb = async (): Promise<any[]> => {
  try {
    const db = await initNoesisDB();
    if (!db.objectStoreNames.contains(THEMES_STORE_NAME)) return [];
    return new Promise((resolve) => {
      const tx = db.transaction(THEMES_STORE_NAME, 'readonly');
      const store = tx.objectStore(THEMES_STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const results = (req.result || []).filter((item: any) => item.id && item.title);
        results.sort((a: any, b: any) => b.createdAt - a.createdAt);
        resolve(results);
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.error('Error reading themes from IndexedDB:', err);
    return [];
  }
};

export const saveThemesToDb = async (themes: any[]): Promise<void> => {
  const db = await initNoesisDB();
  if (!db.objectStoreNames.contains(THEMES_STORE_NAME)) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(THEMES_STORE_NAME, 'readwrite');
    const store = tx.objectStore(THEMES_STORE_NAME);
    const clearReq = store.clear();

    clearReq.onsuccess = () => {
      if (!themes || themes.length === 0) {
        resolve();
        return;
      }
      let remaining = themes.length;
      for (const theme of themes) {
        const req = store.put(theme);
        req.onsuccess = () => {
          remaining--;
          if (remaining === 0) resolve();
        };
        req.onerror = () => reject(req.error);
      }
    };
    clearReq.onerror = () => reject(clearReq.error);
  });
};

export const deleteThemeFromDb = async (id: string): Promise<void> => {
  if (!id) return;
  const db = await initNoesisDB();
  if (!db.objectStoreNames.contains(THEMES_STORE_NAME)) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(THEMES_STORE_NAME, 'readwrite');
    const store = tx.objectStore(THEMES_STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const clearThemesInDb = async (): Promise<void> => {
  const db = await initNoesisDB();
  if (!db.objectStoreNames.contains(THEMES_STORE_NAME)) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(THEMES_STORE_NAME, 'readwrite');
    const store = tx.objectStore(THEMES_STORE_NAME);
    const req = store.clear();

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const getSavedConnectionsFromDb = async (): Promise<Connection[]> => {
  try {
    const db = await initNoesisDB();
    if (!db.objectStoreNames.contains(CONNECTIONS_STORE_NAME)) return [];
    return new Promise((resolve) => {
      const tx = db.transaction(CONNECTIONS_STORE_NAME, 'readonly');
      const store = tx.objectStore(CONNECTIONS_STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const results = (req.result || []).filter((item: any) => item.id && item.title);
        results.sort((a: any, b: any) => b.createdAt - a.createdAt);
        resolve(results);
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.error('Error reading connections from IndexedDB:', err);
    return [];
  }
};

export const saveConnectionsToDb = async (connections: Connection[]): Promise<void> => {
  const db = await initNoesisDB();
  if (!db.objectStoreNames.contains(CONNECTIONS_STORE_NAME)) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONNECTIONS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CONNECTIONS_STORE_NAME);
    const clearReq = store.clear();

    clearReq.onsuccess = () => {
      if (!connections || connections.length === 0) {
        resolve();
        return;
      }
      let remaining = connections.length;
      for (const conn of connections) {
        const req = store.put(conn);
        req.onsuccess = () => {
          remaining--;
          if (remaining === 0) resolve();
        };
        req.onerror = () => reject(req.error);
      }
    };
    clearReq.onerror = () => reject(clearReq.error);
  });
};

export const deleteConnectionFromDb = async (id: string): Promise<void> => {
  if (!id) return;
  const db = await initNoesisDB();
  if (!db.objectStoreNames.contains(CONNECTIONS_STORE_NAME)) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONNECTIONS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CONNECTIONS_STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const clearConnectionsInDb = async (): Promise<void> => {
  const db = await initNoesisDB();
  if (!db.objectStoreNames.contains(CONNECTIONS_STORE_NAME)) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONNECTIONS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CONNECTIONS_STORE_NAME);
    const req = store.clear();

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const wipeAllLocalData = async (): Promise<void> => {
  const db = await initNoesisDB();
  return new Promise((resolve, reject) => {
    const stores = [STORE_NAME, DISTIL_STORE_NAME, EMBEDDINGS_STORE_NAME, SYNC_QUEUE_STORE_NAME];
    const tx = db.transaction(stores, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    for (const storeName of stores) {
      const store = tx.objectStore(storeName);
      store.clear();
    }
  });
};

export const getSavedReflectionsFromDb = async (): Promise<Reflection[]> => {
  try {
    const db = await initNoesisDB();
    if (!db.objectStoreNames.contains(REFLECTIONS_STORE_NAME)) return [];
    return new Promise((resolve) => {
      const tx = db.transaction(REFLECTIONS_STORE_NAME, 'readonly');
      const store = tx.objectStore(REFLECTIONS_STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const results = (req.result || []).filter((item: any) => item.id && item.title);
        results.sort((a: any, b: any) => b.createdAt - a.createdAt);
        resolve(results);
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.error('Error reading reflections from IndexedDB:', err);
    return [];
  }
};

export const saveReflectionsToDb = async (reflections: Reflection[]): Promise<void> => {
  const db = await initNoesisDB();
  if (!db.objectStoreNames.contains(REFLECTIONS_STORE_NAME)) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(REFLECTIONS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(REFLECTIONS_STORE_NAME);

    if (!reflections || reflections.length === 0) {
      resolve();
      return;
    }
    let remaining = reflections.length;
    for (const refl of reflections) {
      const req = store.put(refl);
      req.onsuccess = () => {
        remaining--;
        if (remaining === 0) resolve();
      };
      req.onerror = () => reject(req.error);
    }
  });
};

export const deleteReflectionFromDb = async (id: string): Promise<void> => {
  if (!id) return;
  const db = await initNoesisDB();
  if (!db.objectStoreNames.contains(REFLECTIONS_STORE_NAME)) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(REFLECTIONS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(REFLECTIONS_STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const clearReflectionsInDb = async (): Promise<void> => {
  const db = await initNoesisDB();
  if (!db.objectStoreNames.contains(REFLECTIONS_STORE_NAME)) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(REFLECTIONS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(REFLECTIONS_STORE_NAME);
    const req = store.clear();

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

