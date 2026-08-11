import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  X,
  RefreshCw,
  Cloud,
  Database,
  Download,
  Upload,
  Trash2,
  Cpu,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertTriangle,
  HardDrive,
  Smartphone,
  User,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BookOpen,
  BarChart2,
  Wrench,
  Sparkles,
  Layers,
} from 'lucide-react';
import { getNotes, saveNote, cleanOrphanEmbeddings, moveToTrash } from '../services/noteService';
import {
  getAllEmbeddings,
  initNoesisDB,
  saveEmbeddings,
  getPendingSyncItems,
  SYNC_QUEUE_STORE_NAME,
  STORE_NAME,
  wipeAllLocalData,
  getSavedThemesFromDb,
  saveThemesToDb,
  getSavedConnectionsFromDb,
  saveConnectionsToDb,
  getSavedReflectionsFromDb,
  saveReflectionsToDb,
  getAllPatternEmbeddings,
  savePatternEmbedding
} from '../../../core/database/indexedDb';
import { syncEngine, SyncResult } from '../../../core/sync/syncEngine';
import {
  getSavedThinkingPatterns,
  getThinkingPatternMeta,
  getThinkingPatternHistory,
  saveThinkingPatterns,
  saveThinkingPatternMeta,
  saveThinkingPatternHistory
} from '../../insights/services/thinkingPatternService';
import { getSupabaseClient, isSupabaseConfigured } from '../../../core/database/supabaseClient';
import { ragService } from '../../../core/rag/ragService';
import { NoteItem } from '../pages/VaultPage';
import { NoteChunkEmbedding } from '../../../shared/types';
import { formatDateToDMY } from '../../../shared/utils/dateUtils';

interface VaultSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const SQL_SCHEMA_TEXT = `-- Supabase DDL Schema for Noesis Cloud Backup Layer (Local-First Architecture)

-- 1. Enable pgvector extension for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Notes Table
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id UUID DEFAULT auth.uid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  type TEXT DEFAULT 'unknown',
  tags TEXT[] DEFAULT '{}',
  outgoing_links TEXT[] DEFAULT '{}',
  summary TEXT,
  distilled_content TEXT,
  distilled_at TIMESTAMPTZ,
  distilled_metadata JSONB,
  version INT DEFAULT 1,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Index for incremental sync queries
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);

-- 3. Note Chunks Table with Vector Embeddings (768 dimensions for Gemini Text Embeddings)
CREATE TABLE IF NOT EXISTS note_chunks (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID DEFAULT auth.uid(),
  chunk_text TEXT NOT NULL,
  chunk_index INT NOT NULL,
  embedding vector(768),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW Vector Index for efficient cosine similarity indexing
CREATE INDEX IF NOT EXISTS idx_note_chunks_embedding 
ON note_chunks 
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_note_chunks_note_id ON note_chunks(note_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_chunks ENABLE ROW LEVEL SECURITY;

-- Default permissive policies
CREATE POLICY "Allow public select on notes" ON notes FOR SELECT USING (true);
CREATE POLICY "Allow public all on notes" ON notes FOR ALL USING (true);

CREATE POLICY "Allow public select on note_chunks" ON note_chunks FOR SELECT USING (true);
CREATE POLICY "Allow public all on note_chunks" ON note_chunks FOR ALL USING (true);`;

