import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Tag, FileText, ArrowUpRight } from 'lucide-react';
import { NoteItem, CategoryId } from '../pages/VaultPage';

interface SearchInputWithSuggestionsProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  categoryScope?: CategoryId;
  notes: NoteItem[];
  onSelectNote?: (note: NoteItem) => void;
  className?: string;
  onSearchEnter?: () => void;
  searchMode?: 'keyword' | 'semantic';
  showDropdown?: boolean;
}

export const SearchInputWithSuggestions: React.FC<SearchInputWithSuggestionsProps> = ({
  value,
  onChange,
  placeholder,
  categoryScope = 'all',
  notes,
  onSelectNote,
  className = '',
  onSearchEnter,
  searchMode = 'keyword',
  showDropdown = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isSemantic = searchMode === 'semantic';
  const accentColorClass = 'text-neutral-400';
  const hoverAccentColorClass = 'group-hover:text-neutral-300';
  const focusBorderColorClass = 'focus:border-neutral-500';
  const hoverBorderColorClass = 'hover:border-neutral-500/30';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const query = value.trim().toLowerCase();

  // Filter notes by scope
  const scopedNotes = notes.filter((n) => {
    if (categoryScope === 'all') return true;
    return n.category === categoryScope;
  });

  // Calculate matching notes & matching tags
  const matchingNotes: NoteItem[] = [];
  const matchingTagsSet = new Set<string>();

  if (query.length > 0) {
    scopedNotes.forEach((note) => {
      const titleMatch = note.title.toLowerCase().includes(query);
      const contentMatch = note.content.toLowerCase().includes(query);
      const matchingNoteTags = (note.tags || []).filter((t) =>
        t.toLowerCase().includes(query)
      );

      if (titleMatch || contentMatch || matchingNoteTags.length > 0) {
        matchingNotes.push(note);
      }

      matchingNoteTags.forEach((tag) => matchingTagsSet.add(tag));
    });
  }

  const matchingTags = Array.from(matchingTagsSet).slice(0, 4);
  const topNotes = matchingNotes.slice(0, 5);

  const hasSuggestions = (topNotes.length > 0 || matchingTags.length > 0) && query.length > 0;

  const handleSelectTag = (tag: string) => {
    onChange(`#${tag}`);
    setIsOpen(false);
  };

  const handleSelectNoteTitle = (note: NoteItem) => {
    onChange(note.title);
    setIsOpen(false);
    if (onSelectNote) {
      onSelectNote(note);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input Bar */}
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 w-4 h-4 text-[#737373] pointer-events-none" />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
              setIsOpen(false);
              if (onSearchEnter) {
                onSearchEnter();
              }
            }
          }}
          className={`w-full pl-10 pr-9 py-2.5 bg-[#1C1C1C] border border-[#2C2C2C] rounded-xl text-xs text-[#E5E5E5] placeholder-[#666666] focus:outline-none ${focusBorderColorClass} transition-colors shadow-inner`}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(false);
            }}
            className="absolute right-3 p-1 text-[#737373] hover:text-[#E5E5E5] transition-colors cursor-pointer"
            aria-label="Hapus kata kunci pencarian"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Realtime Autocomplete Suggestions Dropdown */}
      {showDropdown && isOpen && query.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#1E1E1E] border border-[#333333] rounded-2xl shadow-2xl overflow-hidden animate-fadeIn backdrop-blur-md">
          {hasSuggestions ? (
            <div className="p-2 space-y-3 max-h-72 overflow-y-auto">
              {/* Tag Suggestions */}
              {matchingTags.length > 0 && (
                <div>
                  <div className="px-2.5 py-1 text-[10px] font-semibold text-[#737373] uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className={`w-3 h-3 ${accentColorClass}`} />
                    <span>Tag Terkait</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1 px-1">
                    {matchingTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleSelectTag(tag)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#262626] hover:bg-[#323232] border border-[#383838] hover:border-[#666666] text-xs text-[#E5E5E5] transition-all cursor-pointer active:scale-95`}
                      >
                        <span className={accentColorClass}>#</span>
                        <span>{tag}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Note Title / Content Suggestions */}
              {topNotes.length > 0 && (
                <div>
                  <div className="px-2.5 py-1 text-[10px] font-semibold text-[#737373] uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className={`w-3 h-3 ${accentColorClass}`} />
                    <span>Saran Catatan ({topNotes.length})</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {topNotes.map((note) => (
                      <div
                        key={note.id}
                        onClick={() => handleSelectNoteTitle(note)}
                        className={`p-2.5 rounded-xl hover:bg-[#2A2A2A] transition-colors cursor-pointer group flex items-start justify-between gap-3 border border-transparent ${hoverBorderColorClass}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className={`text-xs font-semibold text-[#E5E5E5] ${hoverAccentColorClass} transition-colors truncate`}>
                              {note.title || 'Catatan Tanpa Judul'}
                            </h4>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#262626] text-[#A3A3A3] uppercase border border-[#333333] shrink-0">
                              {note.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#8E8E93] line-clamp-1 mt-0.5">
                            {note.content || 'Kosong...'}
                          </p>
                        </div>
                        <ArrowUpRight className={`w-3.5 h-3.5 text-[#737373] ${hoverAccentColorClass} shrink-0 transition-colors mt-0.5`} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-[#8E8E93]">
              Tidak ditemukan hasil pencarian untuk "{value}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};
