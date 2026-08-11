import React, { useState } from 'react';
import {
  Link2,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
} from 'lucide-react';
import { NoteItem } from '../pages/VaultPage';
import { useLinkRelationships } from '../hooks/useLinkRelationships';

interface NoteLinksSectionProps {
  currentNoteId?: string;
  noteTitle?: string;
  noteContent?: string;
  allNotes?: NoteItem[];
  onSelectNoteByTitle?: (title: string) => void;
}

export const NoteLinksSection: React.FC<NoteLinksSectionProps> = ({
  currentNoteId,
  noteTitle = '',
  noteContent = '',
  allNotes = [],
  onSelectNoteByTitle,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('noesis_drawer_expanded_links');
    return saved !== null ? saved === 'true' : false;
  });

  const { outgoingLinks, backlinks, isLoading } = useLinkRelationships({
    currentNoteId,
    noteTitle,
    noteContent,
    allNotes,
  });

  const totalLinksCount = outgoingLinks.length + backlinks.length;

  return (
    <div className="pt-3 border-t border-[#2A2A2A] space-y-2 select-none">
      {/* Section Collapsible Header */}
      <button
        type="button"
        onClick={() => {
          const next = !isExpanded;
          setIsExpanded(next);
          localStorage.setItem('noesis_drawer_expanded_links', String(next));
        }}
        className="w-full flex items-center justify-between group py-1 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Link2 className="w-3.5 h-3.5 text-neutral-400" />
          <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider group-hover:text-[#E5E5E5] transition-colors">
            Links
          </span>
          <span className="text-[10px] font-mono text-[#737373] bg-[#222222] px-1.5 py-0.2 rounded-md border border-[#2A2A2A]">
            {totalLinksCount}
          </span>
        </div>
        <div className="text-[#737373] group-hover:text-[#E5E5E5] transition-colors">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </div>
      </button>

      {/* Collapsible Content Tree */}
      {isExpanded && (
        <div className="pl-1.5 space-y-3 pt-1 animate-fade-in">
          {/* Outgoing Links Branch */}
          <div className="relative pl-3 border-l border-[#2F2F2F] space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#A3A3A3]">
              <ArrowUpRight className="w-3.5 h-3.5 text-neutral-400" />
              <span>Outgoing Links</span>
              <span className="text-[10px] text-[#666666] font-mono ml-auto">
                ({outgoingLinks.length})
              </span>
            </div>

            {outgoingLinks.length > 0 ? (
              <ul className="space-y-1 pt-0.5">
                {outgoingLinks.map((targetTitle, idx) => {
                  const matchingNote = allNotes.find(
                    (n) => n.title.trim().toLowerCase() === targetTitle.toLowerCase()
                  );
                  const exists = Boolean(matchingNote);

                  return (
                    <li key={idx}>
                      <button
                        type="button"
                        onClick={() => onSelectNoteByTitle?.(targetTitle)}
                        className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 transition-all cursor-pointer group/link ${
                          exists
                            ? 'bg-[#181D2A]/60 border-[#3B4C70]/40 hover:border-neutral-500/80 text-[#D4D4D4] hover:text-white'
                            : 'bg-[#1A1A1A] border-[#2A2A2A] hover:border-[#333333] text-[#8E8E93] hover:text-[#A3A3A3]'
                        }`}
                        title={
                          exists
                            ? `Buka catatan: ${targetTitle}`
                            : `Buat/Tulis catatan: ${targetTitle}`
                        }
                      >
                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                          <FileText
                            className={`w-3 h-3 shrink-0 ${
                              exists ? 'text-neutral-400' : 'text-[#666666]'
                            }`}
                          />
                          <span className="truncate text-[11px] font-medium">
                            {targetTitle}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[10px] text-[#666666] italic pl-1 py-0.5">
                Belum ada format wikilink [[...]] di catatan ini.
              </p>
            )}
          </div>

          {/* Backlinks Branch */}
          <div className="relative pl-3 border-l border-[#2F2F2F] space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#A3A3A3]">
              <ArrowDownLeft className="w-3.5 h-3.5 text-neutral-400" />
              <span>Backlinks</span>
              <span className="text-[10px] text-[#666666] font-mono ml-auto">
                ({backlinks.length})
              </span>
            </div>

            {isLoading ? (
              <p className="text-[10px] text-[#737373] animate-pulse pl-1">
                Memuat backlinks...
              </p>
            ) : backlinks.length > 0 ? (
              <ul className="space-y-1 pt-0.5">
                {backlinks.map((sourceNote) => (
                  <li key={sourceNote.id}>
                    <button
                      type="button"
                      onClick={() => onSelectNoteByTitle?.(sourceNote.title)}
                      className="w-full text-left text-xs px-2.5 py-1.5 bg-[#181D2A]/60 hover:bg-[#1E2538]/80 border border-[#3B4C70]/40 hover:border-neutral-500/80 text-[#D4D4D4] hover:text-white rounded-lg flex items-center justify-between gap-2 transition-all cursor-pointer group/backlink"
                      title={`Buka catatan terhubung: ${sourceNote.title}`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 truncate">
                        <FileText className="w-3 h-3 text-neutral-400 shrink-0" />
                        <span className="truncate text-[11px] font-medium">
                          {sourceNote.title || 'Catatan Tanpa Judul'}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[10px] text-[#666666] italic pl-1 py-0.5">
                Belum ada catatan lain yang me-link ke catatan ini.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