export const VaultSettingsDrawer: React.FC<VaultSettingsDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'Connected' | 'Offline' | 'Syncing' | 'Error'>('Offline');
  const [lastSyncTime, setLastSyncTime] = useState<string>('Belum pernah');

  // Vault Stats & Diagnostics
  const [noteCount, setNoteCount] = useState<number>(0);
  const [cloudNoteCount, setCloudNoteCount] = useState<number>(0);
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [lastSyncDetails, setLastSyncDetails] = useState<SyncResult | null>(null);

  // Maintenance & Operations State
  const [isCleaningOrphans, setIsCleaningOrphans] = useState<boolean>(false);

  // Backup & Identity
  const [deviceId, setDeviceId] = useState<string>('');
  const [userId, setUserId] = useState<string>('Local-First User');
  const [isCloudConfigured, setIsCloudConfigured] = useState<boolean>(false);

  // UI Toggles & Modals
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);
  const [isDangerZoneOpen, setIsDangerZoneOpen] = useState(false);
  const [isSqlCopied, setIsSqlCopied] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [isRebuildingIndex, setIsRebuildingIndex] = useState(false);
  const [rebuildProgress, setRebuildProgress] = useState<{ current: number; total: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Load / Generate Device ID
    let devId = localStorage.getItem('noesis_device_id');
    if (!devId) {
      devId = `device_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('noesis_device_id', devId);
    }
    setDeviceId(devId);

    // Check Supabase Configuration
    const configured = isSupabaseConfigured();
    setIsCloudConfigured(configured);

    if (configured) {
      setConnectionStatus('Connected');
      const client = getSupabaseClient();
      if (client) {
        client.auth.getUser().then(({ data }) => {
          if (data?.user?.id) {
            setUserId(data.user.id);
          } else {
            setUserId('Anon / Public');
          }
        }).catch(() => {
          setUserId('Anon / Public');
        });
      }
    } else {
      setConnectionStatus('Offline');
    }

    // Load Last Sync Time
    const rawLastSynced = localStorage.getItem('noesis_last_synced_at');
    if (rawLastSynced) {
      try {
        setLastSyncTime(formatDateToDMY(rawLastSynced));
      } catch {
        setLastSyncTime(rawLastSynced);
      }
    }

    // Fetch Stats
    refreshVaultStats();
  }, [isOpen]);

  const refreshVaultStats = async () => {
    try {
      const notes = await getNotes();
      setNoteCount(notes.length);

      const pendingItems = await getPendingSyncItems();
      setPendingQueueCount(pendingItems.length);

      if (isSupabaseConfigured()) {
        const cloudCount = await syncEngine.getCloudNoteCount();
        setCloudNoteCount(cloudCount);
      }
    } catch (err) {
      console.error('Error loading vault stats:', err);
    }
  };

  const handleCleanOrphans = async () => {
    setIsCleaningOrphans(true);
    try {
      const cleanedCount = await cleanOrphanEmbeddings();
      showToast(`${cleanedCount} vector embedding yatim berhasil dibersihkan.`);
      await refreshVaultStats();
    } catch (err) {
      console.error('Clean orphan embeddings error:', err);
      showToast('Gagal membersihkan vector embedding yatim.');
    } finally {
      setIsCleaningOrphans(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleSyncNow = async () => {
    if (!isCloudConfigured) {
      showToast('Konfigurasi Supabase belum disetel.');
      return;
    }
    setIsSyncing(true);
    setConnectionStatus('Syncing');

    try {
      const result = await syncEngine.triggerSync({ forceFullSync: true });
      setLastSyncDetails(result);

      const rawLastSynced = localStorage.getItem('noesis_last_synced_at');
      if (rawLastSynced) {
        setLastSyncTime(formatDateToDMY(rawLastSynced));
      }
      setConnectionStatus(result.success ? 'Connected' : 'Error');
      await refreshVaultStats();

      if (result.success) {
        showToast(`Sinkronisasi Cloud Berhasil (+${result.pulledCount} ditarik, +${result.pushedCount} diunggah)`);
      } else {
        showToast(`Sinkronisasi Selesai dengan beberapa perhatian (+${result.pulledCount} ditarik)`);
      }
    } catch (err) {
      console.error('Manual sync failed:', err);
      setConnectionStatus('Error');
      showToast('Sinkronisasi Gagal. Coba lagi.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SCHEMA_TEXT);
    setIsSqlCopied(true);
    showToast('SQL Schema berhasil disalin!');
    setTimeout(() => setIsSqlCopied(false), 2000);
  };

  // 1. Export Vault
  const handleExportVault = async () => {
    try {
      const notes = await getNotes();
      const embeddings = await getAllEmbeddings();

      // Gather Insights Data
      const themes = await getSavedThemesFromDb();
      const connections = await getSavedConnectionsFromDb();
      const reflections = await getSavedReflectionsFromDb();
      const patterns = await getSavedThinkingPatterns();
      const patternMeta = await getThinkingPatternMeta();
      const patternHistory = await getThinkingPatternHistory();
      const patternEmbeddings = await getAllPatternEmbeddings();

      // Gather Chat History & AI Settings
      let chatThreads = [];
      try {
        const savedChat = localStorage.getItem('noesis_v2_chat_threads');
        if (savedChat) {
          chatThreads = JSON.parse(savedChat);
        }
      } catch (e) {
        console.error('Failed to parse chat threads for export', e);
      }

      let aiSettings = null;
      try {
        const savedSettings = localStorage.getItem('noesis_v2_ai_settings');
        if (savedSettings) {
          aiSettings = JSON.parse(savedSettings);
        }
      } catch (e) {
        console.error('Failed to parse ai settings for export', e);
      }

      const exportData = {
        app: 'Noesis Vault',
        version: 2,
        exportedAt: new Date().toISOString(),
        notes,
        embeddings,
        insights: {
          themes,
          connections,
          reflections,
          patterns,
          patternMeta,
          patternHistory,
          patternEmbeddings
        },
        chatThreads,
        aiSettings
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `noesis_vault_backup_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('Vault, Insights, & Chat berhasil diekspor!');
    } catch (err) {
      console.error('Export error:', err);
      showToast('Gagal mengekspor Vault.');
    }
  };

  // 2. Import Vault
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = JSON.parse(text);

      if (!imported.notes || !Array.isArray(imported.notes)) {
        showToast('Format file JSON tidak valid.');
        return;
      }

      let restoredNotes = 0;
      for (const note of imported.notes) {
        if (note.id && note.title) {
          await saveNote(note as NoteItem);
          restoredNotes++;
        }
      }

      if (imported.embeddings && Array.isArray(imported.embeddings)) {
        const embeddingsByNote = new Map<string, NoteChunkEmbedding[]>();
        for (const emb of imported.embeddings) {
          if (emb.noteId) {
            const list = embeddingsByNote.get(emb.noteId) || [];
            list.push(emb);
            embeddingsByNote.set(emb.noteId, list);
          }
        }

        for (const [nId, chunks] of embeddingsByNote.entries()) {
          await saveEmbeddings(nId, chunks);
        }
      }

      // Restore Insights if present
      if (imported.insights) {
        if (imported.insights.themes && Array.isArray(imported.insights.themes)) {
          await saveThemesToDb(imported.insights.themes);
        }
        if (imported.insights.connections && Array.isArray(imported.insights.connections)) {
          await saveConnectionsToDb(imported.insights.connections);
        }
        if (imported.insights.reflections && Array.isArray(imported.insights.reflections)) {
          await saveReflectionsToDb(imported.insights.reflections);
        }
        if (imported.insights.patterns && Array.isArray(imported.insights.patterns)) {
          await saveThinkingPatterns(imported.insights.patterns);
        }
        if (imported.insights.patternMeta) {
          await saveThinkingPatternMeta(imported.insights.patternMeta);
        }
        if (imported.insights.patternHistory && Array.isArray(imported.insights.patternHistory)) {
          await saveThinkingPatternHistory(imported.insights.patternHistory);
        }
        if (imported.insights.patternEmbeddings && Array.isArray(imported.insights.patternEmbeddings)) {
          for (const pEmb of imported.insights.patternEmbeddings) {
            await savePatternEmbedding(pEmb.id, pEmb.embedding);
          }
        }
      }

      // Restore Chat Threads if present
      let restoredChatThreads = 0;
      if (imported.chatThreads && Array.isArray(imported.chatThreads)) {
        try {
          const existingSaved = localStorage.getItem('noesis_v2_chat_threads');
          let existingThreads: any[] = [];
          if (existingSaved) {
            try { existingThreads = JSON.parse(existingSaved); } catch (_) {}
          }
          const threadMap = new Map<string, any>();
          existingThreads.forEach((t) => { if (t && t.id) threadMap.set(t.id, t); });
          imported.chatThreads.forEach((t: any) => { if (t && t.id) threadMap.set(t.id, t); });
          const mergedThreads = Array.from(threadMap.values());
          localStorage.setItem('noesis_v2_chat_threads', JSON.stringify(mergedThreads));
          restoredChatThreads = imported.chatThreads.length;
        } catch (e) {
          console.error('Failed to restore chat threads', e);
        }
      }

      // Restore AI Settings if present
      if (imported.aiSettings && typeof imported.aiSettings === 'object') {
        try {
          localStorage.setItem('noesis_v2_ai_settings', JSON.stringify(imported.aiSettings));
        } catch (e) {
          console.error('Failed to restore AI settings', e);
        }
      }

      await refreshVaultStats();
      const chatInfo = restoredChatThreads > 0 ? `, & ${restoredChatThreads} riwayat chat` : '';
      showToast(`Berhasil mengimpor ${restoredNotes} catatan, Insights${chatInfo}!`);
    } catch (err) {
      console.error('Import error:', err);
      showToast('Gagal mengimpor file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 3. Clear Sync Queue
  const handleConfirmClearCache = async () => {
    setShowClearConfirm(false);
    try {
      const db = await initNoesisDB();
      const tx = db.transaction(SYNC_QUEUE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SYNC_QUEUE_STORE_NAME);
      store.clear();

      localStorage.removeItem('noesis_last_synced_at');
      setLastSyncTime('Belum pernah');

      showToast('Sync queue & status sync berhasil dibersihkan.');
    } catch (err) {
      console.error('Clear cache error:', err);
      showToast('Gagal membersihkan sync queue.');
    }
  };

  // 3.5 Move All Notes to Trash
  const handleConfirmWipeData = async () => {
    if (wipeConfirmText.trim().toUpperCase() !== 'HAPUS') {
      showToast('Ketik HAPUS untuk mengonfirmasi.');
      return;
    }
    setShowWipeConfirm(false);
    setWipeConfirmText('');
    try {
      const notes = await getNotes();
      const activeNotes = notes.filter((n) => !n.deletedAt);
      
      if (activeNotes.length === 0) {
        showToast('Tidak ada catatan aktif untuk dipindahkan.');
        return;
      }

      for (const note of activeNotes) {
        await moveToTrash(note.id);
      }

      showToast('Semua catatan aktif berhasil dipindahkan ke Sampah.');
      await refreshVaultStats();
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      console.error('Move all to trash error:', err);
      showToast('Gagal memindahkan catatan ke Sampah.');
    }
  };

  // 4. Rebuild Local Index (RAG)
  const handleRebuildIndex = async () => {
    setIsRebuildingIndex(true);
    try {
      const notes = await getNotes();
      setRebuildProgress({ current: 0, total: notes.length });

      for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
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
        setRebuildProgress({ current: i + 1, total: notes.length });
      }

      await refreshVaultStats();
      showToast('Indeks RAG lokal berhasil diperbarui sepenuhnya!');
    } catch (err) {
      console.error('Rebuild index error:', err);
      showToast('Gagal membangun ulang indeks RAG.');
    } finally {
      setIsRebuildingIndex(false);
      setRebuildProgress(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end select-none">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Drawer Panel */}
      <div className="relative w-5/6 max-w-sm h-full bg-[#131313] border-l border-[#303030] flex flex-col z-10 shadow-2xl animate-in slide-in-from-right duration-250">
        {/* Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-[#303030] bg-[#1C1C1C]/50 shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-neutral-400" />
            <span className="font-semibold text-sm text-[#E5E5E5]">
              Vault Settings
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#1C1C1C] transition-colors cursor-pointer"
            aria-label="Tutup Pengaturan Vault"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
          {/* Toast Notification */}
          {toastMessage && (
            <div className="sticky top-0 z-20 bg-neutral-800/15 border border-neutral-500/40 text-neutral-400 px-3 py-2 rounded-xl text-center text-xs flex items-center justify-center gap-1.5 animate-in fade-in shadow-lg backdrop-blur-md">
              <Check className="w-3.5 h-3.5" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* ---------------- SECTION 1: CLOUD SYNC STATUS ---------------- */}
          <div className="bg-[#1C1C1C] border border-[#2F2F2F] rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-neutral-400" />
                <span className="font-semibold text-[#E5E5E5]">Cloud Sync Status</span>
              </div>
              {/* Status Badge */}
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                  connectionStatus === 'Connected'
                    ? 'text-neutral-300 bg-neutral-500/10 border-neutral-500/20'
                    : connectionStatus === 'Syncing'
                    ? 'text-neutral-400 bg-neutral-800/10 border-neutral-500/20 animate-pulse'
                    : connectionStatus === 'Error'
                    ? 'text-neutral-300 bg-neutral-500/10 border-neutral-500/20'
                    : 'text-[#A3A3A3] bg-[#2A2A2A] border-[#3F3F3F]'
                }`}
              >
                {connectionStatus === 'Connected' && <CheckCircle2 className="w-3 h-3" />}
                {connectionStatus === 'Syncing' && <RefreshCw className="w-3 h-3 animate-spin" />}
                {connectionStatus === 'Error' && <XCircle className="w-3 h-3" />}
                {connectionStatus === 'Offline' && <HardDrive className="w-3 h-3" />}
                {connectionStatus}
              </span>
            </div>

            {/* Cloud vs Local Comparison Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-2.5 flex flex-col justify-between">
                <div className="text-[#8E8E93] text-[10px] flex items-center gap-1 font-medium">
                  <Cloud className="w-3 h-3 text-neutral-400" />
                  <span>Notes di Cloud</span>
                </div>
                <div className="text-base font-bold text-[#E5E5E5] mt-1 font-mono">
                  {cloudNoteCount} <span className="text-[10px] font-normal text-[#737373]">catatan</span>
                </div>
              </div>

              <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-2.5 flex flex-col justify-between">
                <div className="text-[#8E8E93] text-[10px] flex items-center gap-1 font-medium">
                  <HardDrive className="w-3 h-3 text-neutral-400" />
                  <span>Notes di Lokal</span>
                </div>
                <div className="text-base font-bold text-[#E5E5E5] mt-1 font-mono">
                  {noteCount} <span className="text-[10px] font-normal text-[#737373]">catatan</span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-[#A3A3A3] space-y-1 bg-[#141414] p-2 rounded-lg border border-[#252525]">
              <div className="flex justify-between">
                <span>Terakhir Disinkron:</span>
                <span className="text-[#E5E5E5] font-mono text-[10px]">{lastSyncTime}</span>
              </div>
              <div className="flex justify-between">
                <span>Antrean Pending Sync:</span>
                <span className={`font-mono text-[10px] ${pendingQueueCount > 0 ? 'text-neutral-300 font-bold' : 'text-[#E5E5E5]'}`}>
                  {pendingQueueCount} item
                </span>
              </div>
            </div>

            {/* Last Sync Details Breakdown Card */}
            {lastSyncDetails && (
              <div className="bg-[#141414] border border-[#2B2B2B] rounded-lg p-2.5 space-y-2 text-[11px] animate-in fade-in">
                <div className="font-semibold text-[#E5E5E5] text-[11px] flex items-center justify-between">
                  <span>Rincian Hasil Sync Terakhir</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${lastSyncDetails.success ? 'bg-neutral-500/10 text-neutral-300 border border-neutral-500/20' : 'bg-neutral-500/10 text-neutral-300 border border-neutral-500/20'}`}>
                    {lastSyncDetails.success ? 'Berhasil Presisi' : 'Perlu Perhatian'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                  <div className="bg-[#1C1C1C] p-1.5 rounded border border-[#262626]">
                    <span className="text-[#8E8E93] block">Ditarik (Pulled)</span>
                    <span className="font-bold text-neutral-300 text-xs font-mono">+{lastSyncDetails.pulledCount}</span>
                  </div>
                  <div className="bg-[#1C1C1C] p-1.5 rounded border border-[#262626]">
                    <span className="text-[#8E8E93] block">Diunggah (Pushed)</span>
                    <span className="font-bold text-neutral-400 text-xs font-mono">+{lastSyncDetails.pushedCount}</span>
                  </div>
                  <div className="bg-[#1C1C1C] p-1.5 rounded border border-[#262626]">
                    <span className="text-[#8E8E93] block">Sisa Antrean</span>
                    <span className={`font-bold text-xs font-mono ${lastSyncDetails.queuedRemaining > 0 ? 'text-neutral-300' : 'text-[#A3A3A3]'}`}>
                      {lastSyncDetails.queuedRemaining}
                    </span>
                  </div>
                </div>
                {lastSyncDetails.errors.length > 0 && (
                  <div className="mt-1 p-2 bg-neutral-500/10 border border-neutral-500/20 rounded text-neutral-300 text-[10px] space-y-1">
                    <div className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-neutral-300 shrink-0" />
                      <span>Rincian Masalah:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-[9.5px]">
                      {lastSyncDetails.errors.map((err, idx) => (
                        <li key={idx} className="truncate">{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="flex-1 py-2 bg-[#E5E5E5] hover:bg-white text-[#111111] font-bold text-[11px] rounded-lg shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 stroke-[2.5] ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sync Now</span>
              </button>
              <button
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="py-2 px-3 bg-[#262626] hover:bg-[#303030] border border-[#363636] text-[#A3A3A3] hover:text-[#E5E5E5] font-medium text-[11px] rounded-lg flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                title="Coba Ulang Sinkronisasi"
              >
                Retry
              </button>
            </div>
          </div>

          {/* ---------------- SECTION 3: DATA MANAGEMENT ---------------- */}
          <div className="bg-[#1C1C1C] border border-[#2F2F2F] rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between font-semibold text-[#E5E5E5] mb-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-neutral-400" />
                <span>Data Management</span>
              </div>
              <span className="text-[10px] text-[#8E8E93] font-mono font-normal">
                Export / Import
              </span>
            </div>

            {/* Hidden File Input for Import */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".json"
              className="hidden"
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleExportVault}
                className="p-3 bg-[#141414] hover:bg-[#222222] border border-[#2B2B2B] rounded-lg flex flex-col items-center justify-center text-center transition-colors cursor-pointer group"
              >
                <Download className="w-4 h-4 text-neutral-400 group-hover:scale-110 transition-transform mb-1.5" />
                <div className="font-medium text-[11px] text-[#E5E5E5]">Export</div>
                <div className="text-[9px] text-[#8E8E93] mt-0.5">Cadangkan Vault, Insight & Chat</div>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 bg-[#141414] hover:bg-[#222222] border border-[#2B2B2B] rounded-lg flex flex-col items-center justify-center text-center transition-colors cursor-pointer group"
              >
                <Upload className="w-4 h-4 text-neutral-400 group-hover:scale-110 transition-transform mb-1.5" />
                <div className="font-medium text-[11px] text-[#E5E5E5]">Import</div>
                <div className="text-[9px] text-[#8E8E93] mt-0.5">Pulihkan semua data dari JSON</div>
              </button>
            </div>
          </div>

          {/* ---------------- SECTION: PEMBERSIHAN & OPTIMASI DATA (MAINTENANCE) ---------------- */}
          <div className="bg-[#1C1C1C] border border-[#2F2F2F] rounded-xl overflow-hidden transition-all">
            <button
              onClick={() => setIsMaintenanceOpen(!isMaintenanceOpen)}
              className="w-full p-3.5 flex items-center justify-between hover:bg-[#242424] transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-neutral-400" />
                <span className="font-semibold text-[#E5E5E5]">Optimasi Data</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-[#A3A3A3]">
                {isMaintenanceOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {isMaintenanceOpen && (
              <div className="p-3.5 border-t border-[#2A2A2A] space-y-2">
                {/* Action 1: Bersihkan Chunk & Vector Yatim */}
                <button
                  onClick={handleCleanOrphans}
                  disabled={isCleaningOrphans}
                  className="w-full py-2 px-3 bg-[#141414] hover:bg-[#222222] border border-[#2B2B2B] rounded-lg text-left transition-colors cursor-pointer flex items-center justify-between group disabled:opacity-50"
                >
                  <div>
                    <div className="font-medium text-[11px] text-[#E5E5E5] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-neutral-300" />
                      <span>Bersihkan Vector Embedding Yatim</span>
                    </div>
                    <div className="text-[9px] text-[#8E8E93] mt-0.5">
                      Pindai & hapus pecahan chunk/vector dari catatan yang sudah dihapus
                    </div>
                  </div>
                  {isCleaningOrphans && <RefreshCw className="w-3.5 h-3.5 text-neutral-300 animate-spin" />}
                </button>

                {/* Action 3: Rebuild Local Index */}
                <button
                  onClick={handleRebuildIndex}
                  disabled={isRebuildingIndex}
                  className="w-full py-2 px-3 bg-[#141414] hover:bg-[#222222] border border-[#2B2B2B] rounded-lg text-left transition-colors cursor-pointer flex items-center justify-between group disabled:opacity-50"
                >
                  <div>
                    <div className="font-medium text-[11px] text-[#E5E5E5] flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-neutral-300" />
                      <span>Rebuild & Optimasi Index Local RAG</span>
                    </div>
                    <div className="text-[9px] text-[#8E8E93] mt-0.5">
                      {rebuildProgress
                        ? `Proses: ${rebuildProgress.current} / ${rebuildProgress.total}`
                        : 'Proses ulang seluruh chunking & generate ulang embedding lokal'}
                    </div>
                  </div>
                  {isRebuildingIndex && <RefreshCw className="w-3.5 h-3.5 text-neutral-300 animate-spin" />}
                </button>
              </div>
            )}
          </div>

          {/* ---------------- SECTION 4: SUPABASE SETUP TUTORIAL ---------------- */}
          <div className="bg-[#1C1C1C] border border-[#2F2F2F] rounded-xl overflow-hidden transition-all">
            <button
              onClick={() => setIsTutorialOpen(!isTutorialOpen)}
              className="w-full p-3.5 flex items-center justify-between hover:bg-[#242424] transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-neutral-400" />
                <span className="font-semibold text-[#E5E5E5]">Setup Supabase</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-[#A3A3A3]">
                <span>Tutorial</span>
                {isTutorialOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {isTutorialOpen && (
              <div className="p-3.5 pt-0 border-t border-[#2A2A2A] space-y-3 mt-1 text-[11px] text-[#A3A3A3]">
                <div className="space-y-2 mt-2">
                  <div className="space-y-1">
                    <span className="font-semibold text-[#E5E5E5] block">Step 1: Project Baru</span>
                    <p className="text-[10px] text-[#8E8E93]">
                      Buka <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-neutral-400 underline">supabase.com</a> dan buat project database PostgreSQL baru.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="font-semibold text-[#E5E5E5] block">Step 2: SQL Editor</span>
                    <p className="text-[10px] text-[#8E8E93]">
                      Di dashboard Supabase, masuk ke menu <strong>SQL Editor</strong> &gt; <strong>New Query</strong>.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="font-semibold text-[#E5E5E5] block">Step 3: Jalankan Schema SQL</span>
                    <p className="text-[10px] text-[#8E8E93]">
                      Salin SQL Schema dibawah ini dan jalankan di SQL Editor Supabase untuk mengaktifkan pgvector dan tabel Noesis:
                    </p>
                    <button
                      onClick={handleCopySql}
                      className="w-full py-2 bg-[#E5E5E5] hover:bg-white text-[#111111] font-bold text-[11px] rounded-lg shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer mt-1"
                    >
                      {isSqlCopied ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : <Copy className="w-3.5 h-3.5 stroke-[2.5]" />}
                      <span>{isSqlCopied ? 'Schema Berhasil Disalin!' : 'Copy SQL Schema'}</span>
                    </button>
                  </div>

                  <div className="space-y-1">
                    <span className="font-semibold text-[#E5E5E5] block">Step 4: Environment Variables</span>
                    <p className="text-[10px] text-[#8E8E93]">
                      Tambahkan credential Supabase ke pengaturan Environment Variables di <strong>Cloudflare</strong>:
                    </p>
                    <div className="flex flex-col gap-1.5 mt-1">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText('VITE_SUPABASE_URL');
                          showToast('VITE_SUPABASE_URL disalin!');
                        }}
                        className="flex items-center justify-between w-full p-2 bg-[#141414] hover:bg-[#1C1C1C] border border-[#2B2B2B] rounded text-[10px] font-mono text-[#E5E5E5] transition-colors cursor-pointer"
                        title="Copy VITE_SUPABASE_URL"
                      >
                        <span>VITE_SUPABASE_URL</span>
                        <Copy className="w-3 h-3 text-neutral-400" />
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText('VITE_SUPABASE_ANON_KEY');
                          showToast('VITE_SUPABASE_ANON_KEY disalin!');
                        }}
                        className="flex items-center justify-between w-full p-2 bg-[#141414] hover:bg-[#1C1C1C] border border-[#2B2B2B] rounded text-[10px] font-mono text-[#E5E5E5] transition-colors cursor-pointer"
                        title="Copy VITE_SUPABASE_ANON_KEY"
                      >
                        <span>VITE_SUPABASE_ANON_KEY</span>
                        <Copy className="w-3 h-3 text-neutral-400" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="font-semibold text-[#E5E5E5] block">Step 5: Aktifkan Sync</span>
                    <p className="text-[10px] text-[#8E8E93]">
                      Klik tombol <strong>Sync Now</strong> di bagian atas setelah credential terpasang.
                    </p>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* ---------------- SECTION 5: DANGER ZONE (COLLAPSIBLE) ---------------- */}
          <div className="bg-[#1C1C1C] border border-neutral-500/40 rounded-xl overflow-hidden transition-all">
            <button
              onClick={() => setIsDangerZoneOpen(!isDangerZoneOpen)}
              className="w-full p-3.5 flex items-center justify-between hover:bg-[#251818] transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2 font-semibold text-neutral-300">
                <AlertTriangle className="w-4 h-4 text-neutral-300" />
                <span>Danger Zone</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-neutral-300/70">
                <span>Tindakan Sensitif</span>
                {isDangerZoneOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {isDangerZoneOpen && (
              <div className="p-3.5 border-t border-neutral-500/30 space-y-2">
                {/* Action 1: Clear Sync Queue */}
                <button
                  onClick={() => {
                    setShowClearConfirm(true);
                    setShowWipeConfirm(false);
                  }}
                  className="w-full py-2 px-3 bg-[#171717] hover:bg-[#232323] border border-neutral-500/30 text-neutral-300 rounded-lg text-left transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div>
                    <div className="font-medium text-[11px] flex items-center gap-1.5">
                      <Trash2 className="w-3.5 h-3.5 text-neutral-300" />
                      <span>Clear Sync Queue</span>
                    </div>
                    <div className="text-[9px] text-neutral-300/60 mt-0.5">Bersihkan queue antrean sinkronisasi lokal</div>
                  </div>
                </button>

                {/* Clear Confirm Dialog Overlay */}
                {showClearConfirm && (
                  <div className="p-3 bg-neutral-800 border border-neutral-300/30 rounded-lg space-y-2 animate-in fade-in">
                    <div className="flex items-center gap-1.5 text-neutral-300 font-semibold text-[11px]">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Konfirmasi Hapus Sync Queue?</span>
                    </div>
                    <p className="text-[10px] text-neutral-300/80 leading-relaxed">
                      Tindakan ini akan meriset queue antrean sinkronisasi lokal. Data catatan lokal Anda tetap aman di IndexedDB.
                    </p>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleConfirmClearCache}
                        className="flex-1 py-1.5 bg-neutral-300 hover:bg-white text-[#111111] font-bold text-[10px] rounded-md transition-colors cursor-pointer"
                      >
                        Ya, Bersihkan Sync Queue
                      </button>
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        className="py-1.5 px-3 bg-[#262626] hover:bg-[#303030] text-[#E5E5E5] font-medium text-[10px] rounded-md transition-colors cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}

                {/* Action 2: Move All Notes to Trash */}
                <button
                  onClick={() => {
                    setShowWipeConfirm(true);
                    setShowClearConfirm(false);
                    setWipeConfirmText('');
                  }}
                  className="w-full py-2 px-3 bg-[#232323] hover:bg-[#323232] border border-neutral-500/50 text-neutral-300 rounded-lg text-left transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div>
                    <div className="font-medium text-[11px] flex items-center gap-1.5">
                      <Trash2 className="w-3.5 h-3.5 text-neutral-300" />
                      <span>Pindahkan Semua Catatan ke Sampah</span>
                    </div>
                    <div className="text-[9px] text-neutral-300/60 mt-0.5">Memindahkan semua catatan lokal aktif ke folder sampah (Trash)</div>
                  </div>
                </button>

                {/* Wipe Confirm Dialog Overlay */}
                {showWipeConfirm && (
                  <div className="p-3 bg-neutral-800 border border-neutral-300/40 rounded-lg space-y-2.5 animate-in fade-in">
                    <div className="flex items-center gap-1.5 text-neutral-300 font-semibold text-[11px]">
                      <AlertTriangle className="w-4 h-4 text-neutral-300" />
                      <span>Pindahkan Semua Catatan ke Sampah?</span>
                    </div>
                    <p className="text-[10px] text-neutral-300/80 leading-relaxed">
                      Tindakan ini akan memindahkan semua catatan aktif ke folder Sampah. Anda masih dapat memulihkannya kembali dari menu Sampah jika diperlukan.
                    </p>
                    <div className="space-y-1.5">
                      <label className="text-[9px] text-neutral-300/80 block">
                        Ketik <strong className="text-white bg-neutral-500/60 px-1 py-0.5 rounded font-mono">HAPUS</strong> untuk melanjutkan:
                      </label>
                      <input
                        type="text"
                        value={wipeConfirmText}
                        onChange={(e) => setWipeConfirmText(e.target.value)}
                        placeholder="Ketik HAPUS..."
                        className="w-full bg-[#181818] border border-neutral-500/60 rounded px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-neutral-300 placeholder:text-neutral-300"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleConfirmWipeData}
                        disabled={wipeConfirmText.trim().toUpperCase() !== 'HAPUS'}
                        className="flex-1 py-1.5 bg-neutral-300 hover:bg-white disabled:opacity-40 disabled:hover:bg-neutral-300 text-[#111111] font-bold text-[10px] rounded-md transition-colors cursor-pointer"
                      >
                        Ya, Pindahkan ke Sampah
                      </button>
                      <button
                        onClick={() => {
                          setShowWipeConfirm(false);
                          setWipeConfirmText('');
                        }}
                        className="py-1.5 px-3 bg-[#262626] hover:bg-[#303030] text-[#E5E5E5] font-medium text-[10px] rounded-md transition-colors cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


