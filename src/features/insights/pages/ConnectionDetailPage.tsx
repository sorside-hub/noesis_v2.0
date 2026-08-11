import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import {
  ArrowRightLeft,
  Layers,
  FileText,
  Activity,
  Calendar,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Info,
} from 'lucide-react';
import { VaultHeader } from '../../vault/components/VaultHeader';
import { getSavedConnectionsFromDb, getSavedThemesFromDb } from '../../../core/database/indexedDb';
import { getNotes } from '../../vault/services/noteService';
import { Connection } from '../types/connection';
import { Theme } from '../types/theme';
import { NoteItem } from '../../vault/pages/VaultPage';
import { useNavigation } from '../../../core/navigation';
import { formatDateToDMY } from '../../../shared/utils/dateUtils';

interface ConnectionDetailPageProps {
  connectionId?: string | null;
  onBack?: () => void;
}

interface ResolvedEntity {
  id: string;
  type: 'theme' | 'note';
  title: string;
  description?: string;
  category?: string;
  noteCount?: number;
  originalNote?: NoteItem;
  originalTheme?: Theme;
}

const savedConnectionDetailScrollTop: Record<string, number> = {};

export const ConnectionDetailPage: React.FC<ConnectionDetailPageProps> = ({
  connectionId,
  onBack,
}) => {
  const { navigate } = useNavigation();

  const [connection, setConnection] = useState<Connection | null>(null);
  const [sourceEntities, setSourceEntities] = useState<ResolvedEntity[]>([]);
  const [targetEntities, setTargetEntities] = useState<ResolvedEntity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const effectiveConnectionId = connectionId || connection?.id || 'default';

  const containerRef = useRef<HTMLDivElement | null>(null);
  const isRestoringScrollRef = useRef<boolean>(true);

  // Reset scroll restoration flag when connection ID changes
  useEffect(() => {
    isRestoringScrollRef.current = true;
  }, [effectiveConnectionId]);

  // Restore scroll position when connection ID or loading state changes
  useLayoutEffect(() => {
    if (loading) return;
    const savedTop = savedConnectionDetailScrollTop[effectiveConnectionId] || 0;
    if (containerRef.current) {
      isRestoringScrollRef.current = true;
      containerRef.current.scrollTop = savedTop;

      const raf1 = requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = savedTop;
        }
        const timer = setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = savedTop;
          }
          isRestoringScrollRef.current = false;
        }, 60);
        return () => clearTimeout(timer);
      });

      return () => cancelAnimationFrame(raf1);
    }
  }, [effectiveConnectionId, loading]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (loading || isRestoringScrollRef.current) return;
    if (effectiveConnectionId) {
      savedConnectionDetailScrollTop[effectiveConnectionId] = e.currentTarget.scrollTop;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      try {
        const [allConnections, allThemes, allNotes] = await Promise.all([
          getSavedConnectionsFromDb(),
          getSavedThemesFromDb().catch(() => []),
          getNotes().catch(() => []),
        ]);

        if (!isMounted) return;

        const targetConn = allConnections.find((c) => c.id === connectionId);
        if (!targetConn) {
          setConnection(null);
          setLoading(false);
          return;
        }

        setConnection(targetConn);

        // Map Source Entities
        const resolvedSources: ResolvedEntity[] = targetConn.sourceIds.map((id) => {
          if (targetConn.sourceType === 'theme') {
            const theme = allThemes.find((t) => t.id === id);
            return {
              id,
              type: 'theme',
              title: theme ? theme.title : `Tema (${id.substring(0, 8)})`,
              description: theme ? theme.description : undefined,
              noteCount: theme ? (theme.relatedNoteIds?.length || theme.noteCount || 0) : 0,
              originalTheme: theme,
            };
          } else {
            const note = allNotes.find((n) => n.id === id);
            return {
              id,
              type: 'note',
              title: note ? note.title : `Catatan (${id.substring(0, 8)})`,
              category: note ? note.category : 'Umum',
              originalNote: note,
            };
          }
        });

        // Map Target Entities
        const resolvedTargets: ResolvedEntity[] = targetConn.targetIds.map((id) => {
          if (targetConn.targetType === 'theme') {
            const theme = allThemes.find((t) => t.id === id);
            return {
              id,
              type: 'theme',
              title: theme ? theme.title : `Tema (${id.substring(0, 8)})`,
              description: theme ? theme.description : undefined,
              noteCount: theme ? (theme.relatedNoteIds?.length || theme.noteCount || 0) : 0,
              originalTheme: theme,
            };
          } else {
            const note = allNotes.find((n) => n.id === id);
            return {
              id,
              type: 'note',
              title: note ? note.title : `Catatan (${id.substring(0, 8)})`,
              category: note ? note.category : 'Umum',
              originalNote: note,
            };
          }
        });

        setSourceEntities(resolvedSources);
        setTargetEntities(resolvedTargets);
      } catch (err) {
        console.error('Gagal memuat detail koneksi:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (connectionId) {
      loadData();
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [connectionId]);

  const handleOpenNote = (noteId: string) => {
    navigate({
      tab: 'vault',
      vaultViewState: 'detail',
      noteId,
    });
  };

  const handleOpenTheme = (themeId: string) => {
    navigate({
      tab: 'insight',
      insightViewState: 'themes',
      themeId,
    });
  };

  const strengthPercent = connection ? Math.round(connection.strength * 100) : 0;
  const isBridge = connection?.connectionType === 'theme_bridge';

  const formattedDate = connection?.createdAt
    ? formatDateToDMY(connection.createdAt)
    : '-';

  const sourceTitlesText = sourceEntities.map((e) => e.title).join(', ') || 'Entitas Sumber';
  const targetTitlesText = targetEntities.map((e) => e.title).join(', ') || 'Entitas Target';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none animate-fadeIn">
      {/* Header */}
      <VaultHeader onBack={onBack} />

      {/* Main Content Area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-5 flex flex-col max-w-lg mx-auto w-full pb-24 space-y-5"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-300">
            <div className="w-8 h-8 border-2 border-[#2A2A2A] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-medium">Memuat Detail Koneksi...</p>
          </div>
        ) : !connection ? (
          <div className="p-6 rounded-2xl bg-[#1C1C1C] border border-[#2A2A2A] text-center space-y-3 my-10">
            <Info className="w-8 h-8 text-neutral-300 mx-auto" />
            <h3 className="text-sm font-bold text-neutral-300">Detail Koneksi Tidak Ditemukan</h3>
            <p className="text-xs text-neutral-300">
              Koneksi yang Anda pilih mungkin telah diperbarui atau dihapus dari IndexedDB.
            </p>
            {onBack && (
              <button
                onClick={onBack}
                className="px-4 py-2 rounded-xl bg-[#1C1C1C] text-xs font-medium text-neutral-300 hover:bg-[#242424] transition"
              >
                Kembali ke Daftar Koneksi
              </button>
            )}
          </div>
        ) : (
          <>
            {/* 1. CONNECTION HEADER */}
            <div className="p-5 rounded-2xl bg-[#1C1C1C] border border-[#2A2A2A] space-y-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#1C1C1C] border border-[#2A2A2A] flex items-center justify-center shrink-0 mt-0.5">
                    <ArrowRightLeft className="w-4 h-4 text-neutral-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-base font-bold text-neutral-300 leading-snug">
                      {connection.title}
                    </h1>
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-300 mt-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formattedDate}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Badges Bar */}
              <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-[#2A2A2A]">
                {/* Type Badge */}
                {isBridge ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1C1C1C] text-neutral-300 border border-[#2A2A2A]/25 text-xs font-semibold">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Theme Bridge</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1C1C1C] text-neutral-300 border border-[#2A2A2A]/25 text-xs font-semibold">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Theme Evidence</span>
                  </span>
                )}

                {/* Strength Percentage */}
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1C1C1C] border border-[#2A2A2A] text-neutral-300 text-xs font-semibold">
                  <Activity className="w-3.5 h-3.5" />
                  <span>Kekuatan Semantik: {strengthPercent}%</span>
                </span>
              </div>

              {/* Description */}
              <div className="space-y-1.5 pt-1">
                <h4 className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider">
                  Deskripsi Keterkaitan
                </h4>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  {connection.description}
                </p>
              </div>
            </div>

            {/* 2. MENGAPA KETERKAITAN INI DITEMUKAN */}
            <div className="p-5 rounded-2xl bg-[#1C1C1C] border border-[#2A2A2A] space-y-5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#1C1C1C] border border-[#2A2A2A] flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-neutral-300" />
                </div>
                <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                  Mengapa Keterkaitan Ini Ditemukan
                </h3>
              </div>

              {/* 1. Ringkasan Alasan Semantik */}
              <div className="space-y-1.5 p-3.5 rounded-xl bg-[#1C1C1C] border border-[#2A2A2A]">
                <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider block">
                  Ringkasan Alasan Semantik
                </span>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  {connection.reasoning || connection.description || 'Koneksi ini ditemukan berdasarkan kemiripan pola semantik dan keterkaitan topik dalam himpunan catatan Anda.'}
                </p>
              </div>

              {/* 2. Bukti Sumber Data (Unified Visual Flow) */}
              <div className="space-y-3 pt-2 border-t border-[#2A2A2A]/80">
                <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider block">
                  Bukti Sumber Data
                </span>

                <div className="flex flex-col gap-0 py-1">
                  {/* Konsep Awal */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block px-1">
                      Konsep Awal
                    </span>
                    <div className="space-y-2">
                      {sourceEntities.map((entity) => (
                        <EntityCard
                          key={entity.id}
                          entity={entity}
                          onOpenNote={handleOpenNote}
                          onOpenTheme={handleOpenTheme}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Flow Connector */}
                  <div className="flex flex-col items-center my-3">
                    <div className="w-0.5 h-3.5 bg-[#1C1C1C]/40" />
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1C1C1C] border border-[#2A2A2A] text-neutral-300 text-[11px] font-bold shadow-sm my-1">
                      <Activity className="w-3.5 h-3.5 text-neutral-300" />
                      <span>{strengthPercent}% Kekuatan Semantik</span>
                    </div>
                    <div className="w-0.5 h-3.5 bg-[#1C1C1C]/40" />
                  </div>

                  {/* Konsep Terkait */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block px-1">
                      Konsep Terkait
                    </span>
                    <div className="space-y-2">
                      {targetEntities.map((entity) => (
                        <EntityCard
                          key={entity.id}
                          entity={entity}
                          onOpenNote={handleOpenNote}
                          onOpenTheme={handleOpenTheme}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Sub-component to render individual Theme or Note entity card
interface EntityCardProps {
  entity: ResolvedEntity;
  onOpenNote: (noteId: string) => void;
  onOpenTheme: (themeId: string) => void;
}

const EntityCard: React.FC<EntityCardProps> = ({
  entity,
  onOpenNote,
  onOpenTheme,
}) => {
  if (entity.type === 'theme') {
    return (
      <div
        onClick={() => onOpenTheme(entity.id)}
        className="group p-4 rounded-xl bg-[#1C1C1C] hover:bg-[#242424] border border-[#2A2A2A] hover:border-[#2A2A2A] transition cursor-pointer flex items-center justify-between gap-3 shadow-sm"
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-[#1C1C1C] border border-[#2A2A2A] flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-[#242424]/20 transition">
            <Layers className="w-4 h-4 text-neutral-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-neutral-300 group-hover:text-neutral-300 transition leading-snug truncate">
              {entity.title}
            </h4>
            {entity.description && (
              <p className="text-[11px] text-neutral-300 line-clamp-2 mt-1 leading-relaxed">
                {entity.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-neutral-300 font-medium inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1C1C1C] border border-[#2A2A2A]">
                <FileText className="w-3 h-3 text-neutral-300" />
                <span>{entity.noteCount || 0} Catatan Pembentuk Theme</span>
              </span>
              <span className="text-[10px] text-neutral-300 font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                Lihat Detail <ExternalLink className="w-2.5 h-2.5" />
              </span>
            </div>
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-300 group-hover:translate-x-0.5 transition shrink-0" />
      </div>
    );
  }

  // Note type
  return (
    <div
      onClick={() => onOpenNote(entity.id)}
      className="group p-4 rounded-xl bg-[#1C1C1C] hover:bg-[#242424] border border-[#2A2A2A] hover:border-[#2A2A2A] transition cursor-pointer flex items-center justify-between gap-3 shadow-sm"
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-lg bg-[#1C1C1C] border border-[#2A2A2A] flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-[#242424]/20 transition">
          <FileText className="w-4 h-4 text-neutral-300" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-neutral-300 group-hover:text-neutral-300 transition leading-snug truncate">
            {entity.title}
          </h4>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-neutral-300 px-2 py-0.5 rounded-md bg-[#1C1C1C] border border-[#2A2A2A]">
              Kategori: {entity.category || 'Umum'}
            </span>
            <span className="text-[10px] text-neutral-300 font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
              Lihat Catatan <ExternalLink className="w-2.5 h-2.5" />
            </span>
          </div>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-300 group-hover:translate-x-0.5 transition shrink-0" />
    </div>
  );
};
