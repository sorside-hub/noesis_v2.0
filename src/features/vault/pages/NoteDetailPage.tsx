import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Edit3, Pin, Trash2, Sparkles } from 'lucide-react';
import { CategoryId, NoteItem } from './VaultPage';
import { MarkdownRenderer } from '../../../shared/components/MarkdownRenderer';
import { DistilModal } from '../../ai-tools/distill/DistilModal';
import { VaultHeader } from '../components/VaultHeader';
import { ragService } from '../../../core/rag/ragService';
import { useNavigation } from '../../../core/navigation';
import { formatDateToDMY } from '../../../shared/utils/dateUtils';

const savedNoteDetailScrollTop: Record<string, number> = {};

interface NoteDetailPageProps {
  id: string;
  title: string;
  content: string;
  category: CategoryId;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  isPinned?: boolean;
  tags?: string[];
  allNotes?: NoteItem[];
  onSelectNoteByTitle?: (title: string) => void;
  onSelectTag?: (tag: string) => void;
  onBack: () => void;
  onEdit: () => void;
  onTogglePin?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onOpenProperties?: () => void;
}

const CATEGORY_CONFIG: Record<CategoryId, { label: string; emoji: string }> = {
  world: { label: 'World', emoji: '🌍' },
  self: { label: 'Self', emoji: '🪞' },
  ideas: { label: 'Ideas', emoji: '💡' },
  all: { label: 'Lainnya', emoji: '📁' },
};

