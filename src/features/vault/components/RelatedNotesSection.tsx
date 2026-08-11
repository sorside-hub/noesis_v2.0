import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, FileText, Loader2, Sparkles } from 'lucide-react';
import { NoteItem } from '../pages/VaultPage';
import { retrievalService } from '../../../core/rag/retrieval';

interface RelatedNotesSectionProps {
  currentNoteId?: string;
  noteTitle?: string;
  noteContent?: string;
  allNotes?: NoteItem[];
  onSelectNoteByTitle?: (title: string) => void;
}

interface GroupedRelatedNote {
  noteId: string;
  noteTitle: string;
  bestChunkContent: string;
  maxScore: number;
}

export const RelatedNotesSection: React.FC<RelatedNotesSectionProps> = ({
  currentNoteId,
  noteTitle = '',
  noteContent = '',
  allNotes = [],
  onSelectNoteByTitle,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('noesis_drawer_expanded_related');
    return saved !== null ? saved === 'true' : false;
  });
  const [relatedNotes, setRelatedNotes] = useState<GroupedRelatedNote[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const fetchRelatedNotes = async () => {
      const fullText = `${noteTitle}\n${noteContent}`.trim();
      if (!fullText) {
        setRelatedNotes([]);
        return;
      }

      setIsLoading(true);
      try {
        // Query top candidate chunks from retrievalService
        const rawResults = await retrievalService.searchRelevantChunks(fullText, 25);

        if (!isMounted) return;

        // Group chunks by noteId keeping max score per note
        const noteMap = new Map<string, GroupedRelatedNote>();

        for (const item of rawResults) {
          // Rule: Ignore the note currently being opened
          if (currentNoteId && item.chunk.noteId === currentNoteId) continue;

          // Rule: Ignore similarity score below 50% (0.5)
          if (item.score < 0.5) continue;

          const existing = noteMap.get(item.chunk.noteId);
          if (!existing || item.score > existing.maxScore) {
            // Find note title from allNotes or parse from chunk
            const matchingNote = allNotes.find((n) => n.id === item.chunk.noteId);
            const title = matchingNote
              ? matchingNote.title
              : item.chunk.content.split('\n')[0].replace(/^#\s*/, '') || 'Catatan Tanpa Judul';

            noteMap.set(item.chunk.noteId, {
              noteId: item.chunk.noteId,
              noteTitle: title,
              bestChunkContent: item.chunk.content,
              maxScore: item.score,
            });
          }
        }

        // Sort descending by score and pick top 5
        const sorted = Array.from(noteMap.values())
          .sort((a, b) => b.maxScore - a.maxScore)
          .slice(0, 5);

        setRelatedNotes(sorted);
      } catch (err) {
        console.error('Error retrieving related notes:', err);
        setRelatedNotes([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchRelatedNotes();

    return () => {
      isMounted = false;
    };
  }, [currentNoteId, noteTitle, noteContent, allNotes]);

  return (
    <div className="pt-3 border-t border-[#2A2A2A] space-y-2 select-none">
      {/* Section Collapsible Header */}
      <button
        type="button"
        onClick={() => {
          const next = !isExpanded;
          setIsExpanded(next);
          localStorage.setItem('noesis_drawer_expanded_related', String(next));
        }}
        className="w-full flex items-center justify-between group py-1 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider group-hover:text-[#E5E5E5] transition-colors">
            Related Notes
          </span>
          <span className="text-[10px] font-mono text-[#737373] bg-[#222222] px-1.5 py-0.2 rounded-md border border-[#2A2A2A]">
            {relatedNotes.length}
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

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="pl-1.5 pt-1 space-y-2 animate-fade-in">
          {isLoading ? (
            <div className="flex items-center gap-2 py-2 text-[11px] text-[#737373] pl-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400" />
              <span>Mencari catatan terkait...</span>
            </div>
          ) : relatedNotes.length > 0 ? (
            <ul className="space-y-2">
              {relatedNotes.map((note) => {
                const percentage = Math.round(note.maxScore * 100);
                const cleanPreview = note.bestChunkContent
                  .replace(/^#+\s*/, '')
                  .replace(/\[\[(.*?)\]\]/g, '$1')
                  .trim();

                return (
                  <li key={note.noteId}>
                    <button
                      type="button"
                      onClick={() => onSelectNoteByTitle?.(note.noteTitle)}
                      className="w-full text-left p-2.5 bg-[#1C1C1C] hover:bg-[#242424] border border-[#2A2A2A] hover:border-neutral-500/50 rounded-xl transition-all cursor-pointer group flex flex-col gap-1 shadow-xs"
                      title={`Buka catatan: ${note.noteTitle} (${percentage}% similarity)`}
                    >
                      {/* Judul Note & Persentase Similarity */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span className="text-[11px] font-semibold text-[#E5E5E5] group-hover:text-white truncate">
                            {note.noteTitle}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-md bg-[#242424] text-[#A3A3A3] border border-[#303030] shrink-0">
                          {percentage}%
                        </span>
                      </div>

                      {/* Preview Singkat Isi Note */}
                      <p className="text-[10px] text-[#A3A3A3] line-clamp-2 leading-relaxed pl-5">
                        {cleanPreview || 'Tidak ada preview'}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[11px] text-[#737373] italic pl-2 py-1">
              Belum ada catatan terkait
            </p>
          )}
        </div>
      )}
    </div>
  );
};
