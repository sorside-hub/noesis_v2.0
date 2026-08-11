import {
  getPendingSyncItems,
  updateSyncQueueItem,
  deleteSyncQueueItem,
  initNoesisDB,
  STORE_NAME,
  DISTIL_STORE_NAME,
  DistillationRecord,
  getEmbeddingsByNoteId,
  saveEmbeddings,
} from '../database/indexedDb';
import { getSupabaseClient, isSupabaseConfigured } from '../database/supabaseClient';
import { NoteItem } from '../../features/vault/pages/VaultPage';
import { NoteChunkEmbedding } from '../../shared/types';
import { ragService } from '../rag/ragService';

const LAST_SYNCED_KEY = 'noesis_last_synced_at';

export function safeISOString(dateVal?: string | number | null): string {
  if (!dateVal) return new Date().toISOString();
  if (typeof dateVal === 'number') return new Date(dateVal).toISOString();

  const trimmed = String(dateVal).trim();
  if (!trimmed) return new Date().toISOString();

  if (/^\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!isNaN(num)) return new Date(num).toISOString();
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  const idToEnMap: Record<string, string> = {
    januari: 'January', jan: 'Jan',
    februari: 'February', feb: 'Feb',
    maret: 'March', mar: 'Mar',
    april: 'April', apr: 'Apr',
    mei: 'May',
    juni: 'June', jun: 'Jun',
    juli: 'July', jul: 'Jul',
    agustus: 'August', agst: 'Aug', agt: 'Aug',
    september: 'September', sept: 'Sep', sep: 'Sep',
    oktober: 'October', okt: 'Oct',
    november: 'November', nov: 'Nov',
    desember: 'December', des: 'Dec',
  };

  let normalized = trimmed;
  for (const [idMonth, enMonth] of Object.entries(idToEnMap)) {
    const reg = new RegExp(`\\b${idMonth}\\b`, 'gi');
    if (reg.test(normalized)) {
      normalized = normalized.replace(reg, enMonth);
      break;
    }
  }

  const parsedNormalized = new Date(normalized);
  if (!isNaN(parsedNormalized.getTime())) {
    return parsedNormalized.toISOString();
  }

  return new Date().toISOString();
}

export function ensure768Embedding(rawEmb?: number[] | null): number[] {
  if (!rawEmb || !Array.isArray(rawEmb)) {
    return new Array(768).fill(0);
  }
  if (rawEmb.length === 768) {
    return rawEmb;
  }
  if (rawEmb.length < 768) {
    const padded = [...rawEmb];
    while (padded.length < 768) {
      padded.push(0);
    }
    return padded;
  }
  return rawEmb.slice(0, 768);
}

class ReindexQueue {
  private queue: NoteItem[] = [];
  private isProcessing = false;

  public enqueue(note: NoteItem) {
    if (!this.queue.some((item) => item.id === note.id)) {
      this.queue.push(note);
    }
    this.processNext();
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const note = this.queue.shift();
      if (!note) continue;

      try {
        await ragService.processAndStoreNote({
          id: note.id,
          title: note.title,
          content: note.content,
          category: note.category,
          type: note.type || 'unknown',
          tags: note.tags || [],
          createdAt: String(note.createdAt || Date.now()),
          updatedAt: String(note.updatedAt || Date.now()),
        });
      } catch (err) {
        console.error(`[ReindexQueue] Failed to reindex note ${note.id}:`, err);
      }

      // 100ms pause between batches to prevent thermal throttling and UI blockage
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.isProcessing = false;
  }
}

export interface SyncResult {
  success: boolean;
  pulledCount: number;
  pushedCount: number;
  queuedRemaining: number;
  errors: string[];
  cloudTotalNotes: number;
  localTotalNotes: number;
}

class SyncEngine {
  private isSyncing = false;
  private syncTimer: any = null;
  private reindexQueue = new ReindexQueue();

  constructor() {
    this.initListeners();
  }

