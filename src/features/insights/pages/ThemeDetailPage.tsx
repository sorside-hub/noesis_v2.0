import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { Theme } from '../types/theme';
import { themeService } from '../services/themeService';
import { connectionService } from '../services/connectionService';
import { Connection } from '../types/connection';
import { NoteItem } from '../../vault/pages/VaultPage';
import { getNotes } from '../../vault/services/noteService';
import { VaultHeader } from '../../vault/components/VaultHeader';
import { useNavigation } from '../../../core/navigation';
import { formatDateToDMY } from '../../../shared/utils/dateUtils';
import {
  Layers,
  FileText,
  Activity,
  Clock,
  Tag,
  Sparkles,
  AlertCircle,
  Loader2,
  ExternalLink,
  ArrowRight,
  ChevronDown,
  Compass,
  Key,
  ArrowRightLeft,
} from 'lucide-react';

const savedThemeDetailScrollTop: Record<string, number> = {};
const savedThemeExpandedStates: Record<
  string,
  { isNotesExpanded: boolean; isConceptsExpanded: boolean; isConnectionsExpanded: boolean }
> = {};

interface ThemeDetailPageProps {
  themeId?: string | null;
  theme?: Theme | null;
  onBack: () => void;
}

export const ThemeDetailPage: React.FC<ThemeDetailPageProps> = ({
  themeId,
  theme: initialTheme,
  onBack,
}) => {
  const { navigate } = useNavigation();
  const [theme, setTheme] = useState<Theme | null>(initialTheme || null);
  const [relatedNotes, setRelatedNotes] = useState<NoteItem[]>([]);
  const [relatedConnections, setRelatedConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState<boolean>(!initialTheme);
  const [error, setError] = useState<string | null>(null);

  const effectiveThemeId = themeId || theme?.id || 'default';

  const initialExpandedState = savedThemeExpandedStates[effectiveThemeId] || {
    isNotesExpanded: false,
    isConceptsExpanded: false,
    isConnectionsExpanded: true,
  };

  // Collapsible section states (folded/collapsed by default)
  const [isNotesExpanded, setIsNotesExpanded] = useState<boolean>(
    initialExpandedState.isNotesExpanded
  );
  const [isConceptsExpanded, setIsConceptsExpanded] = useState<boolean>(
    initialExpandedState.isConceptsExpanded
  );
  const [isConnectionsExpanded, setIsConnectionsExpanded] = useState<boolean>(
    initialExpandedState.isConnectionsExpanded ?? true
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const isRestoringScrollRef = useRef<boolean>(true);

  // Preserve expanded states per theme ID
  useEffect(() => {
    if (effectiveThemeId) {
      savedThemeExpandedStates[effectiveThemeId] = {
        isNotesExpanded,
        isConceptsExpanded,
        isConnectionsExpanded,
      };
    }
  }, [effectiveThemeId, isNotesExpanded, isConceptsExpanded, isConnectionsExpanded]);

  // Reset scroll restoration flag when theme ID changes
  useEffect(() => {
    isRestoringScrollRef.current = true;
  }, [effectiveThemeId]);

  // Restore scroll position when theme ID, loading state, or expanded sections change
  useLayoutEffect(() => {
    if (loading) return;
    const savedTop = savedThemeDetailScrollTop[effectiveThemeId] || 0;
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
  }, [effectiveThemeId, loading, isNotesExpanded, isConceptsExpanded, isConnectionsExpanded]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (loading || isRestoringScrollRef.current) return;
    if (effectiveThemeId) {
      savedThemeDetailScrollTop[effectiveThemeId] = e.currentTarget.scrollTop;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadThemeData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [savedThemes, allNotes, savedConnections] = await Promise.all([
          themeService.getSavedThemes(),
          getNotes(),
          connectionService.getSavedConnections().catch(() => []),
        ]);

        if (!isMounted) return;

        // Find theme from IndexedDB by themeId if not provided in props
        const foundTheme =
          initialTheme ||
          savedThemes.find((t) => t.id === themeId) ||
          savedThemes[0] ||
          null;

        if (!foundTheme) {
          setError('Data Theme tidak ditemukan di IndexedDB.');
          setLoading(false);
          return;
        }

        setTheme(foundTheme);

        // Filter related notes for simple topic extraction & reference
        const notesMap = new Map((allNotes || []).map((n) => [n.id, n]));
        const matchedNotes = (foundTheme.relatedNoteIds || [])
          .map((id) => notesMap.get(id))
          .filter((n): n is NoteItem => n !== undefined);

        setRelatedNotes(matchedNotes);

        // Filter connections associated with this theme
        const matchedConnections = (savedConnections || []).filter(
          (c) =>
            (c.sourceType === 'theme' && c.sourceIds.includes(foundTheme.id)) ||
            (c.targetType === 'theme' && c.targetIds.includes(foundTheme.id))
        );
        setRelatedConnections(matchedConnections);
      } catch (err: any) {
        console.error('Gagal memuat detail Theme:', err);
        if (isMounted) {
          setError('Terjadi kesalahan saat memuat data Theme dari penyimpanan lokal.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadThemeData();

    return () => {
      isMounted = false;
    };
  }, [themeId, initialTheme]);

  const formatDateTime = (ts?: number) => {
    return formatDateToDMY(ts);
  };

  const getStrengthBadge = (strength: number) => {
    const percent = Math.min(100, Math.round(strength * 100));

    if (strength >= 0.75) {
      return {
        label: `Sangat Kuat (${percent}%)`,
        bgColor: 'bg-[#1C1C1C]',
        borderColor: 'border-[#2A2A2A]',
        textColor: 'text-neutral-300',
      };
    } else if (strength >= 0.5) {
      return {
        label: `Moderat (${percent}%)`,
        bgColor: 'bg-[#1C1C1C]',
        borderColor: 'border-[#2A2A2A]',
        textColor: 'text-neutral-300',
      };
    } else {
      return {
        label: `Berkembang (${percent}%)`,
        bgColor: 'bg-[#1C1C1C]',
        borderColor: 'border-[#2A2A2A]',
        textColor: 'text-neutral-300',
      };
    }
  };

  // Extract simple related topics/tags from related notes without any AI calls
  const extractedTopics = Array.from(
    new Set(
      relatedNotes
        .flatMap((n) => [
          ...(n.tags || []),
          n.category ? n.category : null,
        ])
        .filter((t): t is string => Boolean(t) && t.trim().length > 0)
    )
  ).slice(0, 8);

  // Extract Key Concepts from related notes metadata (Phase 3)
  const keyConcepts = React.useMemo(() => {
    if (!relatedNotes || relatedNotes.length === 0) return [];

    const stopwords = new Set([
      'dan', 'atau', 'di', 'ke', 'dari', 'yang', 'untuk', 'pada', 'dengan', 'adalah',
      'ini', 'itu', 'sebagai', 'secara', 'serta', 'oleh', 'dalam', 'tentang', 'bukan',
      'a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about',
      'catatan', 'note', 'notes', 'tanpa', 'judul', 'draft', 'untitled'
    ]);

    const conceptMap = new Map<string, { name: string; noteIds: Set<string>; type: 'tag' | 'category' | 'keyword' }>();

    relatedNotes.forEach((note) => {
      // 1. Tags
      if (Array.isArray(note.tags)) {
        note.tags.forEach((tag) => {
          const clean = tag.trim().toLowerCase().replace(/^#/, '');
          if (clean.length > 1) {
            const key = `tag:${clean}`;
            if (!conceptMap.has(key)) {
              conceptMap.set(key, { name: `#${clean}`, noteIds: new Set(), type: 'tag' });
            }
            conceptMap.get(key)!.noteIds.add(note.id);
          }
        });
      }

      // 2. Category
      if (note.category && typeof note.category === 'string') {
        const catName = note.category.trim();
        if (catName.length > 1) {
          const key = `cat:${catName.toLowerCase()}`;
          if (!conceptMap.has(key)) {
            conceptMap.set(key, { name: catName, noteIds: new Set(), type: 'category' });
          }
          conceptMap.get(key)!.noteIds.add(note.id);
        }
      }

      // 3. Title keywords
      if (note.title) {
        const words = note.title.toLowerCase().match(/[a-zA-Z0-9_áéíóúâêîôûñ]+/g) || [];
        words.forEach((w) => {
          if (w.length >= 3 && !stopwords.has(w) && !/^\d+$/.test(w)) {
            const key = `kw:${w}`;
            const capitalized = w.charAt(0).toUpperCase() + w.slice(1);
            if (!conceptMap.has(key)) {
              conceptMap.set(key, { name: capitalized, noteIds: new Set(), type: 'keyword' });
            }
            conceptMap.get(key)!.noteIds.add(note.id);
          }
        });
      }
    });

    const totalNotes = relatedNotes.length;
    const items = Array.from(conceptMap.values()).map((item) => {
      const noteCount = item.noteIds.size;
      const ratio = totalNotes > 0 ? noteCount / totalNotes : 0;
      const percentage = Math.min(100, Math.round(ratio * 100));

      let occurrenceLabel = 'Konteks Pendukung';
      let badgeStyle = 'bg-[#1C1C1C] text-neutral-300 border-[#2A2A2A]';

      if (ratio >= 0.6) {
        occurrenceLabel = 'Konsep Dominan';
        badgeStyle = 'bg-[#1C1C1C] text-neutral-300 border-[#2A2A2A]';
      } else if (ratio >= 0.3) {
        occurrenceLabel = 'Sering Muncul';
        badgeStyle = 'bg-[#1C1C1C] text-neutral-300 border-[#2A2A2A]';
      }

      return {
        name: item.name,
        type: item.type,
        noteCount,
        percentage,
        occurrenceLabel,
        badgeStyle,
      };
    });

    // Sort by noteCount desc
    items.sort((a, b) => b.noteCount - a.noteCount || b.percentage - a.percentage);

    return items.slice(0, 6);
  }, [relatedNotes]);

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
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="w-7 h-7 animate-spin text-neutral-300 mb-3" />
            <p className="text-sm font-medium text-neutral-300">Memuat Detail Theme...</p>
            <p className="text-xs text-neutral-300 mt-1">Mengambil data dari IndexedDB lokal</p>
          </div>
        ) : error || !theme ? (
          <div className="p-4 rounded-xl bg-[#1C1C1C] border border-[#2A2A2A] text-neutral-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 text-neutral-300" />
            <span>{error || 'Theme tidak ditemukan.'}</span>
          </div>
        ) : (
          <>
            {/* Theme Header & Overview Card */}
            <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-2xl p-5 shadow-md space-y-4">
              {/* Category Badge & Strength Indicator */}
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md bg-[#1C1C1C] text-neutral-300 border border-[#2A2A2A]">
                  <Layers className="w-3 h-3 text-neutral-300" />
                  <span>Semantic Theme</span>
                </span>

                {/* Strength Indicator */}
                {(() => {
                  const badge = getStrengthBadge(theme.strength);
                  return (
                    <div
                      className={`px-2.5 py-0.5 rounded-full border text-[10px] font-semibold flex items-center gap-1 ${badge.bgColor} ${badge.borderColor} ${badge.textColor}`}
                    >
                      <Activity className="w-3 h-3" />
                      <span>{badge.label}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Theme Title */}
              <h1 className="text-lg sm:text-xl font-bold text-neutral-300 leading-snug tracking-tight">
                {theme.title}
              </h1>

              {/* Theme Description */}
              {theme.description && (
                <div className="p-3.5 rounded-xl bg-[#1C1C1C] border border-[#2A2A2A] space-y-1">
                  <p className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider">
                    Ringkasan Tema
                  </p>
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    {theme.description}
                  </p>
                </div>
              )}

              {/* Metrics Grid Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                {/* Note Count */}
                <div className="p-3 rounded-xl bg-[#1C1C1C] border border-[#2A2A2A] flex flex-col items-center justify-center text-center space-y-1">
                  <span className="text-[10px] text-neutral-300 flex items-center justify-center gap-1">
                    <FileText className="w-3 h-3 text-neutral-300" />
                    <span>Catatan Terkait</span>
                  </span>
                  <span className="text-sm font-bold text-neutral-300">
                    {theme.noteCount || (theme.relatedNoteIds ? theme.relatedNoteIds.length : 0)} Notes
                  </span>
                </div>

                {/* Strength Score */}
                <div className="p-3 rounded-xl bg-[#1C1C1C] border border-[#2A2A2A] flex flex-col items-center justify-center text-center space-y-1">
                  <span className="text-[10px] text-neutral-300 flex items-center justify-center gap-1">
                    <Activity className="w-3 h-3 text-neutral-300" />
                    <span>Strength Score</span>
                  </span>
                  <span className="text-sm font-bold text-neutral-300">
                    {Math.round(theme.strength * 100)}%
                  </span>
                </div>

                {/* Created Date */}
                <div className="p-3 rounded-xl bg-[#1C1C1C] border border-[#2A2A2A] flex flex-col items-center justify-center text-center space-y-1 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-neutral-300 flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3 text-neutral-300" />
                    <span>Terbentuk Pada</span>
                  </span>
                  <span className="text-xs font-bold text-neutral-300">
                    {formatDateTime(theme.createdAt)}
                  </span>
                </div>
              </div>

              {/* Related Topics Sederhana */}
              {extractedTopics.length > 0 && (
                <div className="pt-2 border-t border-[#2A2A2A] space-y-2">
                  <p className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1">
                    <Tag className="w-3 h-3 text-neutral-300" />
                    Topik & Konteks Terkait
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {extractedTopics.map((topic) => (
                      <span
                        key={topic}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#1C1C1C] border border-[#2A2A2A] text-[11px] font-medium text-neutral-300"
                      >
                        #{topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Note List Snippet Overview (Collapsible, folded by default) */}
            {relatedNotes.length > 0 && (
              <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-2xl p-4 transition-all space-y-3">
                <button
                  type="button"
                  onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                  className="w-full flex items-center justify-between text-left group cursor-pointer focus:outline-none"
                >
                  <h2 className="text-xs font-bold text-neutral-300 group-hover:text-neutral-300 uppercase tracking-wider flex items-center gap-1.5 transition-colors">
                    <FileText className="w-3.5 h-3.5 text-neutral-300" />
                    Catatan Dalam Cluster Tema ({relatedNotes.length})
                  </h2>
                  <ChevronDown
                    className={`w-4 h-4 text-neutral-300 group-hover:text-neutral-300 transition-transform duration-200 ${
                      isNotesExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isNotesExpanded && (
                  <div className="space-y-2 pt-2 border-t border-[#2A2A2A] animate-fadeIn">
                    {relatedNotes.map((note) => (
                      <div
                        key={note.id}
                        onClick={() => navigate({ tab: 'vault', vaultViewState: 'detail', noteId: note.id })}
                        className="p-3 rounded-xl bg-[#1C1C1C] hover:bg-[#242424] border border-[#2A2A2A] hover:border-[#2A2A2A] transition-all cursor-pointer flex items-center justify-between gap-3 group"
                      >
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs font-semibold text-neutral-300 group-hover:text-neutral-300 transition-colors truncate">
                            {note.title || 'Catatan Tanpa Judul'}
                          </h3>
                          {note.content && (
                            <p className="text-[11px] text-neutral-300 truncate mt-0.5">
                              {note.content.slice(0, 80)}
                            </p>
                          )}
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-300 transition-colors shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Key Concepts Section (Collapsible, folded by default) */}
            {keyConcepts.length > 0 && (
              <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-2xl p-4 transition-all space-y-3">
                <button
                  type="button"
                  onClick={() => setIsConceptsExpanded(!isConceptsExpanded)}
                  className="w-full flex items-center justify-between text-left group cursor-pointer focus:outline-none"
                >
                  <h2 className="text-xs font-bold text-neutral-300 group-hover:text-neutral-300 uppercase tracking-wider flex items-center gap-1.5 transition-colors">
                    <Key className="w-3.5 h-3.5 text-neutral-300" />
                    Konsep Utama Tema ({keyConcepts.length})
                  </h2>
                  <ChevronDown
                    className={`w-4 h-4 text-neutral-300 group-hover:text-neutral-300 transition-transform duration-200 ${
                      isConceptsExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isConceptsExpanded && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[#2A2A2A] animate-fadeIn">
                    {keyConcepts.map((concept, idx) => (
                      <div
                        key={`${concept.name}_${idx}`}
                        className="p-3 rounded-xl bg-[#1C1C1C] border border-[#2A2A2A] hover:border-[#2A2A2A] transition-all flex flex-col justify-between gap-2"
                      >
                        {/* Name & Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-neutral-300 truncate max-w-[140px]">
                            {concept.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[9px] font-semibold whitespace-nowrap ${concept.badgeStyle}`}
                          >
                            {concept.occurrenceLabel}
                          </span>
                        </div>

                        {/* Frequency Bar & Note Count */}
                        <div className="space-y-1 pt-1 border-t border-[#2A2A2A]">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-neutral-300">Kemunculan</span>
                            <span className="font-medium text-neutral-300">
                              {concept.noteCount} / {relatedNotes.length} Note ({concept.percentage}%)
                            </span>
                          </div>
                          {/* Progress Indicator */}
                          <div className="w-full h-1.5 bg-[#1C1C1C] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-neutral-500 to-neutral-400 rounded-full transition-all duration-300"
                              style={{ width: `${Math.max(10, concept.percentage)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Related Connections Section */}
            {relatedConnections.length > 0 && (
              <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-2xl p-4 transition-all space-y-3">
                <button
                  type="button"
                  onClick={() => setIsConnectionsExpanded(!isConnectionsExpanded)}
                  className="w-full flex items-center justify-between text-left group cursor-pointer focus:outline-none"
                >
                  <h2 className="text-xs font-bold text-neutral-300 group-hover:text-neutral-300 uppercase tracking-wider flex items-center gap-1.5 transition-colors">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-neutral-300" />
                    Keterkaitan Semantik ({relatedConnections.length})
                  </h2>
                  <ChevronDown
                    className={`w-4 h-4 text-neutral-300 group-hover:text-neutral-300 transition-transform duration-200 ${
                      isConnectionsExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isConnectionsExpanded && (
                  <div className="space-y-2 pt-2 border-t border-[#2A2A2A] animate-fadeIn">
                    {relatedConnections.map((conn) => (
                      <div
                        key={conn.id}
                        onClick={() =>
                          navigate({
                            tab: 'insight',
                            insightViewState: 'connectionDetail',
                            connectionId: conn.id,
                          })
                        }
                        className="p-3 rounded-xl bg-[#1C1C1C] hover:bg-[#242424] border border-[#2A2A2A] hover:border-[#2A2A2A] transition-all cursor-pointer flex items-center justify-between gap-3 group"
                      >
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs font-semibold text-neutral-300 group-hover:text-neutral-300 transition-colors truncate">
                            {conn.title}
                          </h3>
                          {conn.description && (
                            <p className="text-[11px] text-neutral-300 truncate mt-0.5">
                              {conn.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-neutral-300 font-semibold bg-[#1C1C1C] px-2 py-0.5 rounded border border-[#2A2A2A]">
                            {Math.round(conn.strength * 100)}%
                          </span>
                          <ExternalLink className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-300 transition-colors" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
