import React from 'react';
import { FileText, Link2, CornerDownLeft } from 'lucide-react';
import { AutocompletePopupPosition } from '../hooks/useWikilinkAutocomplete';

interface WikilinkAutocompletePopupProps {
  isOpen: boolean;
  suggestions: string[];
  selectedIndex: number;
  onSelect: (title: string) => void;
  onHoverIndex: (index: number) => void;
  query: string;
  position?: AutocompletePopupPosition;
}

export const WikilinkAutocompletePopup: React.FC<WikilinkAutocompletePopupProps> = ({
  isOpen,
  suggestions,
  selectedIndex,
  onSelect,
  onHoverIndex,
  query,
  position,
}) => {
  if (!isOpen || suggestions.length === 0) return null;

  const isAbove = position?.placement === 'above';

  const style: React.CSSProperties = position
    ? {
        top: isAbove
          ? `${position.top - 14}px`
          : `${position.top + position.height + 18}px`,
        left: `${position.left}px`,
        transform: isAbove ? 'translateY(-100%)' : undefined,
      }
    : {};

  return (
    <div
      style={style}
      className="absolute z-50 w-72 max-w-[calc(100vw-32px)] bg-[#1A1A1E] border border-[#333338] rounded-xl shadow-2xl overflow-hidden animate-fade-in backdrop-blur-md select-none transition-all duration-75"
    >
      {/* Header Badge */}
      <div className="px-3 py-1.5 bg-[#141417] border-b border-[#28282D] flex items-center justify-between text-[10px] text-[#A1A1AA]">
        <div className="flex items-center gap-1.5 font-medium">
          <Link2 className="w-3 h-3 text-neutral-400" />
          <span>Link Catatan</span>
          {query && (
            <span className="text-neutral-400 font-mono bg-neutral-800/15 px-1 py-0.2 rounded border border-neutral-500/30">
              "{query}"
            </span>
          )}
        </div>
        <span className="text-[9px] text-[#71717A] font-mono">
          {suggestions.length} saran
        </span>
      </div>

      {/* Suggestion List */}
      <ul className="p-1 space-y-0.5 max-h-48 overflow-y-auto">
        {suggestions.map((title, index) => {
          const isSelected = index === selectedIndex;

          return (
            <li key={title + index}>
              <button
                type="button"
                onClick={() => onSelect(title)}
                onMouseEnter={() => onHoverIndex(index)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-neutral-700 text-white font-medium shadow-sm'
                    : 'text-[#D4D4D8] hover:bg-[#27272A] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 truncate">
                  <FileText
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? 'text-white' : 'text-neutral-400'
                    }`}
                  />
                  <span className="truncate font-sans text-xs">[[{title}]]</span>
                </div>
                {isSelected && (
                  <div className="flex items-center gap-1 text-[9px] opacity-90 shrink-0 font-mono">
                    <span>pilih</span>
                    <CornerDownLeft className="w-2.5 h-2.5" />
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Footer hint */}
      <div className="px-3 py-1 bg-[#121215] border-t border-[#242428] text-[9px] text-[#71717A] flex items-center justify-between">
        <span>↑↓ navigasi</span>
        <span>↵ / Tab pilih</span>
      </div>
    </div>
  );
};
