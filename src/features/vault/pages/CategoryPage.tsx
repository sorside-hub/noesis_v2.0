import React, { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { ArrowLeft, Search, Plus, Pin, Trash2 } from 'lucide-react';
import { CategoryId, NoteItem } from './VaultPage';
import { filterNotesByQueryAndCategory } from '../services/noteService';
import { SearchInputWithSuggestions } from '../components/SearchInputWithSuggestions';
import { formatDateToDMY } from '../../../shared/utils/dateUtils';
import { VaultHeader } from '../components/VaultHeader';

export interface CategoryConfig {
  id: CategoryId;
  title: string;
  emoji: string;
  subtitle: string;
  bgColor: string;
  borderColor: string;
}

export const CATEGORIES: CategoryConfig[] = [
  {
    id: 'all',
    title: 'All',
    emoji: '📁',
    subtitle: 'Semua koleksi catatan',
    bgColor: 'bg-[#1C1C1C]',
    borderColor: 'border-[#2A2A2A]',
  },
  {
    id: 'world',
    title: 'World',
    emoji: '🌍',
    subtitle: 'Informasi dari luar diri (buku, teori, riset, referensi)',
    bgColor: 'bg-[#1C1C1C]',
    borderColor: 'border-[#2A2A2A]',
  },
  {
    id: 'self',
    title: 'Self',
    emoji: '🪞',
    subtitle: 'Informasi dari diri (jurnal, refleksi, pengalaman, opini)',
    bgColor: 'bg-[#1C1C1C]',
    borderColor: 'border-[#2A2A2A]',
  },
  {
    id: 'ideas',
    title: 'Ideas',
    emoji: '💡',
    subtitle: 'Gagasan, konsep, kemungkinan & rencana proyek',
    bgColor: 'bg-[#1C1C1C]',
    borderColor: 'border-[#2A2A2A]',
  },
];

// Persistent state across mounts and tab switches per category ID
const savedCategoryScrollPositions: Record<string, number> = {};
const savedCategorySearchQueries: Record<string, string> = {};

interface CategoryPageProps {
  categoryConfig: CategoryConfig;
  notes: NoteItem[];
  onBack: () => void;
  onSelectNote: (note: NoteItem) => void;
  onTogglePin: (e: React.MouseEvent, noteId: string) => void;
  onDeleteNote: (e: React.MouseEvent, noteId: string) => void;
  onCreateNote: (category: CategoryId) => void;
  onSelectTag?: (tag: string) => void;
  toastMessage?: string | null;
}

export const CategoryPage: React.FC<CategoryPageProps> = ({
  categoryConfig,
  notes,
  onBack,
  onSelectNote,
  onTogglePin,
  onDeleteNote,
  onCreateNote,
  onSelectTag,
  toastMessage,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>(
    savedCategorySearchQueries[categoryConfig.id] || ''
  );

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Synchronize state when categoryConfig.id changes
  useEffect(() => {
    setSearchQuery(savedCategorySearchQueries[categoryConfig.id] || '');
  }, [categoryConfig.id]);

  // Restore scroll position when category or view renders
  useLayoutEffect(() => {
    const savedTop = savedCategoryScrollPositions[categoryConfig.id] || 0;
    if (containerRef.current) {
      containerRef.current.scrollTop = savedTop;
      const timer = requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = savedTop;
        }
      });
      return () => cancelAnimationFrame(timer);
    }
  }, [categoryConfig.id]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    savedCategoryScrollPositions[categoryConfig.id] = e.currentTarget.scrollTop;
  };

  const handleSearchQueryChange = (val: string) => {
    savedCategorySearchQueries[categoryConfig.id] = val;
    setSearchQuery(val);
  };

  // Total category notes count (category scope with empty query)
  const totalCategoryNotes = useMemo(
    () => filterNotesByQueryAndCategory(notes || [], '', categoryConfig.id),
    [notes, categoryConfig.id]
  );

  // Category Page Search: strictly scoped to active category (title, tags, content)
  const searchFilteredNotes = useMemo(
    () => filterNotesByQueryAndCategory(notes || [], searchQuery, categoryConfig.id),
    [notes, searchQuery, categoryConfig.id]
  );

  // Sort: pinned first, then newest first
  const sortedNotes = useMemo(() => {
    return [...searchFilteredNotes].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const idA = Number(a.id) || 0;
      const idB = Number(b.id) || 0;
      return idB - idA;
    });
  }, [searchFilteredNotes]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none animate-fadeIn">
      {/* Self-contained Header */}
      <VaultHeader onBack={onBack} />

      {/* Scrollable Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-5 flex flex-col max-w-lg mx-auto w-full pb-20"
      >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#262626] text-[#E5E5E5] border border-[#3A3A3A] px-4 py-2 rounded-full text-xs shadow-xl animate-fadeIn">
          {toastMessage}
        </div>
      )}

      {/* Top Navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-xl">{categoryConfig.emoji}</span>
          <h1 className="text-xl font-bold text-[#E5E5E5] tracking-tight">
            {categoryConfig.title}
          </h1>
        </div>

        {/* Right side controls: Badge & New Note Button */}
        <div className="flex items-center gap-2">
          {/* Note Count Badge */}
          <div className="px-3 py-1.5 rounded-xl bg-[#1C1C1C] border border-[#2C2C2C] text-xs font-semibold text-[#E5E5E5] shadow-sm">
            {totalCategoryNotes.length} catatan
          </div>

          {/* New Note Button (Icon Only) */}
          <button
            onClick={() => onCreateNote(categoryConfig.id)}
            className="w-9 h-9 rounded-xl bg-[#E5E5E5] hover:bg-white active:scale-95 text-[#111111] flex items-center justify-center shadow-md transition-all cursor-pointer shrink-0"
            aria-label={`Buat catatan baru di ${categoryConfig.title}`}
            title={`Buat Catatan Baru (${categoryConfig.title})`}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search Bar in Category with Suggestions */}
      <SearchInputWithSuggestions
        value={searchQuery}
        onChange={handleSearchQueryChange}
        placeholder={`Cari catatan di ${categoryConfig.title}...`}
        categoryScope={categoryConfig.id}
        notes={notes}
        onSelectNote={onSelectNote}
        className="mb-6"
      />

      {/* Notes List or Empty State */}
      {sortedNotes.length > 0 ? (
        <div className="space-y-3">
          {sortedNotes.map((note) => (
            <div
              key={note.id}
              onClick={() => onSelectNote(note)}
              className={`p-4 bg-[#1C1C1C] hover:bg-[#242424] border ${
                note.isPinned ? 'border-neutral-500/50 bg-[#1C1C1C]/90' : 'border-[#2A2A2A]'
              } hover:border-[#383838] rounded-2xl transition-all cursor-pointer group flex flex-col gap-2 relative shadow-sm`}
            >
              {/* Header: Title & Pin/Delete Buttons */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-[#E5E5E5] group-hover:text-neutral-300 transition-colors truncate">
                    {note.title.trim() || 'Catatan Tanpa Judul'}
                  </h3>
                </div>

                {/* Action Buttons: Pin & Delete */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => onTogglePin(e, note.id)}
                    title={note.isPinned ? 'Lepas Pin' : 'Sematkan (Pin)'}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      note.isPinned
                        ? 'text-[#E5E5E5] bg-[#2A2A2A] hover:bg-[#333333]'
                        : 'text-[#737373] hover:text-[#E5E5E5] hover:bg-[#2A2A2A]'
                    }`}
                  >
                    <Pin className={`w-3.5 h-3.5 ${note.isPinned ? 'fill-current' : ''}`} />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => onDeleteNote(e, note.id)}
                    title="Hapus Catatan"
                    className="p-1.5 rounded-lg text-[#737373] hover:text-[#FF5555] hover:bg-[#FF5555]/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Preview Content */}
              <p className="text-xs text-[#A3A3A3] line-clamp-2 leading-relaxed">
                {note.content.trim() || 'Catatan kosong...'}
              </p>

              {/* Footer: Date Created & Modified + Tags */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#262626] flex-wrap mt-0.5">
                <div className="text-[10px] text-[#737373] flex items-center gap-1.5 flex-wrap">
                  <span>Dibuat: {formatDateToDMY(note.createdAt)}</span>
                  {note.updatedAt && (
                    <>
                      <span>•</span>
                      <span>Diedit: {formatDateToDMY(note.updatedAt)}</span>
                    </>
                  )}
                </div>

                {note.tags && note.tags.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {note.tags.map((tag, idx) => {
                      const cleanTag = tag.replace(/^#/, '');
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectTag) onSelectTag(cleanTag);
                          }}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-[#242424] hover:bg-[#2C2C2C] border border-[#303030] hover:border-neutral-500/50 text-[#A3A3A3] hover:text-neutral-300 font-medium transition-colors cursor-pointer"
                        >
                          #{cleanTag}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-16 px-4 bg-[#181818]/60 border border-[#282828] rounded-2xl">
          <div className={`w-14 h-14 rounded-2xl ${categoryConfig.bgColor} border ${categoryConfig.borderColor} flex items-center justify-center mb-4 text-2xl`}>
            {categoryConfig.emoji}
          </div>
          <h3 className="text-sm font-semibold text-[#E5E5E5] mb-1">
            Belum ada catatan di kategori {categoryConfig.title}
          </h3>
          <p className="text-xs text-[#8E8E93] max-w-xs leading-relaxed mb-6">
            {categoryConfig.subtitle}. Tekan tombol di bawah untuk membuat catatan pertama kamu.
          </p>
          <button
            onClick={() => onCreateNote(categoryConfig.id)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#E5E5E5] hover:bg-white active:scale-95 text-[#111111] text-xs font-medium rounded-xl shadow-lg transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tulis Catatan {categoryConfig.title}</span>
          </button>
        </div>
      )}
    </div>
    </div>
  );
};