  private initListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[SyncEngine] Device back online. Triggering sync...');
        this.triggerSync();
      });

      // Periodic check every 60 seconds
      this.syncTimer = setInterval(() => {
        if (navigator.onLine && isSupabaseConfigured()) {
          this.triggerSync();
        }
      }, 60000);
    }
  }

  public async getCloudNoteCount(): Promise<number> {
    const client = getSupabaseClient();
    if (!client) return 0;
    try {
      const { count, error } = await client.from('notes').select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    } catch (err) {
      console.error('[SyncEngine] Error counting cloud notes:', err);
      return 0;
    }
  }

  public async triggerSync(options?: { forceFullSync?: boolean }): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      pulledCount: 0,
      pushedCount: 0,
      queuedRemaining: 0,
      errors: [],
      cloudTotalNotes: 0,
      localTotalNotes: 0,
    };

    if (this.isSyncing) {
      result.errors.push('Sinkronisasi sedang berlangsung.');
      return result;
    }

    if (!navigator.onLine || !isSupabaseConfigured()) {
      result.errors.push('Koneksi internet tidak tersedia atau Supabase belum dikonfigurasi.');
      return result;
    }

    this.isSyncing = true;
    try {
      const pushRes = await this.processSyncQueue();
      result.pushedCount = pushRes.pushedCount;
      if (pushRes.errors.length > 0) {
        result.errors.push(...pushRes.errors);
      }

      const pullRes = await this.pullRemoteChanges(options);
      result.pulledCount = pullRes.pulledCount;
      if (pullRes.errors.length > 0) {
        result.errors.push(...pullRes.errors);
      }

      const remainingQueue = await getPendingSyncItems();
      result.queuedRemaining = remainingQueue.length;

      const db = await initNoesisDB();
      result.localTotalNotes = await this.countLocalNotes(db);
      result.cloudTotalNotes = await this.getCloudNoteCount();
      result.success = result.errors.length === 0;
    } catch (err: any) {
      console.error('[SyncEngine] Sync iteration failed:', err);
      result.errors.push(err?.message || String(err));
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  public async processSyncQueue(): Promise<{ pushedCount: number; errors: string[] }> {
    const client = getSupabaseClient();
    if (!client) return { pushedCount: 0, errors: [] };

    const pendingItems = await getPendingSyncItems();
    if (pendingItems.length === 0) return { pushedCount: 0, errors: [] };

    console.log(`[SyncEngine] Processing ${pendingItems.length} queued mutations...`);
    let pushedCount = 0;
    const errors: string[] = [];

    for (const item of pendingItems) {
      if (item.retryCount >= 3) {
        continue; // Skip items that exceeded max retries
      }

      await updateSyncQueueItem({ ...item, status: 'processing' });

      try {
        if (item.entityType === 'note') {
          if (item.action === 'upsert') {
            const note: NoteItem = item.payload;
            const payloadToPush = {
              id: note.id,
              title: note.title,
              content: note.content,
              category: note.category,
              type: note.type || 'unknown',
              created_at: safeISOString(note.createdAt),
              updated_at: safeISOString(note.updatedAt),
              version: note.version || 1,
              is_pinned: Boolean(note.isPinned),
              tags: note.tags || [],
              outgoing_links: note.outgoingLinks || [],
              summary: note.summary || null,
              distilled_content: note.distilledContent || null,
              distilled_at: note.distilledAt ? safeISOString(note.distilledAt) : null,
              distilled_metadata: note.distilledMetadata || null,
              deleted_at: note.deletedAt ? safeISOString(note.deletedAt) : null,
            };

            const { error: noteErr } = await client.from('notes').upsert(payloadToPush, { onConflict: 'id' });
            if (noteErr) throw noteErr;

            // Also backup vector embeddings to note_chunks
            let localEmbeddings = await getEmbeddingsByNoteId(note.id);
            if (!localEmbeddings || localEmbeddings.length === 0) {
              try {
                await ragService.processAndStoreNote({
                  id: note.id,
                  title: note.title,
                  content: note.content,
                  category: note.category,
                  type: note.type || 'unknown',
                  tags: note.tags || [],
                  createdAt: String(note.createdAt || Date.now()),
                  updatedAt: String(note.updatedAt || Date.now()),
                });
                localEmbeddings = await getEmbeddingsByNoteId(note.id);
              } catch (err) {
                console.warn(`[SyncEngine] Failed to generate missing chunks during sync for note ${note.id}:`, err);
              }
            }

            if (localEmbeddings && localEmbeddings.length > 0) {
              const chunksToPush = localEmbeddings.map((emb) => ({
                id: emb.id,
                note_id: emb.noteId,
                chunk_text: emb.content,
                chunk_index: emb.chunkIndex,
                embedding: ensure768Embedding(emb.embedding),
                metadata: {
                  title: emb.title,
                  category: emb.category,
                  type: emb.type,
                  tags: emb.tags,
                },
                created_at: safeISOString(emb.createdAt),
              }));

              const { error: chunkErr } = await client.from('note_chunks').upsert(chunksToPush, { onConflict: 'id' });
              if (chunkErr) {
                console.warn(`[SyncEngine] Warning backing up note_chunks for ${note.id}:`, chunkErr);
              }
            }

            // Mark note in local IDB as synced ONLY if it wasn't edited while sync was running
            await this.markLocalNoteSyncedIfUnchanged(note.id, note.version || 1, note.updatedAt);
          } else if (item.action === 'delete') {
            const { error } = await client.from('notes').delete().eq('id', item.entityId);
            if (error) throw error;
            // Note: DB CASCADE deletes note_chunks automatically, but we can also explicitly clean up if needed
            await client.from('note_chunks').delete().eq('note_id', item.entityId);
          }
        }

        // Successfully pushed, remove from syncQueue
        await deleteSyncQueueItem(item.id);
        pushedCount++;
      } catch (err: any) {
        console.error(`[SyncEngine] Failed to sync item ${item.id}:`, err);
        const newRetryCount = item.retryCount + 1;
        const errMsg = err?.message || String(err);
        errors.push(`Gagal push ${item.entityId}: ${errMsg}`);
        await updateSyncQueueItem({
          ...item,
          status: newRetryCount >= 3 ? 'error' : 'pending',
          retryCount: newRetryCount,
          errorMessage: errMsg,
        });
      }
    }

    return { pushedCount, errors };
  }

  private syncCompleteListeners: Array<() => void> = [];

  public onSyncComplete(callback: () => void): () => void {
    this.syncCompleteListeners.push(callback);
    return () => {
      this.syncCompleteListeners = this.syncCompleteListeners.filter((cb) => cb !== callback);
    };
  }

  public notifySyncComplete() {
    this.syncCompleteListeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('[SyncEngine] Error in sync complete listener:', err);
      }
    });
  }

  private async countLocalNotes(db: IDBDatabase): Promise<number> {
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  }

  public async pullRemoteChanges(options?: { forceFullSync?: boolean }): Promise<{ pulledCount: number; errors: string[] }> {
    const client = getSupabaseClient();
    if (!client) return { pulledCount: 0, errors: [] };

    const errors: string[] = [];
    let savedToIndexedDBCount = 0;

    try {
      const db = await initNoesisDB();
      const localCount = await this.countLocalNotes(db);
      const lastSyncedAt = localStorage.getItem(LAST_SYNCED_KEY);

      let query = client.from('notes').select('*');

      // Force full pull if explicitly requested, or if local IndexedDB is empty, or if no lastSyncedAt recorded
      const isFullSync = Boolean(options?.forceFullSync) || localCount === 0 || !lastSyncedAt;

      if (!isFullSync && lastSyncedAt) {
        query = query.gte('updated_at', lastSyncedAt);
      } else {
        console.log('[SyncEngine] Performing full sync query from Supabase...');
      }

      const { data, error } = await query;
      if (error) throw error;

      console.log(`[AUDIT SYNC] Jumlah notes dari Supabase: ${data ? data.length : 0} (Full sync: ${isFullSync}, Local count: ${localCount})`);

      if (data && data.length > 0) {
        const remoteNoteIdsToFetchChunks: string[] = [];

        for (const remoteRow of data) {
          const localNote = await this.getLocalNote(db, remoteRow.id);

          if (localNote) {
            // Local-first precedence: preserve local unsynced edits unless forceFullSync
            if (localNote.syncStatus === 'pending' && !options?.forceFullSync) {
              console.log(`[SyncEngine] Local edits pending for note ${remoteRow.id}. Skipping remote overwrite.`);
              continue;
            }

            // Version comparison
            const remoteVersion = remoteRow.version || 1;
            const localVersion = localNote.version || 1;

            if (localVersion > remoteVersion && !options?.forceFullSync) {
              console.log(
                `[SyncEngine] Local version (v${localVersion}) higher than remote (v${remoteVersion}) for ${remoteRow.id}. Keeping local.`
              );
              continue;
            }
          }

          if (remoteRow.deleted_at) {
            await this.removeLocalNote(db, remoteRow.id);
            ragService.removeNoteEmbeddings(remoteRow.id).catch(() => {});
          } else {
            const mergedNote: NoteItem = {
              id: remoteRow.id,
              title: remoteRow.title,
              content: remoteRow.content,
              category: remoteRow.category,
              type: remoteRow.type || 'unknown',
              createdAt: remoteRow.created_at,
              updatedAt: remoteRow.updated_at,
              version: remoteRow.version || 1,
              isPinned: Boolean(remoteRow.is_pinned),
              tags: remoteRow.tags || [],
              outgoingLinks: remoteRow.outgoing_links || [],
              summary: remoteRow.summary || undefined,
              distilledContent: remoteRow.distilled_content || undefined,
              distilledAt: remoteRow.distilled_at || undefined,
              distilledMetadata: remoteRow.distilled_metadata || undefined,
              syncStatus: 'synced',
            };

            await this.saveLocalNote(db, mergedNote);
            savedToIndexedDBCount++;
            remoteNoteIdsToFetchChunks.push(remoteRow.id);

            // Restore distillation into IndexedDB distillations store if available
            if (remoteRow.distilled_content) {
              await this.saveLocalDistillationRecord(db, {
                noteId: remoteRow.id,
                title: remoteRow.title || 'Tanpa Judul',
                content: remoteRow.distilled_content,
                updatedAt: remoteRow.distilled_at || remoteRow.updated_at || new Date().toISOString(),
                noteVersion: remoteRow.distilled_metadata?.noteVersion || remoteRow.version || 1,
                isStale: Boolean(remoteRow.distilled_metadata?.isStale),
                metadata: remoteRow.distilled_metadata || undefined,
              });
            }
          }
        }

        // Batch fetch vector chunks for ALL pulled notes in 1 single HTTP request (no N+1 loop)
        if (remoteNoteIdsToFetchChunks.length > 0) {
          try {
            const chunksMap = new Map<string, any[]>();
            const { data: allChunks, error: chunksErr } = await client
              .from('note_chunks')
              .select('*')
              .in('note_id', remoteNoteIdsToFetchChunks);

            if (!chunksErr && allChunks) {
              for (const chunk of allChunks) {
                const list = chunksMap.get(chunk.note_id) || [];
                list.push(chunk);
                chunksMap.set(chunk.note_id, list);
              }
            }

            for (const noteId of remoteNoteIdsToFetchChunks) {
              const remoteChunks = chunksMap.get(noteId);
              if (remoteChunks && remoteChunks.length > 0) {
                const restoredEmbeddings: NoteChunkEmbedding[] = remoteChunks.map((rc: any) => ({
                  id: rc.id,
                  noteId: rc.note_id,
                  title: rc.metadata?.title || 'Catatan Tanpa Judul',
                  category: rc.metadata?.category || 'self',
                  type: rc.metadata?.type || 'unknown',
                  tags: rc.metadata?.tags || [],
                  chunkIndex: rc.chunk_index,
                  content: rc.chunk_text,
                  embedding: Array.isArray(rc.embedding)
                    ? rc.embedding
                    : typeof rc.embedding === 'string'
                    ? JSON.parse(rc.embedding)
                    : [],
                  createdAt: rc.created_at || Date.now(),
                  updatedAt: Date.now(),
                }));

                await saveEmbeddings(noteId, restoredEmbeddings);
              } else {
                const noteToReindex = await this.getLocalNote(db, noteId);
                if (noteToReindex) {
                  await this.enqueueReindexIfNeeded(noteToReindex);
                }
              }
            }
          } catch (chunksErr: any) {
            console.warn('[SyncEngine] Warning batch fetching note_chunks:', chunksErr);
          }
        }
      }

      console.log(`[AUDIT SYNC] Jumlah notes yang berhasil disimpan ke IndexedDB: ${savedToIndexedDBCount}`);
      localStorage.setItem(LAST_SYNCED_KEY, new Date().toISOString());
      this.notifySyncComplete();
    } catch (err: any) {
      console.error('[SyncEngine] Error pulling remote changes:', err);
      errors.push(`Gagal narik dari cloud: ${err?.message || String(err)}`);
    }

    return { pulledCount: savedToIndexedDBCount, errors };
  }

  private async enqueueReindexIfNeeded(note: NoteItem): Promise<void> {
    try {
      const embeddings = await getEmbeddingsByNoteId(note.id);
      if (!embeddings || embeddings.length === 0) {
        console.log(`[SyncEngine] Missing local embeddings for note ${note.id}. Queuing background re-index...`);
        this.reindexQueue.enqueue(note);
      }
    } catch (err) {
      console.error('[SyncEngine] Error checking embeddings for reindex:', err);
    }
  }

  private async markLocalNoteSyncedIfUnchanged(
    noteId: string,
    syncedVersion: number,
    syncedUpdatedAt?: string
  ): Promise<void> {
    const db = await initNoesisDB();
    const localNote = await this.getLocalNote(db, noteId);
    if (!localNote) return;

    const localVersion = localNote.version || 1;
    const localUpdated = localNote.updatedAt || '';

    // If local version or timestamp is newer than synced payload, user modified note locally during sync
    if (localVersion > syncedVersion) {
      console.log(
        `[SyncEngine] Local note ${noteId} was modified (local v${localVersion} > synced v${syncedVersion}). Keeping pending status.`
      );
      return;
    }

    if (syncedUpdatedAt && localUpdated && localUpdated > syncedUpdatedAt) {
      console.log(
        `[SyncEngine] Local note ${noteId} timestamp is newer than synced payload. Keeping pending status.`
      );
      return;
    }

    localNote.syncStatus = 'synced';
    await this.saveLocalNote(db, localNote);
  }

  private async getLocalNote(db: IDBDatabase, id: string): Promise<NoteItem | null> {
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  private async saveLocalNote(db: IDBDatabase, note: NoteItem): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(note);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private async saveLocalDistillationRecord(db: IDBDatabase, record: DistillationRecord): Promise<void> {
    if (!db.objectStoreNames.contains(DISTIL_STORE_NAME)) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DISTIL_STORE_NAME, 'readwrite');
      const store = tx.objectStore(DISTIL_STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private async removeLocalNote(db: IDBDatabase, id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async pushNoteChunks(noteId: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    try {
      const localEmbeddings = await getEmbeddingsByNoteId(noteId);
      if (localEmbeddings && localEmbeddings.length > 0) {
        const chunksToPush = localEmbeddings.map((emb) => ({
          id: emb.id,
          note_id: emb.noteId,
          chunk_text: emb.content,
          chunk_index: emb.chunkIndex,
          embedding: ensure768Embedding(emb.embedding),
          metadata: {
            title: emb.title,
            category: emb.category,
            type: emb.type,
            tags: emb.tags,
          },
          created_at: safeISOString(emb.createdAt),
        }));

        const { error: chunkErr } = await client.from('note_chunks').upsert(chunksToPush, { onConflict: 'id' });
        if (chunkErr) {
          console.warn(`[SyncEngine] Warning pushing note_chunks for note ${noteId}:`, chunkErr);
        } else {
          console.log(`[SyncEngine] Successfully backed up ${chunksToPush.length} chunks to note_chunks for note ${noteId}`);
        }
      }
    } catch (err) {
      console.error(`[SyncEngine] Error pushing note_chunks for ${noteId}:`, err);
    }
  }
}

export const syncEngine = new SyncEngine();
