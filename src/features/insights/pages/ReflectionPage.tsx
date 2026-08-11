import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { Compass, Eye, HelpCircle, Lightbulb, Sparkles, Loader2, RefreshCw, AlertCircle, Trash2, ChevronDown, ChevronUp, FileText, Brain, Layers, ArrowRightLeft, ExternalLink } from 'lucide-react';
import { VaultHeader } from '../../vault/components/VaultHeader';
import { getNotes } from '../../vault/services/noteService';
import { NoteItem } from '../../vault/pages/VaultPage';
import { Reflection } from '../types/reflection';
import { reflectionService } from '../services/reflectionService';
import { useNavigation } from '../../../core/navigation';
import { getSavedThinkingPatterns } from '../services/thinkingPatternService';
import { themeService } from '../services/themeService';
import { connectionService } from '../services/connectionService';
import { ThinkingPattern } from '../types/thinkingPattern';
import { Theme } from '../types/theme';
import { Connection } from '../types/connection';

interface ReflectionPageProps {
  onBack?: () => void;
}

let savedReflectionScrollTop = 0;

export const ReflectionPage: React.FC<ReflectionPageProps> = ({ onBack }) => {
  const { navigate } = useNavigation();

  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [patterns, setPatterns] = useState<ThinkingPattern[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedReflectionId, setExpandedReflectionId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const isRestoringScrollRef = useRef<boolean>(true);

  useLayoutEffect(() => {
    if (loading) return;
    if (containerRef.current) {
      isRestoringScrollRef.current = true;
      containerRef.current.scrollTop = savedReflectionScrollTop;
      const raf = requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = savedReflectionScrollTop;
        }
        const timer = setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = savedReflectionScrollTop;
          }
          isRestoringScrollRef.current = false;
        }, 50);
        return () => clearTimeout(timer);
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [loading]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (loading || isRestoringScrollRef.current) return;
    savedReflectionScrollTop = e.currentTarget.scrollTop;
  };

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [
          fetchedNotes,
          savedReflections,
          fetchedThemes,
          fetchedConnections,
          fetchedPatterns
        ] = await Promise.all([
          getNotes(),
          reflectionService.getSavedReflections(),
          themeService.getSavedThemes().catch(() => []),
          connectionService.getSavedConnections().catch(() => []),
          getSavedThinkingPatterns().catch(() => []),
        ]);

        if (!isMounted) return;

        setNotes(fetchedNotes || []);
        setReflections(savedReflections || []);
        setThemes(fetchedThemes || []);
        setConnections(fetchedConnections || []);
        setPatterns(fetchedPatterns || []);

        if (savedReflections.length > 0) {
          setExpandedReflectionId(savedReflections[0].id);
        }
      } catch (err: any) {
        console.error('Gagal memuat data awal Reflection:', err);
        if (isMounted) {
          setError('Gagal memuat data catatan, refleksi, atau klaster pengetahuan.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleGenerateReflections = async () => {
    setGenerating(true);
    setError(null);
    try {
      const generated = await reflectionService.generateReflections(notes);
      setReflections(generated);
      if (generated.length > 0) {
        setExpandedReflectionId(generated[0].id);
      }
    } catch (err: any) {
      console.error('Gagal membuat refleksi:', err);
      setError(err?.message || 'Terjadi kesalahan saat membuat analisis refleksi.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteReflection = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await reflectionService.deleteReflection(id);
      setReflections((prev) => prev.filter((r) => r.id !== id));
      if (expandedReflectionId === id) {
        setExpandedReflectionId(null);
      }
    } catch (err) {
      console.error('Gagal menghapus refleksi:', err);
      setError('Gagal menghapus catatan refleksi.');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedReflectionId((prev) => (prev === id ? null : id));
  };

  const getNoteTitle = (noteId: string) => {
    const note = notes.find((n) => n.id === noteId);
    return note ? (note.title || 'Catatan Tanpa Judul') : 'Catatan';
  };

  const getTypeBadgeLabel = (type?: string) => {
    switch (type) {
      case 'creative_reflection':
        return 'Creative Connection';
      case 'pattern_reflection':
        return 'Cognitive Pattern';
      case 'growth_reflection':
        return 'Knowledge Growth';
      case 'tension_reflection':
        return 'Cognitive Tension';
      default:
        return 'Cognitive Pattern';
    }
  };

  const getTypeBadgeStyle = (type?: string) => {
    switch (type) {
      case 'creative_reflection':
        return 'bg-[#131313] text-[#E5E5E5] border-[#2A2A2A]';
      case 'pattern_reflection':
        return 'bg-[#131313] text-[#E5E5E5] border-[#2A2A2A]';
      case 'growth_reflection':
        return 'bg-[#131313] text-[#E5E5E5] border-[#2A2A2A]';
      case 'tension_reflection':
        return 'bg-[#131313] text-[#E5E5E5] border-[#2A2A2A]';
      default:
        return 'bg-[#131313] text-[#E5E5E5] border-[#2A2A2A]';
    }
  };

  const renderRelatedKnowledge = (refl: Reflection) => {
    // 1. Related Patterns
    const relatedPatterns = patterns.filter(p => 
      p.relatedNoteIds && p.relatedNoteIds.some(noteId => refl.relatedNoteIds.includes(noteId))
    );

    // 2. Related Themes
    const relatedThemes = themes.filter(t => 
      refl.relatedThemeIds.includes(t.id)
    );

    // 3. Related Connections
    const relatedConns = connections.filter(c => 
      refl.relatedConnectionIds.includes(c.id)
    );

    const hasAnyRelation = relatedPatterns.length > 0 || relatedThemes.length > 0 || relatedConns.length > 0;

    if (!hasAnyRelation) return null;

    return (
      <div className="space-y-2 pt-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-300 uppercase tracking-wider">
          <ArrowRightLeft className="w-3.5 h-3.5 text-neutral-300" />
          <span>Terhubung Dengan</span>
        </div>
        <div className="flex flex-col gap-1.5 bg-[#1C1C1C] border border-[#2A2A2A] rounded-xl p-3">
          {relatedPatterns.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate({ tab: 'insight', insightViewState: 'pattern' })}
              className="flex items-center justify-between w-full p-2 rounded-lg bg-[#181818] hover:bg-[#242424] border border-[#2A2A2A] text-left text-xs transition-all active:scale-[0.99] group cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Brain className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                <span className="text-neutral-300 font-medium truncate">{p.title}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#131313] text-[#E5E5E5] border border-[#2A2A2A]">Pola</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-300 transition-colors -rotate-90 shrink-0" />
            </button>
          ))}

          {relatedThemes.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate({ tab: 'insight', insightViewState: 'themes' })}
              className="flex items-center justify-between w-full p-2 rounded-lg bg-[#181818] hover:bg-[#242424] border border-[#2A2A2A] text-left text-xs transition-all active:scale-[0.99] group cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Layers className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                <span className="text-neutral-300 font-medium truncate">{t.title}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#131313] text-[#E5E5E5] border border-[#2A2A2A]">Tema</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-300 transition-colors -rotate-90 shrink-0" />
            </button>
          ))}

          {relatedConns.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => navigate({
                tab: 'insight',
                insightViewState: 'connectionDetail',
                connectionId: c.id,
              })}
              className="flex items-center justify-between w-full p-2 rounded-lg bg-[#181818] hover:bg-[#242424] border border-[#2A2A2A] text-left text-xs transition-all active:scale-[0.99] group cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <ArrowRightLeft className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                <span className="text-neutral-300 font-medium truncate">{c.title}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#131313] text-[#E5E5E5] border border-[#2A2A2A]">Hubungan</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-300 transition-colors -rotate-90 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none animate-fadeIn bg-[#131313] text-[#E5E5E5]">
      {/* Self-contained Header */}
      <VaultHeader onBack={onBack} />

      {/* Scrollable Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-5 flex flex-col max-w-lg mx-auto w-full pb-24 space-y-5"
      >
        {/* Module Banner Header */}
        <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#242424] border border-[#303030] flex items-center justify-center text-[#E5E5E5] shadow-xs">
              <Compass className="w-5.5 h-5.5 stroke-[1.75] text-[#E5E5E5]" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-[#E5E5E5] tracking-tight">
                Reflection Core
              </h1>
              <p className="text-xs text-[#A3A3A3] mt-0.5 leading-relaxed">
                Ruang refleksi kognitif untuk menghubungkan ide & pemikiran.
              </p>
            </div>
          </div>

          {reflections.length > 0 && (
            <button
              onClick={handleGenerateReflections}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#242424] hover:bg-[#2C2C2C] text-xs font-semibold text-[#E5E5E5] border border-[#333333] transition-all cursor-pointer disabled:opacity-50 active:scale-95 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#A3A3A3] ${generating ? 'animate-spin' : ''}`} />
              <span>{generating ? 'Menganalisis...' : 'Analisis Baru'}</span>
            </button>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-[#181818] border border-[#282828] text-[#A3A3A3] text-xs flex items-start gap-2.5 shadow-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#E5E5E5] mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Main Body */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#E5E5E5] mb-3" />
            <p className="text-sm font-medium text-[#E5E5E5]">Mengakses Engine Refleksi...</p>
            <p className="text-xs text-[#A3A3A3] mt-1">Menyelaraskan data IndexedDB lokal</p>
          </div>
        ) : reflections.length === 0 ? (
          /* Empty State */
          <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-2xl p-7 text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-[#242424] border border-[#303030] flex items-center justify-center text-[#E5E5E5] mx-auto shadow-xs">
              <Sparkles className="w-7 h-7 text-[#E5E5E5]" />
            </div>
            <div className="space-y-1.5 max-w-xs mx-auto">
              <h2 className="text-sm font-bold text-[#E5E5E5]">
                Belum Ada Refleksi Terbentuk
              </h2>
              <p className="text-xs text-[#A3A3A3] leading-relaxed">
                Reflection Engine akan menganalisis benang merah antar-pengetahuan secara semantik untuk menyajikan sudut pandang baru.
              </p>
            </div>

            <button
              onClick={handleGenerateReflections}
              disabled={generating}
              className="flex items-center justify-center gap-2 w-full max-w-xs mx-auto py-2.5 px-4 rounded-xl bg-[#E5E5E5] hover:bg-white text-[#111111] font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#111111]" />
                  <span>Menganalisis Hubungan Pengetahuan...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#111111]" />
                  <span>Jalankan Reflection Engine</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Reflections list in accordion layout */
          <div className="space-y-3.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
                Refleksi Tersimpan ({reflections.length})
              </span>
            </div>

            {reflections.map((refl) => {
              const isExpanded = expandedReflectionId === refl.id;
              return (
                <div
                  key={refl.id}
                  className={`bg-[#1C1C1C] border transition-all duration-200 rounded-2xl shadow-sm ${
                    isExpanded ? 'border-[#383838] bg-[#1E1E1E]' : 'border-[#2A2A2A] hover:border-[#383838] hover:bg-[#202020]'
                  }`}
                >
                  {/* Header click bar */}
                  <div
                    onClick={() => toggleExpand(refl.id)}
                    className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                        isExpanded ? 'bg-[#282828] border-[#3E3E3E] text-white' : 'bg-[#242424] border-[#303030] text-[#E5E5E5]'
                      }`}>
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <h3 className="text-xs sm:text-sm font-bold text-[#E5E5E5] group-hover:text-white truncate pr-2">
                          {refl.title}
                        </h3>
                        <div className="flex items-center gap-1 mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${getTypeBadgeStyle(refl.type)}`}>
                            {getTypeBadgeLabel(refl.type)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteReflection(refl.id, e)}
                        className="p-1.5 rounded-lg text-[#8E8E93] hover:text-white hover:bg-[#282828] transition-all active:scale-95 cursor-pointer"
                        title="Hapus refleksi"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <div className="text-[#8E8E93]">
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-[#8E8E93]" />}
                      </div>
                    </div>
                  </div>

                  {/* Body expansion */}
                  {isExpanded && (
                    <div className="px-4 pb-5 pt-1 border-t border-[#2A2A2A] space-y-4 animate-fadeIn">
                      
                      {/* Reflection Type display inside detail */}
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getTypeBadgeStyle(refl.type)}`}>
                          {getTypeBadgeLabel(refl.type)}
                        </span>
                      </div>

                      {/* Observasi Kognitif */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#8E8E93] uppercase tracking-wider">
                          <Eye className="w-3.5 h-3.5 text-[#8E8E93]" />
                          <span>Observasi Kognitif</span>
                        </div>
                        <div className="bg-[#181818] border border-[#282828] rounded-xl p-3 text-xs text-[#CCCCCC] leading-relaxed">
                          {refl.observation}
                        </div>
                      </div>

                      {/* Dasar Pembentukan Refleksi */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#8E8E93] uppercase tracking-wider">
                          <Layers className="w-3.5 h-3.5 text-[#8E8E93]" />
                          <span>Dasar Pembentukan Refleksi</span>
                        </div>
                        <div className="bg-[#181818] border border-[#282828] rounded-xl p-3 text-xs text-[#CCCCCC] leading-relaxed space-y-2">
                          <p className="text-[#E5E5E5] font-semibold text-[11px]">Refleksi ini terbentuk dari hubungan beberapa catatan:</p>
                          <p className="text-[#A3A3A3] italic pl-2 border-l-2 border-[#383838] leading-relaxed">
                            {refl.formationBasis || 'Refleksi ini dibentuk berdasarkan klaster informasi dan hubungan semantis yang terdeteksi di Vault Anda.'}
                          </p>
                        </div>
                      </div>

                      {/* Pertanyaan Induktif */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#8E8E93] uppercase tracking-wider">
                          <HelpCircle className="w-3.5 h-3.5 text-[#8E8E93]" />
                          <span>Pertanyaan Induktif</span>
                        </div>
                        <div className="bg-[#181818] border border-l-2 border-l-[#FF9500] border-y-[#282828] border-r-[#282828] rounded-xl p-3 text-xs text-[#E5E5E5] font-semibold leading-relaxed">
                          "{refl.question}"
                        </div>
                      </div>

                      {/* Terhubung Dengan */}
                      {renderRelatedKnowledge(refl)}

                      {/* Catatan Terkait */}
                      {refl.relatedNoteIds && refl.relatedNoteIds.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">
                            <FileText className="w-3 h-3" />
                            <span>Catatan Terkait ({refl.relatedNoteIds.length})</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {refl.relatedNoteIds.map((noteId) => (
                              <div
                                key={noteId}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#181818] border border-[#282828] text-[10px] text-[#CCCCCC]"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
                                <span className="truncate max-w-[150px] font-medium">{getNoteTitle(noteId)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="text-[9px] text-[#737373] pt-1 flex justify-between items-center">
                        <span>Refl-ID: {refl.id.split('_').slice(-2).join('_')}</span>
                        <span>Dibuat: {new Date(refl.createdAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};


