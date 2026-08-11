import React, { useState, useEffect } from 'react';
import { Message } from '../../../shared/types';
import { Copy, Check, Pencil, FileText, ChevronRight, ChevronDown } from 'lucide-react';
import { MarkdownRenderer } from '../../../shared/components/MarkdownRenderer';
import { getNotes } from '../../vault/services/noteService';

interface ChatMessageProps {
  message: Message;
  onEditMessage?: (id: string, content: string) => void;
  onCreateNoteFromAI?: (content: string) => void;
  onOpenNoteById?: (noteId: string) => void;
  isEditing?: boolean;
  onShowToast?: (msg: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onEditMessage,
  onCreateNoteFromAI,
  onOpenNoteById,
  isEditing = false,
  onShowToast,
}) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [isSourcesExpanded, setIsSourcesExpanded] = useState<boolean>(false);
  const [isRagInfoExpanded, setIsRagInfoExpanded] = useState<boolean>(false);
  const [resolvedSources, setResolvedSources] = useState<
    {
      noteId: string;
      title: string;
      noteTitle: string;
      category: string;
      type: string;
      tags: string[];
      score: number;
      snippet: string;
    }[]
  >([]);

  // Process and deduplicate RAG retrieved contexts for AI response
  useEffect(() => {
    if (isUser || !message.retrievedContexts || message.retrievedContexts.length === 0) {
      setResolvedSources([]);
      return;
    }

    let isMounted = true;
    const processSources = async () => {
      // 1. Deduplicate by noteId, keeping chunk with highest similarity score
      const deduplicatedMap = new Map<
        string,
        {
          noteId: string;
          title: string;
          noteTitle: string;
          category: string;
          type: string;
          tags: string[];
          score: number;
          snippet: string;
        }
      >();

      for (const ctx of message.retrievedContexts || []) {
        const key = String(ctx.noteId);
        const existing = deduplicatedMap.get(key);
        if (!existing || ctx.score > existing.score) {
          const displayTitle = ctx.title || ctx.noteTitle || '';
          deduplicatedMap.set(key, {
            noteId: key,
            title: displayTitle,
            noteTitle: displayTitle,
            category: ctx.category || '',
            type: ctx.type || '',
            tags: ctx.tags || [],
            score: ctx.score,
            snippet: ctx.snippet,
          });
        }
      }

      // 2. Sort by score descending & take max 5 items
      let items = Array.from(deduplicatedMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      // 3. Resolve missing note metadata from IndexedDB if needed for legacy messages
      const missingMetadata = items.some((item) => !item.noteTitle || !item.category);
      if (missingMetadata) {
        try {
          const allNotes = await getNotes();
          const noteMap = new Map(
            allNotes.map((n) => [String(n.id), n])
          );
          items = items.map((item) => {
            const n = noteMap.get(item.noteId);
            const resolvedTitle = item.title || item.noteTitle || n?.title || 'Catatan Tanpa Judul';
            return {
              ...item,
              title: resolvedTitle,
              noteTitle: resolvedTitle,
              category: item.category || n?.category || 'self',
              type: item.type || n?.type || 'unknown',
              tags: item.tags.length > 0 ? item.tags : (n?.tags || []),
            };
          });
        } catch (e) {
          items = items.map((item) => ({
            ...item,
            title: item.title || item.noteTitle || 'Catatan Vault',
            noteTitle: item.noteTitle || 'Catatan Vault',
          }));
        }
      }

      if (isMounted) {
        setResolvedSources(items);
      }
    };

    processSources();

    return () => {
      isMounted = false;
    };
  }, [isUser, message.retrievedContexts]);

  // If AI message is empty (waiting for first stream chunk), don't render empty container
  if (!isUser && !message.content) {
    return null;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    if (onShowToast) {
      onShowToast('Jawaban AI tersalin ke clipboard');
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateNote = () => {
    if (onCreateNoteFromAI) {
      onCreateNoteFromAI(message.content);
    }
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // RAG Status Badge calculations
  const ragMeta = message.ragStatus;
  const mode = ragMeta?.mode || 'smart';
  const usedVault = ragMeta ? ragMeta.usedVault : resolvedSources.length > 0;

  let badgeLabel = '';
  let badgeStyle = '';
  let isClickable = mode !== 'off';

  if (mode === 'smart') {
    if (usedVault) {
      badgeLabel = '⚡ Smart • Vault';
      badgeStyle = 'text-neutral-300 bg-neutral-800 border-neutral-600 hover:bg-neutral-700 hover:border-neutral-500';
    } else {
      badgeLabel = '⚡ Smart • General';
      badgeStyle = 'text-neutral-400 bg-neutral-900 border-neutral-700 hover:bg-neutral-800 hover:text-neutral-300';
    }
  } else if (mode === 'on') {
    if (usedVault) {
      badgeLabel = '● On • Vault';
      badgeStyle = 'text-neutral-300 bg-neutral-800 border-neutral-600 hover:bg-neutral-700 hover:border-neutral-500';
    } else {
      badgeLabel = '● On • General';
      badgeStyle = 'text-neutral-400 bg-neutral-900 border-neutral-700 hover:bg-neutral-800 hover:text-neutral-300';
    }
  } else {
    badgeLabel = '○ Off • General';
    badgeStyle = 'text-neutral-400 bg-neutral-500/15 border-neutral-500/35';
    isClickable = false;
  }

  const formatIntent = (intent?: string) => {
    if (!intent) return 'Thinking with Vault';
    const map: Record<string, string> = {
      memory_recall: 'Memory Recall',
      reflection: 'Reflection',
      analysis_critique: 'Analysis & Critique',
      creation: 'Creation & Ideation',
      topic_query: 'Topic Query',
      knowledge_synthesis: 'Knowledge Synthesis',
      smalltalk: 'Smalltalk',
      general: 'General Query',
    };
    return map[intent.toLowerCase()] || intent;
  };

  const formatSearchMethod = (method?: string) => {
    if (!method) return 'Hybrid RRF';
    if (method === 'hybrid') return 'Hybrid RRF';
    if (method === 'vector') return 'Vector Search';
    if (method === 'bm25') return 'BM25 Keyword';
    return method;
  };

  const formatFilter = (val?: string | string[]) => {
    if (!val || val === 'all' || (Array.isArray(val) && val.length === 0)) return 'All';
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
  };

  const highestScoreVal = ragMeta?.highestScore ?? (resolvedSources.length > 0 ? Math.max(...resolvedSources.map((s) => s.score)) : 0);
  const formattedScore = highestScoreVal > 0 ? `${Math.round(highestScoreVal > 1 ? highestScoreVal : highestScoreVal * 100)}%` : null;

  return (
    <div
      className={`flex flex-col w-full mb-4 ${
        isUser ? 'items-end' : 'items-start'
      }`}
    >
      {isUser ? (
        <div className="flex flex-col items-stretch max-w-[85%]">
          {/* User Bubble */}
          <div
            className={`group relative leading-relaxed text-sm transition-all bg-[#262626] border ${
              isEditing
                ? 'border-neutral-500 ring-1 ring-neutral-500/40'
                : 'border-[#363636]'
            } text-[#E5E5E5] rounded-2xl rounded-tr-xs px-4 py-2.5 shadow-sm`}
          >
            <div className="whitespace-pre-wrap break-words">
              {message.content}
            </div>
          </div>

          {/* User Footer (Outside bubble, matching bubble width, time on left) */}
          <div className="flex items-center justify-between gap-2 mt-1 px-1 text-[10px] text-[#A3A3A3]">
            <span>{formatTimestamp(message.timestamp)}</span>
            {onEditMessage && (
              <button
                type="button"
                onClick={() => onEditMessage(message.id, message.content)}
                title="Edit pesan"
                aria-label="Edit pesan"
                className="p-1.5 rounded-lg bg-[#222222] hover:bg-[#2A2A2A] border border-[#333333] hover:border-[#444444] text-[#B0B0B0] hover:text-[#FFFFFF] transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center"
              >
                <Pencil className="w-3.5 h-3.5 text-[#A3A3A3]" />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* AI Container / Bubble */
        <div className="group relative leading-relaxed text-sm transition-all w-full text-[#E5E5E5] py-0.5">
          <MarkdownRenderer content={message.content} />

          {/* Footer info & actions for AI */}
          <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-[#262626] text-[10px] text-[#A3A3A3]">
            {/* Left: Status Badge & Timestamp */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && setIsRagInfoExpanded(!isRagInfoExpanded)}
                className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold transition-all flex items-center gap-1 select-none ${badgeStyle} ${
                  isClickable ? 'cursor-pointer active:scale-95' : 'cursor-default'
                }`}
                title={isClickable ? 'Klik untuk melihat detail RAG Information' : undefined}
              >
                <span>{badgeLabel}</span>
                {isClickable && (
                  isRagInfoExpanded ? (
                    <ChevronDown className="w-3 h-3 text-current opacity-80" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-current opacity-80" />
                  )
                )}
              </button>

              <span>{formatTimestamp(message.timestamp)}</span>
            </div>

            {/* Right: Copy & Jadikan Note buttons in boxed icon style */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Copy Button */}
              <button
                type="button"
                onClick={handleCopy}
                title={copied ? "Tersalin!" : "Salin jawaban"}
                aria-label="Salin jawaban"
                className="p-1.5 rounded-lg bg-[#1C1C1C] hover:bg-[#252525] border border-[#2D2D2D] hover:border-[#3D3D3D] text-[#B0B0B0] hover:text-[#FFFFFF] transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-neutral-300" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-[#A3A3A3]" />
                )}
              </button>

              {/* Jadikan Note Button */}
              <button
                type="button"
                onClick={handleCreateNote}
                title="Jadikan Catatan Vault"
                aria-label="Jadikan Catatan Vault"
                className="p-1.5 rounded-lg bg-[#1C1C1C] hover:bg-[#252525] border border-[#2D2D2D] hover:border-[#3D3D3D] text-[#B0B0B0] hover:text-[#FFFFFF] transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center"
              >
                <FileText className="w-3.5 h-3.5 text-[#A3A3A3]" />
              </button>
            </div>
          </div>

          {/* RAG Information Expandable Section */}
          {isRagInfoExpanded && (
            <div className="mt-2.5 p-3 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-[#CCCCCC] space-y-2">
              <div className="flex items-center justify-between border-b border-[#282828] pb-1.5">
                <span className="font-bold text-[#E5E5E5] flex items-center gap-1.5 text-[11px]">
                  RAG Information
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                  mode === 'smart'
                    ? 'text-neutral-300 bg-neutral-800 border-neutral-600'
                    : mode === 'on'
                    ? 'text-neutral-300 bg-neutral-800 border-neutral-600'
                    : 'text-neutral-300 bg-neutral-500/10 border-neutral-500/30'
                }`}>
                  {mode.toUpperCase()} MODE
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                <div>
                  <span className="text-[#888888]">Mode:</span>{' '}
                  <span className="font-semibold text-[#E5E5E5] capitalize">{mode}</span>
                </div>
                {message.modelMeta && (
                  <div>
                    <span className="text-[#888888]">AI Model:</span>{' '}
                    <span className={`font-semibold ${message.modelMeta.isFallback ? 'text-neutral-300' : 'text-neutral-300'}`}>
                      {message.modelMeta.model}
                    </span>
                    {message.modelMeta.isFallback && (
                      <span className="text-neutral-300/80 font-normal ml-1 text-[10px]">
                        (Fallback)
                      </span>
                    )}
                  </div>
                )}
                {ragMeta?.intent && (
                  <div>
                    <span className="text-[#888888]">Intent:</span>{' '}
                    <span className="font-semibold text-[#E5E5E5]">{formatIntent(ragMeta.intent)}</span>
                  </div>
                )}
                {ragMeta?.reasoningStyle && (
                  <div>
                    <span className="text-[#888888]">Reasoning Style:</span>{' '}
                    <span className="font-semibold text-neutral-300">{ragMeta.reasoningStyle}</span>
                  </div>
                )}
                {ragMeta?.memoryDepth && (
                  <div>
                    <span className="text-[#888888]">Memory Depth:</span>{' '}
                    <span className="font-semibold text-neutral-300 capitalize">{ragMeta.memoryDepth.replace('_', ' ')}</span>
                  </div>
                )}
                {ragMeta?.confidenceLevel && (
                  <div>
                    <span className="text-[#888888]">Confidence:</span>{' '}
                    <span className={`font-semibold capitalize ${
                      ragMeta.confidenceLevel === 'high' ? 'text-neutral-300' :
                      ragMeta.confidenceLevel === 'medium' ? 'text-neutral-300' : 'text-gray-400'
                    }`}>{ragMeta.confidenceLevel}</span>
                  </div>
                )}
                <div>
                  <span className="text-[#888888]">Search Method:</span>{' '}
                  <span className="font-semibold text-[#E5E5E5]">{formatSearchMethod(ragMeta?.searchMethod)}</span>
                </div>
                <div>
                  <span className="text-[#888888]">Category Filter:</span>{' '}
                  <span className="font-semibold text-[#E5E5E5]">{formatFilter(ragMeta?.category)}</span>
                </div>
                <div>
                  <span className="text-[#888888]">Type Filter:</span>{' '}
                  <span className="font-semibold text-[#E5E5E5]">{formatFilter(ragMeta?.typeFilter)}</span>
                </div>
                <div>
                  <span className="text-[#888888]">Tag Filter:</span>{' '}
                  <span className="font-semibold text-[#E5E5E5]">{formatFilter(ragMeta?.tags)}</span>
                </div>
                <div>
                  <span className="text-[#888888]">Top K:</span>{' '}
                  <span className="font-semibold text-[#E5E5E5]">{ragMeta?.topK ?? 5}</span>
                </div>
                <div>
                  <span className="text-[#888888]">Chunks Retrieved:</span>{' '}
                  <span className="font-semibold text-[#E5E5E5]">{ragMeta?.chunksRetrieved ?? ragMeta?.sourcesCount ?? resolvedSources.length}</span>
                </div>
                <div>
                  <span className="text-[#888888]">Chunks Used:</span>{' '}
                  <span className="font-semibold text-[#E5E5E5]">{ragMeta?.chunksUsed ?? resolvedSources.length}</span>
                </div>
                {formattedScore && (
                  <div>
                    <span className="text-[#888888]">Highest Score:</span>{' '}
                    <span className="font-semibold text-neutral-300">{formattedScore}</span>
                  </div>
                )}
                {ragMeta?.processingTime !== undefined && (
                  <div>
                    <span className="text-[#888888]">Processing Time:</span>{' '}
                    <span className="font-semibold text-[#E5E5E5]">{ragMeta.processingTime} ms</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RAG Sources Section (Separate section below metadata bar) */}
          {resolvedSources.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-[#262626]">
              {/* Collapsed / Expanded Header Toggle */}
              <button
                type="button"
                onClick={() => setIsSourcesExpanded(!isSourcesExpanded)}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#A3A3A3] hover:text-[#E5E5E5] transition-colors cursor-pointer py-1 select-none group/toggle"
              >
                <span>Sources</span>
                {isSourcesExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[#A3A3A3] group-hover/toggle:text-[#E5E5E5]" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[#A3A3A3] group-hover/toggle:text-[#E5E5E5]" />
                )}
              </button>

              {/* Expanded Sources List */}
              {isSourcesExpanded && (
                <div className="mt-2.5 space-y-2">
                  {resolvedSources.map((src) => {
                    const scorePct = Math.round(src.score > 1 ? src.score : src.score * 100);
                    return (
                      <div
                        key={src.noteId}
                        onClick={() => onOpenNoteById?.(src.noteId)}
                        className="p-2.5 bg-[#1A1A1A] hover:bg-[#222222] border border-[#2E2E2E] hover:border-neutral-500/60 rounded-xl transition-all cursor-pointer group/src flex items-center justify-between gap-2 text-left shadow-sm"
                      >
                        {/* Left: Icon, Note Title & Category */}
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                          <span className="text-xs font-semibold text-[#F0F0F0] group-hover/src:text-neutral-300 transition-colors truncate">
                            {src.noteTitle || src.title}
                          </span>
                          {src.category && (
                            <span className="px-1.5 py-0.5 rounded bg-[#2A2A2A] text-[#A3A3A3] text-[9px] font-medium uppercase tracking-wider shrink-0">
                              {src.category}
                            </span>
                          )}
                        </div>

                        {/* Right: Score badge */}
                        <span className="text-[10px] font-semibold text-neutral-300 bg-neutral-800 border border-neutral-500/30 px-2 py-0.5 rounded-md shrink-0">
                          {scorePct}% match
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

