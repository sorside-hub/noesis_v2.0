import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { ThinkingPattern, ThinkingPatternHistoryRecord } from '../types/thinkingPattern';
import { NoteItem } from '../../vault/pages/VaultPage';
import { getNotes } from '../../vault/services/noteService';
import { getThinkingPatternHistory } from '../services/thinkingPatternService';
import { MarkdownRenderer } from '../../../shared/components/MarkdownRenderer';
import { useNavigation } from '../../../core/navigation';
import { formatDateToDMY } from '../../../shared/utils/dateUtils';
import { VaultHeader } from '../../vault/components/VaultHeader';
import {
  ArrowLeft,
  Brain,
  Layers,
  Hash,
  Activity,
  Clock,
  Repeat,
  FileText,
  Sparkles,
  ArrowDown,
  Loader2,
  Link2,
  ChevronDown,
  ChevronUp,
  Network,
  ArrowUpDown,
  GitMerge,
  Compass,
  History,
  TrendingUp,
  CircleDot,
  ExternalLink,
} from 'lucide-react';

const savedPatternDetailScrollTop: Record<string, number> = {};
const savedPatternExpandedStates: Record<
  string,
  { isEvidenceExpanded: boolean; isRelationshipExpanded: boolean; isTimelineExpanded: boolean }
> = {};

interface ThinkingPatternDetailPageProps {
  pattern: ThinkingPattern;
  onBack: () => void;
}