export const NoteDetailPage: React.FC<NoteDetailPageProps> = ({
  id,
  title,
  content,
  category,
  type = 'unknown',
  createdAt,
  updatedAt,
  deletedAt,
  isPinned = false,
  tags = [],
  allNotes = [],
  onSelectNoteByTitle,
  onSelectTag,
  onBack,
  onEdit,
  onTogglePin,
  onDelete,
  onRestore,
  onOpenProperties,
}) => {
  const { openDrawer, closeDrawer, isDrawerOpen } = useNavigation();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const isDistilModalOpen = isDrawerOpen('distilModal');

  const catInfo = CATEGORY_CONFIG[category] || { label: category, emoji: '📁' };

  const containerRef = useRef<HTMLDivElement | null>(null);
  const isRestoringScrollRef = useRef<boolean>(true);

  // Reset scroll restoration flag when note ID changes
  useEffect(() => {
    isRestoringScrollRef.current = true;
  }, [id]);

  // Restore scroll position
  useLayoutEffect(() => {
    const savedTop = savedNoteDetailScrollTop[id] || 0;
    if (containerRef.current) {
      isRestoringScrollRef.current = true;
      containerRef.current.scrollTop = savedTop;

      const raf = requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = savedTop;
        }
        const timer = setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = savedTop;
          }
          isRestoringScrollRef.current = false;
        }, 50);
        return () => clearTimeout(timer);
      });

      return () => cancelAnimationFrame(raf);
    }
  }, [id]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isRestoringScrollRef.current) return;
    savedNoteDetailScrollTop[id] = e.currentTarget.scrollTop;
  };

  useEffect(() => {
    // Process current note and all notes in background so embeddings exist for RAG search
    if (id && title) {
      ragService.processAndStoreNote({
        id,
        title,
        content,
        category,
        type,
        createdAt: createdAt || '',
        updatedAt,
        tags,
      }).catch(console.error);
    }
    if (allNotes && allNotes.length > 0) {
      allNotes.forEach((n) => {
        ragService.processAndStoreNote(n).catch(console.error);
      });
    }
  }, [id, title, content, category, createdAt, updatedAt, tags, allNotes]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#131313] select-none relative animate-fadeIn pb-16 overflow-hidden">
      {/* Self-contained Header */}
      <VaultHeader onBack={onBack} onOpenProperties={onOpenProperties} />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#262626] text-[#E5E5E5] border border-[#3A3A3A] px-4 py-2 rounded-full text-xs shadow-xl animate-fadeIn">
          {toastMessage}
        </div>
      )}

      {/* Detail Content Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-8 max-w-lg mx-auto w-full flex flex-col"
      >
        {/* Trashed Note Banner */}
        {deletedAt && (
          <div className="mb-4 p-3 bg-neutral-800 border border-neutral-600 rounded-2xl flex items-center justify-between text-xs text-neutral-300">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-neutral-400 shrink-0" />
              <span>Catatan ini berada di Sampah</span>
            </div>
            {onRestore && (
              <button
                onClick={() => {
                  onRestore();
                  showToast('Catatan berhasil dipulihkan');
                }}
                className="px-3 py-1 bg-[#2A2A2A] hover:bg-[#333333] text-[#E5E5E5] border border-[#333333] rounded-lg font-medium text-[11px] transition-colors cursor-pointer"
              >
                Pulihkan
              </button>
            )}
          </div>
        )}

        {/* Top Action Bar */}
        <div className="flex items-center justify-end mb-4 border-b border-[#262626] pb-3">
          <div className="flex items-center gap-1.5">
            {/* Distil Button (Groq AI) */}
            <button
              type="button"
              onClick={() => openDrawer('distilModal')}
              title="Distil Catatan (Groq AI)"
              aria-label="Distil Catatan"
              className="p-2 rounded-xl bg-[#1C1C1C] hover:bg-[#242424] border border-[#2A2A2A] text-[#A3A3A3] hover:text-[#E5E5E5] transition-all cursor-pointer active:scale-95 flex items-center justify-center shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
            </button>

            {onTogglePin && (
              <button
                type="button"
                onClick={() => {
                  onTogglePin();
                  showToast(!isPinned ? 'Catatan disematkan' : 'Pin dilepas');
                }}
                title={isPinned ? 'Lepas Pin' : 'Sematkan Catatan'}
                aria-label="Sematkan Catatan"
                className={`p-2 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                  isPinned
                    ? 'bg-[#2A2A2A] text-[#E5E5E5] border-[#333333]'
                    : 'bg-[#1C1C1C] hover:bg-[#242424] border border-[#2A2A2A] text-[#A3A3A3] hover:text-[#E5E5E5]'
                }`}
              >
                <Pin className={`w-4 h-4 ${isPinned ? 'fill-current' : ''}`} />
              </button>
            )}

            <button
              type="button"
              onClick={onEdit}
              title="Edit Catatan"
              aria-label="Edit Catatan"
              className="p-2 bg-[#E5E5E5] hover:bg-white text-[#111111] rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete();
                }}
                title="Hapus Catatan"
                aria-label="Hapus Catatan"
                className="p-2 rounded-xl bg-[#1C1C1C] hover:bg-neutral-800 border border-[#2A2A2A] hover:border-neutral-700 text-[#A3A3A3] hover:text-white transition-all cursor-pointer active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Note Metadata & Title */}
        <div className="mb-4 pb-3 border-b border-[#2A2A2A]">
          <h1 className="text-xl font-bold text-[#E5E5E5] mb-2 leading-tight">
            {title.trim() || 'Catatan Tanpa Judul'}
          </h1>

          <div className="flex items-center text-[11px] text-[#737373] flex-wrap gap-2">
            <span className="px-2 py-0.5 rounded-md bg-[#222222] border border-[#333333] text-[#D4D4D4] font-medium text-[10px] inline-flex items-center gap-1 shrink-0">
              <span>{catInfo.emoji}</span>
              <span>{catInfo.label}</span>
            </span>

            {createdAt && (
              <>
                <span>•</span>
                <span>Dibuat: {formatDateToDMY(createdAt)}</span>
              </>
            )}

            {updatedAt && (
              <>
                <span>•</span>
                <span>Diedit: {formatDateToDMY(updatedAt)}</span>
              </>
            )}
          </div>

          {tags && tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2.5 pt-2 border-t border-[#262626]">
              <span className="text-[10px] text-[#737373] font-medium mr-0.5">Tag:</span>
              {tags.map((tag, idx) => {
                const cleanTag = tag.replace(/^#/, '');
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelectTag && onSelectTag(cleanTag)}
                    className="text-[10px] px-2.5 py-0.5 rounded-md bg-[#242424] hover:bg-[#2E2E2E] active:scale-95 border border-[#303030] hover:border-neutral-500/50 text-[#A3A3A3] hover:text-neutral-300 font-medium transition-all cursor-pointer inline-flex items-center gap-1"
                  >
                    #{cleanTag}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Full Note Content Preview */}
        <div className="py-2 min-h-[200px]">
          {content.trim() ? (
            <MarkdownRenderer
              content={content}
              allNotes={allNotes}
              onWikilinkClick={onSelectNoteByTitle}
            />
          ) : (
            <p className="text-xs text-[#737373] italic">
              Catatan ini belum memiliki isi. Klik "Edit Note" untuk mulai menulis.
            </p>
          )}
        </div>
      </div>

      {/* Distil Modal (Groq AI) */}
      <DistilModal
        isOpen={isDistilModalOpen}
        onClose={() => closeDrawer('distilModal')}
        noteId={id}
        title={title}
        content={content}
      />
    </div>
  );
};