export const ThinkingPatternDetailPage: React.FC<ThinkingPatternDetailPageProps> = ({
  pattern,
  onBack,
}) => {
  const { navigate } = useNavigation();
  const [allNotes, setAllNotes] = useState<NoteItem[]>([]);
  const [loadingNotes, setLoadingNotes] = useState<boolean>(true);
  const [historyRecords, setHistoryRecords] = useState<ThinkingPatternHistoryRecord[]>([]);

  const initialExpandedState = savedPatternExpandedStates[pattern.id] || {
    isEvidenceExpanded: false,
    isRelationshipExpanded: false,
    isTimelineExpanded: false,
  };

  const [isEvidenceExpanded, setIsEvidenceExpanded] = useState<boolean>(
    initialExpandedState.isEvidenceExpanded
  );
  const [isRelationshipExpanded, setIsRelationshipExpanded] = useState<boolean>(
    initialExpandedState.isRelationshipExpanded
  );
  const [isTimelineExpanded, setIsTimelineExpanded] = useState<boolean>(
    initialExpandedState.isTimelineExpanded
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const isRestoringScrollRef = useRef<boolean>(true);

  // Preserve expanded states
  useEffect(() => {
    savedPatternExpandedStates[pattern.id] = {
      isEvidenceExpanded,
      isRelationshipExpanded,
      isTimelineExpanded,
    };
  }, [pattern.id, isEvidenceExpanded, isRelationshipExpanded, isTimelineExpanded]);

  // Reset scroll restoration flag when pattern changes
  useEffect(() => {
    isRestoringScrollRef.current = true;
  }, [pattern.id]);

  // Restore scroll position when pattern ID, loading state, or expanded sections change
  useLayoutEffect(() => {
    if (loadingNotes) return;
    const savedTop = savedPatternDetailScrollTop[pattern.id] || 0;
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
  }, [
    pattern.id,
    loadingNotes,
    isEvidenceExpanded,
    isRelationshipExpanded,
    isTimelineExpanded,
  ]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (loadingNotes || isRestoringScrollRef.current) return;
    savedPatternDetailScrollTop[pattern.id] = e.currentTarget.scrollTop;
  };

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [fetchedNotes, history] = await Promise.all([
          getNotes(),
          getThinkingPatternHistory(),
        ]);
        if (isMounted) {
          setAllNotes(fetchedNotes);
          const matchingHistory = history.filter(
            (h) =>
              h.patternId === pattern.id ||
              (pattern.previousPatternId &&
                (h.patternId === pattern.previousPatternId || h.id === pattern.previousPatternId))
          );
          matchingHistory.sort((a, b) => a.createdAt - b.createdAt);
          setHistoryRecords(matchingHistory);
        }
      } catch (err) {
        console.error('Gagal memuat data catatan & riwayat pola:', err);
      } finally {
        if (isMounted) {
          setLoadingNotes(false);
        }
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [pattern.id, pattern.previousPatternId]);

  const formatDateTime = (ts?: number) => {
    if (!ts) return '-';
    const date = new Date(ts);
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStrengthBadge = (strength: 'Strong' | 'Moderate' | 'Weak' | string) => {
    switch (strength) {
      case 'Strong':
      case 'Sangat Kuat':
      case 'Kuat':
        return {
          label: 'Kuat',
          bgColor: 'bg-[#1C1C1C]',
          borderColor: 'border-[#2A2A2A]',
          textColor: 'text-neutral-300',
        };
      case 'Moderate':
      case 'Moderat':
      case 'Sedang':
        return {
          label: 'Moderat',
          bgColor: 'bg-[#1C1C1C]',
          borderColor: 'border-[#2A2A2A]',
          textColor: 'text-neutral-300',
        };
      default:
        return {
          label: 'Ringan',
          bgColor: 'bg-[#1C1C1C]',
          borderColor: 'border-[#2A2A2A]',
          textColor: 'text-neutral-300',
        };
    }
  };

  const stripMarkdown = (text: string) => {
    if (!text) return '';
    return text
      .replace(/#+\s+/g, '')
      .replace(/\[\[(.*?)\]\]/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/`{1,3}.*?`{1,3}/g, '')
      .replace(/[\*_~]/g, '')
      .trim();
  };

  const badge = getStrengthBadge(pattern.evidenceStrength);
  const evidenceCount = pattern.evidenceCount || (pattern.relatedNoteIds ? pattern.relatedNoteIds.length : 0);
  const topicCount = pattern.relatedTopicCount || 0;
  const occurrenceCount = pattern.occurrenceCount || 1;
  const lastDetectedAt = pattern.lastDetectedAt || pattern.createdAt;

  // Match and preserve order of related note IDs
  const notesMap = new Map(allNotes.map((n) => [n.id, n]));
  const orderedRelatedNotes = (pattern.relatedNoteIds || [])
    .map((id) => notesMap.get(id))
    .filter((n): n is NoteItem => n !== undefined);

  // Helper to sanitize reasoning text from technical IDs and raw noise, and format paragraphs & note titles
  const cleanReasoningText = (reasoningText?: string): string => {
    if (!reasoningText) return '';

    let cleaned = reasoningText;

    // First replace note IDs with formatted Note Title
    notesMap.forEach((note, id) => {
      if (!id || id.length < 2) return;
      const title = note.title ? note.title.trim() : 'Catatan';
      const formattedTitle = `***"${title}"***`;
      const escapedId = id.replace(/[-[\]{}()*+?#\\^$|#\s]/g, '\\$&');

      // (ID: note-123), ID: note-123, ID note-123
      cleaned = cleaned.replace(new RegExp(`\\(?\\b(?:ID|id|Id):?\\s*${escapedId}\\)?`, 'gi'), '');
      // [[note-123]] or [note-123]
      cleaned = cleaned.replace(new RegExp(`\\[{1,2}${escapedId}\\]{1,2}`, 'gi'), formattedTitle);
    });

    // Highlight direct occurrences of note titles in text if not already formatted
    orderedRelatedNotes.forEach((note) => {
      if (note.title && note.title.trim().length > 2) {
        const title = note.title.trim();
        if (cleaned.includes(title) && !cleaned.includes(`"${title}"`) && !cleaned.includes(`**${title}**`)) {
          const escapedTitle = title.replace(/[-[\]{}()*+?#\\^$|#\s]/g, '\\$&');
          cleaned = cleaned.replace(new RegExp(`\\b${escapedTitle}\\b`, 'g'), `***"${title}"***`);
        }
      }
    });

    // Remove remaining generic technical ID strings
    cleaned = cleaned
      .replace(/\(?\b(?:ID|id|Id|ID Catatan|Id Catatan):?\s*[\w-]+\)?/gi, '')
      .replace(/\[(?:note|id)-[a-zA-Z0-9_-]+\]/gi, '')
      .replace(/\b(?:note|id)-[a-zA-Z0-9_-]{4,}\b/gi, '');

    // Clean up empty braces, brackets, orphaned punctuation
    cleaned = cleaned
      .replace(/\(\s*\)/g, '')
      .replace(/\[\s*\]/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([.,;:!?])/g, '$1')
      .trim();

    // Improve Paragraph Formatting
    // Format numbered list items or bullet points onto separate paragraphs
    cleaned = cleaned.replace(/(\d+\.\s+)/g, '\n\n$1');
    cleaned = cleaned.replace(/([•\-*]\s+)/g, '\n\n$1');

    // If there are no newlines at all, split into structured paragraphs
    if (!cleaned.includes('\n')) {
      const sentences = cleaned.split(/(?<=\.)\s+/);
      if (sentences.length >= 2) {
        const paragraphs: string[] = [];
        for (let i = 0; i < sentences.length; i += 2) {
          paragraphs.push(sentences.slice(i, i + 2).join(' '));
        }
        cleaned = paragraphs.join('\n\n');
      }
    } else {
      // Normalize multi-newlines to double newlines for clean spacing
      cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    }

    return cleaned.trim();
  };

  // Connection logic helper
  const getConnectionReason = (n1: NoteItem, n2: NoteItem): string => {
    if (n1.outgoingLinks?.includes(n2.id) || n2.outgoingLinks?.includes(n1.id)) {
      return 'terhubung langsung via pranala wikilink';
    }

    const tags1 = n1.tags || [];
    const tags2 = n2.tags || [];
    const sharedTag = tags1.find((t) => tags2.includes(t));
    if (sharedTag) {
      return `terhubung melalui konteks #${sharedTag}`;
    }

    if (n1.category && n1.category === n2.category) {
      const catLabel =
        n1.category === 'world'
          ? 'Dunia / Pengetahuan'
          : n1.category === 'self'
          ? 'Diri / Refleksi'
          : 'Ide / Kreasi';
      return `membahas ranah ${catLabel} yang saling terkait`;
    }

    return `memperkuat sintesis ide dengan ${n2.title || 'catatan berikutnya'}`;
  };

  // Relationship Map Data Builder
  interface IdeaPair {
    conceptA: string;
    conceptB: string;
    noteAId?: string;
    noteBId?: string;
    strength: 'Strong' | 'Moderate' | 'Weak';
    similarityScore: number;
    relationType: string;
  }

  const getRelationshipPairs = (): IdeaPair[] => {
    if (orderedRelatedNotes.length >= 2) {
      const pairs: IdeaPair[] = [];
      for (let i = 0; i < orderedRelatedNotes.length - 1; i++) {
        const n1 = orderedRelatedNotes[i];
        const n2 = orderedRelatedNotes[i + 1];

        let score = 0.78;
        let strength: 'Strong' | 'Moderate' | 'Weak' = 'Moderate';
        let relType = 'Keterkaitan Konsep & Frasa';

        if (n1.outgoingLinks?.includes(n2.id) || n2.outgoingLinks?.includes(n1.id)) {
          score = 0.94;
          strength = 'Strong';
          relType = 'Pranala Wikilink Langsung';
        } else {
          const tags1 = n1.tags || [];
          const tags2 = n2.tags || [];
          const sharedTag = tags1.find((t) => tags2.includes(t));
          if (sharedTag) {
            score = 0.88;
            strength = 'Strong';
            relType = `Konteks #${sharedTag}`;
          } else if (n1.category && n1.category === n2.category) {
            score = 0.81;
            strength = 'Moderate';
            relType = `Ranah Kategori ${n1.category.toUpperCase()}`;
          }
        }

        pairs.push({
          conceptA: n1.title || 'Catatan ' + (i + 1),
          conceptB: n2.title || 'Catatan ' + (i + 2),
          noteAId: n1.id,
          noteBId: n2.id,
          strength,
          similarityScore: score,
          relationType: relType,
        });
      }
      return pairs;
    } else if (orderedRelatedNotes.length === 1) {
      const n = orderedRelatedNotes[0];
      const tags = n.tags || [];
      const firstTag = tags[0] ? `#${tags[0]}` : n.category?.toUpperCase() || 'Refleksi Meta';
      return [
        {
          conceptA: pattern.title,
          conceptB: `${n.title || 'Catatan Utama'} (${firstTag})`,
          noteBId: n.id,
          strength: 'Strong',
          similarityScore: 0.89,
          relationType: 'Sintesis Utama Pola',
        },
      ];
    }

    return [
      {
        conceptA: pattern.title,
        conceptB: `Analisis Topik (${pattern.relatedTopicCount || 1} Ranah Konsep)`,
        strength: pattern.evidenceStrength === 'Strong' ? 'Strong' : 'Moderate',
        similarityScore: 0.84,
        relationType: 'Asosiasi Semantik AI',
      },
    ];
  };

  const relationshipPairs = getRelationshipPairs();

  // Extract main topics for "How Noesis Found This"
  const extractedTags = Array.from(
    new Set(orderedRelatedNotes.flatMap((n) => n.tags || []).filter(Boolean))
  ).slice(0, 5);

  const displayedTopics =
    extractedTags.length > 0
      ? extractedTags
      : [
          pattern.title.split(' ')[0] || 'Gagasan Utama',
          'Sistem Pengetahuan',
          'Koneksi Antar Catatan',
        ];

  const totalAnalyzedNotesCount =
    allNotes.length > 0 ? allNotes.length : orderedRelatedNotes.length || 1;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
      {/* Self-contained Header */}
      <VaultHeader onBack={onBack} />

      {/* Scrollable Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-5 flex flex-col max-w-lg mx-auto w-full pb-20 space-y-5"
      >
      {/* SECTION 1: Detail Header */}
      <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-2xl p-5 shadow-md space-y-4">
        {/* Title */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-[#1C1C1C] text-neutral-300 border border-[#2A2A2A]">
              Pola Pemikiran
            </span>
            <div className={`px-2.5 py-0.5 rounded-full border text-[10px] font-semibold flex items-center gap-1 ${badge.bgColor} ${badge.borderColor} ${badge.textColor}`}>
              <Activity className="w-3 h-3" />
              <span>{badge.label}</span>
            </div>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-neutral-300 leading-snug tracking-tight">
            {pattern.title}
          </h1>
        </div>

        {/* Description */}
        {pattern.description && (
          <p className="text-xs text-neutral-300 leading-relaxed bg-[#1C1C1C] border border-[#2A2A2A] p-3.5 rounded-xl">
            {pattern.description}
          </p>
        )}

        {/* Grid Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
          {/* Evidence Count */}
          <div className="p-3 rounded-xl bg-[#1C1C1C] border border-[#2A2A2A] flex flex-col items-center justify-center text-center space-y-1">
            <span className="text-[10px] text-neutral-300 flex items-center justify-center gap-1">
              <Layers className="w-3 h-3 text-neutral-300" />
              <span>Evidence Count</span>
            </span>
            <span className="text-sm font-bold text-neutral-300">
              {evidenceCount} Notes
            </span>
          </div>

          {/* Related Topic Count */}
          <div className="p-3 rounded-xl bg-[#1C1C1C] border border-[#2A2A2A] flex flex-col items-center justify-center text-center space-y-1">
            <span className="text-[10px] text-neutral-300 flex items-center justify-center gap-1">
              <Hash className="w-3 h-3 text-neutral-300" />
              <span>Related Topics</span>
            </span>
            <span className="text-sm font-bold text-neutral-300">
              {topicCount} Topik
            </span>
          </div>

          {/* Occurrence Count */}
          <div className="p-3 rounded-xl bg-[#1C1C1C] border border-[#2A2A2A] flex flex-col items-center justify-center text-center space-y-1 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-neutral-300 flex items-center justify-center gap-1">
              <Repeat className="w-3 h-3 text-neutral-300" />
              <span>Occurrence Count</span>
            </span>
            <span className="text-sm font-bold text-neutral-300">
              {occurrenceCount}x Terdeteksi
            </span>
          </div>
        </div>

        {/* Footer Info: Last detected */}
        <div className="flex items-center justify-between text-[11px] text-neutral-300 pt-2 border-t border-[#2A2A2A]">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-neutral-300" />
            <span>Terakhir Terdeteksi:</span>
          </span>
          <span className="font-medium text-neutral-300">
            {formatDateTime(lastDetectedAt)}
          </span>
        </div>
      </div>

      {/* SECTION 2: Evidence Explorer */}
      <div className="space-y-3 pt-1">
        {/* Unified Section Header & Interactive Fold Card */}
        <div
          onClick={() => setIsEvidenceExpanded((prev) => !prev)}
          className="sticky top-0 z-10 bg-[#1C1C1C] hover:bg-[#242424] border border-[#2A2A2A] hover:border-[#2A2A2A] rounded-2xl p-3.5 cursor-pointer transition-all duration-200 shadow-md group"
        >
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="p-2 rounded-xl bg-[#1C1C1C] border border-[#2A2A2A] text-neutral-300 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-neutral-300 group-hover:text-neutral-300 transition-colors truncate">
                Evidence Explorer
              </h2>
            </div>

            <div className="shrink-0 p-1">
              {isEvidenceExpanded ? (
                <ChevronUp className="w-4 h-4 text-neutral-300" />
              ) : (
                <ChevronDown className="w-4 h-4 text-neutral-300 group-hover:text-neutral-300 transition-colors" />
              )}
            </div>
          </div>
        </div>

        {/* Expanded Content View */}
        {isEvidenceExpanded && (
          <div className="space-y-3.5 animate-fadeIn">
            {/* AI Reasoning Synthesis Callout */}
            {pattern.reasoning && (
              <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-2xl p-4 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b border-[#2A2A2A] pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-neutral-300">
                    <div className="p-1.5 rounded-lg bg-[#1C1C1C] border border-[#2A2A2A]">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <span>Penalaran Keterkaitan AI</span>
                  </div>
                  <span className="text-[10px] font-semibold text-neutral-300 bg-[#1C1C1C] px-2 py-0.5 rounded-md border border-[#2A2A2A]">
                    Sintesis Konteks
                  </span>
                </div>
                <div className="text-xs text-neutral-300 leading-relaxed pt-0.5">
                  <MarkdownRenderer
                    content={cleanReasoningText(pattern.reasoning)}
                    allNotes={allNotes}
                  />
                </div>
              </div>
            )}

            {/* Loading State */}
            {loadingNotes ? (
              <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-2xl p-6 flex items-center justify-center gap-2 text-xs text-neutral-300">
                <Loader2 className="w-4 h-4 animate-spin text-neutral-300" />
                <span>Memuat data bukti catatan...</span>
              </div>
            ) : orderedRelatedNotes.length === 0 ? (
              <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-2xl p-5 text-center text-xs text-neutral-300">
                Tidak ada catatan bukti aktif yang cocok dengan ID pada pola ini.
              </div>
            ) : (
              /* Evidence Note Chain Visual Flow */
              <div className="relative space-y-3">
                {orderedRelatedNotes.map((note, index) => {
                  const nextNote = orderedRelatedNotes[index + 1];
                  const connectionInfo = nextNote ? getConnectionReason(note, nextNote) : null;

                  return (
                    <React.Fragment key={note.id}>
                      {/* Note Card */}
                      <div
                        onClick={() => navigate({ tab: 'vault', vaultViewState: 'detail', noteId: note.id })}
                        className="bg-[#1C1C1C] hover:bg-[#242424] border border-[#2A2A2A] hover:border-[#2A2A2A] rounded-2xl p-4 space-y-2.5 shadow-sm transition-all cursor-pointer group"
                      >
                        {/* Note Card Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-[#1C1C1C] border border-[#2A2A2A] text-neutral-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {index + 1}
                            </span>
                            <h3 className="text-sm font-bold text-neutral-300 group-hover:text-neutral-300 transition-colors truncate">
                              {note.title || 'Tanpa Judul'}
                            </h3>
                            <ExternalLink className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-300 transition-colors shrink-0 opacity-80" />
                          </div>
                          <span className="text-[10px] uppercase font-semibold text-neutral-300 bg-[#1C1C1C] border border-[#2A2A2A] px-2 py-0.5 rounded-md shrink-0">
                            {note.category}
                          </span>
                        </div>

                        {/* Excerpt */}
                        <p className="text-xs text-neutral-300 line-clamp-3 leading-relaxed pl-7">
                          {stripMarkdown(note.content) || 'Tidak ada isi teks pada catatan ini.'}
                        </p>

                        {/* Tags & Reason why this note connects */}
                        <div className="pl-7 pt-1 flex flex-wrap items-center justify-between gap-2 text-[10px] text-neutral-300">
                          {note.tags && note.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {note.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-neutral-300 bg-[#1C1C1C] px-1.5 py-0.5 rounded border border-[#2A2A2A]"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-neutral-300">
                              <Link2 className="w-3 h-3 text-neutral-300" />
                              <span>Catatan Bukti #{index + 1}</span>
                            </div>
                          )}
                          <span className="text-[10px] text-neutral-300 font-medium shrink-0">
                            {formatDateToDMY(note.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Visual Connection Node between Notes */}
                      {nextNote && (
                        <div className="flex flex-col items-center justify-center my-0.5">
                          <div className="w-0.5 h-3 bg-[#1C1C1C]" />
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#1C1C1C] border border-[#2A2A2A] rounded-full text-[10px] text-neutral-300 font-medium shadow-sm max-w-[95%] text-center">
                            <ArrowDown className="w-3 h-3 text-neutral-300 shrink-0" />
                            <span className="truncate">{connectionInfo}</span>
                          </div>
                          <div className="w-0.5 h-3 bg-[#1C1C1C]" />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 3: Relationship Map (Folded / Collapsible by default) */}
      <div className="space-y-3 pt-1">
        {/* Unified Section Header & Interactive Fold Card */}
        <div
          onClick={() => setIsRelationshipExpanded((prev) => !prev)}
          className="sticky top-0 z-10 bg-[#1C1C1C] hover:bg-[#242424] border border-[#2A2A2A] hover:border-[#2A2A2A] rounded-2xl p-3.5 cursor-pointer transition-all duration-200 shadow-md group"
        >
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="p-2 rounded-xl bg-[#1C1C1C] border border-[#2A2A2A] text-neutral-300 shrink-0">
                <Network className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-neutral-300 group-hover:text-neutral-300 transition-colors truncate">
                Relationship Map
              </h2>
            </div>

            <div className="shrink-0 p-1">
              {isRelationshipExpanded ? (
                <ChevronUp className="w-4 h-4 text-neutral-300" />
              ) : (
                <ChevronDown className="w-4 h-4 text-neutral-300 group-hover:text-neutral-300 transition-colors" />
              )}
            </div>
          </div>
        </div>

        {/* Expanded Content View */}
        {isRelationshipExpanded && (
          <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-2xl p-5 shadow-md space-y-4 animate-fadeIn">
            <p className="text-xs text-neutral-300 leading-relaxed">
              Peta keterkaitan antar ide dan konsep terkuat yang membentuk pola ini:
            </p>

            {/* List of Connected Concept Pairs */}
            <div className="space-y-3.5 pt-1">
              {relationshipPairs.map((pair, index) => {
                const isStrong = pair.strength === 'Strong';
                return (
                  <div
                    key={index}
                    className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-xl p-4 space-y-3 relative overflow-hidden"
                  >
                    {/* Meta Header */}
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-neutral-300 font-medium flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-neutral-300" />
                        <span>{pair.relationType}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-300 font-mono">
                          Score: {Math.round(pair.similarityScore * 100)}%
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[9px] border ${
                            isStrong
                              ? 'bg-[#1C1C1C] border-[#2A2A2A] text-neutral-300'
                              : 'bg-[#1C1C1C] border-[#2A2A2A] text-neutral-300'
                          }`}
                        >
                          {pair.strength}
                        </span>
                      </div>
                    </div>

                    {/* Concept Connector Elements */}
                    <div className="flex flex-col items-center justify-center space-y-1.5 pt-1">
                      {/* Konsep A */}
                      {pair.noteAId ? (
                        <button
                          type="button"
                          onClick={() => navigate({ tab: 'vault', vaultViewState: 'detail', noteId: pair.noteAId })}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#1C1C1C] hover:bg-[#242424] border border-[#2A2A2A] hover:border-[#2A2A2A]/60 text-xs font-bold text-neutral-300 hover:text-neutral-300 transition-all cursor-pointer group/node"
                          title="Buka detail catatan"
                        >
                          <span className="truncate flex-1 text-left">
                            {pair.conceptA}
                          </span>
                          <ExternalLink className="w-3.5 h-3.5 text-neutral-300 group-hover/node:text-neutral-300 transition-colors shrink-0 ml-2" />
                        </button>
                      ) : (
                        <div className="w-full text-center px-3 py-2 rounded-lg bg-[#1C1C1C] border border-[#2A2A2A] text-xs font-bold text-neutral-300 truncate">
                          {pair.conceptA}
                        </div>
                      )}

                      {/* Vertical Connector Arrow */}
                      <div className="flex items-center gap-1 text-neutral-300 py-0.5">
                        <ArrowUpDown className="w-4 h-4 animate-pulse shrink-0" />
                      </div>

                      {/* Konsep B */}
                      {pair.noteBId ? (
                        <button
                          type="button"
                          onClick={() => navigate({ tab: 'vault', vaultViewState: 'detail', noteId: pair.noteBId })}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#1C1C1C] hover:bg-[#242424] border border-[#2A2A2A] hover:border-[#2A2A2A]/60 text-xs font-bold text-neutral-300 hover:text-neutral-300 transition-all cursor-pointer group/node"
                          title="Buka detail catatan"
                        >
                          <span className="truncate flex-1 text-left">
                            {pair.conceptB}
                          </span>
                          <ExternalLink className="w-3.5 h-3.5 text-neutral-300 group-hover/node:text-neutral-300 transition-colors shrink-0 ml-2" />
                        </button>
                      ) : (
                        <div className="w-full text-center px-3 py-2 rounded-lg bg-[#1C1C1C] border border-[#2A2A2A] text-xs font-bold text-neutral-300 truncate">
                          {pair.conceptB}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 4: Evolution Timeline (Folded / Collapsible by default) */}
      <div className="space-y-3 pt-1">
        {/* Unified Section Header & Interactive Fold Card */}
        <div
          onClick={() => setIsTimelineExpanded((prev) => !prev)}
          className="sticky top-0 z-10 bg-[#1C1C1C] hover:bg-[#242424] border border-[#2A2A2A] hover:border-[#2A2A2A] rounded-2xl p-3.5 cursor-pointer transition-all duration-200 shadow-md group"
        >
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="p-2 rounded-xl bg-[#1C1C1C] border border-[#2A2A2A] text-neutral-300 shrink-0">
                <History className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-neutral-300 group-hover:text-neutral-300 transition-colors truncate">
                Evolution Timeline
              </h2>
            </div>

            <div className="shrink-0 p-1">
              {isTimelineExpanded ? (
                <ChevronUp className="w-4 h-4 text-neutral-300" />
              ) : (
                <ChevronDown className="w-4 h-4 text-neutral-300 group-hover:text-neutral-300 transition-colors" />
              )}
            </div>
          </div>
        </div>

        {/* Expanded Content View */}
        {isTimelineExpanded && (
          <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-2xl p-5 shadow-md space-y-4 animate-fadeIn">
            <p className="text-xs text-neutral-300 leading-relaxed">
              Perjalanan evolusi dan perkembangan ide yang membentuk pola ini dari waktu ke waktu:
            </p>

            <div className="relative space-y-3.5 pt-1">
              {/* STEP 1: First Detected */}
              <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-xl p-4 space-y-2 relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1C1C1C] shadow-[0_0_8px_rgba(52,199,89,0.5)] shrink-0" />
                    <span className="text-xs font-bold text-neutral-300">First Detected</span>
                  </div>
                  <span className="text-[10px] text-neutral-300 font-mono">
                    {formatDateTime(pattern.firstDetectedAt || pattern.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed pl-4">
                  Pattern pertama kali ditemukan dari beberapa catatan yang memiliki hubungan semantik.
                </p>
              </div>

              {/* Intermediate History Records if any */}
              {historyRecords.map((record, index) => (
                <React.Fragment key={record.id || index}>
                  {/* Connector Arrow */}
                  <div className="flex justify-center my-1 text-neutral-300">
                    <ArrowDown className="w-4 h-4 animate-pulse" />
                  </div>

                  <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-xl p-4 space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#1C1C1C] shadow-[0_0_8px_rgba(79,140,255,0.5)] shrink-0" />
                        <span className="text-xs font-bold text-neutral-300">
                          {record.changeType === 'MERGED_PATTERN'
                            ? 'Pattern Merged'
                            : 'Pattern Updated'}
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-300 font-mono">
                        {formatDateTime(record.archivedAt || record.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-300 leading-relaxed pl-4">
                      {record.changeSummary ||
                        'Pattern berkembang karena ada catatan baru yang memperkuat hubungan.'}
                    </p>

                    <div className="pl-4 pt-1 flex items-center justify-between text-[10px] text-neutral-300">
                      <span className="bg-[#1C1C1C] px-2 py-0.5 rounded border border-[#2A2A2A]">
                        {record.evidenceCount} Catatan Bukti
                      </span>
                    </div>
                  </div>
                </React.Fragment>
              ))}

              {/* Standard intermediate step if no history records exist */}
              {historyRecords.length === 0 && (
                <React.Fragment>
                  {/* Connector Arrow */}
                  <div className="flex justify-center my-1 text-neutral-300">
                    <ArrowDown className="w-4 h-4 animate-pulse" />
                  </div>

                  <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-xl p-4 space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#1C1C1C] shadow-[0_0_8px_rgba(79,140,255,0.5)] shrink-0" />
                        <span className="text-xs font-bold text-neutral-300">Pattern Updated</span>
                      </div>
                      <span className="text-[10px] text-neutral-300 font-mono">
                        {formatDateTime(lastDetectedAt)}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed pl-4">
                      Pattern berkembang karena ada catatan baru yang memperkuat hubungan.
                    </p>
                  </div>
                </React.Fragment>
              )}

              {/* Connector Arrow to Current Pattern */}
              <div className="flex justify-center my-1 text-neutral-300">
                <ArrowDown className="w-4 h-4 animate-pulse" />
              </div>

              {/* STEP FINAL: Current Pattern */}
              <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-xl p-4 space-y-3 relative shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1C1C1C] shadow-[0_0_8px_rgba(191,90,242,0.5)] shrink-0" />
                    <span className="text-xs font-bold text-neutral-300">Current Pattern</span>
                  </div>
                  <span className="text-[10px] text-neutral-300 font-mono">
                    {formatDateTime(lastDetectedAt)}
                  </span>
                </div>

                <div className="bg-[#1C1C1C] border border-[#2A2A2A] p-3 rounded-lg space-y-2 ml-4">
                  <p className="text-xs font-bold text-neutral-300">
                    {pattern.title}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[#2A2A2A]">
                    <div className="flex items-center gap-1.5 text-neutral-300">
                      <Layers className="w-3.5 h-3.5 text-neutral-300" />
                      <span>Evidence count: <strong className="text-neutral-300">{evidenceCount} Notes</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-300">
                      <Repeat className="w-3.5 h-3.5 text-neutral-300" />
                      <span>Occurrence count: <strong className="text-neutral-300">{occurrenceCount}x</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};
