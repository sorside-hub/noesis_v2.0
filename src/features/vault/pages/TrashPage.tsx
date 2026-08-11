import React, { useState, useMemo } from 'react';
import { ArrowLeft, Trash2, RotateCcw, Search, AlertTriangle, ShieldAlert } from 'lucide-react';
import { NoteItem } from './VaultPage';
import { CATEGORIES } from './CategoryPage';
import { formatDateToDMY } from '../../../shared/utils/dateUtils';
import { VaultHeader } from '../components/VaultHeader';

interface TrashPageProps {
  trashNotes: NoteItem[];
  onBack: () => void;
  onOpenNote: (note: NoteItem) => void;
  onRestoreNote: (id: string) => void;
  onDeletePermanently: (id: string) => void;
  onEmptyTrash: () => void;
  toastMessage?: string | null;
}

export const TrashPage: React.FC<TrashPageProps> = ({
  trashNotes,
  onBack,
  onOpenNote,
  onRestoreNote,
  onDeletePermanently,
  onEmptyTrash,
  toastMessage,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return trashNotes;
    return trashNotes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [trashNotes, searchQuery]);

  const noteToDelete = useMemo(() => {
    if (!deleteTargetId) return null;
    return trashNotes.find((n) => n.id === deleteTargetId) || null;
  }, [deleteTargetId, trashNotes]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none bg-[#121212]">
      {/* Self-contained Vault Header */}
      <VaultHeader onBack={onBack} />

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col max-w-lg mx-auto w-full pb-20">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#262626] text-[#E5E5E5] border border-[#3A3A3A] px-4 py-2 rounded-full text-xs shadow-xl animate-fadeIn">
            {toastMessage}
          </div>
        )}

        {/* Header Title & Empty Trash Button */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-neutral-300" />
              <h1 className="text-xl font-bold text-[#E5E5E5] tracking-tight">Sampah</h1>
            </div>
            <p className="text-[11px] text-[#8E8E93] mt-0.5">
              {trashNotes.length} catatan berada di sampah
            </p>
          </div>

          {trashNotes.length > 0 && (
            <button
              onClick={() => setShowEmptyConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-600 text-xs font-medium rounded-xl transition-all cursor-pointer active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Kosongkan Sampah</span>
            </button>
          )}
        </div>

        {/* Search Input inside Trash */}
        {trashNotes.length > 0 && (
          <div className="relative mb-4">
            <Search className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari dalam sampah..."
              className="w-full pl-9 pr-4 py-2 bg-[#1C1C1C] border border-[#2A2A2A] focus:border-[#4A4A4A] rounded-xl text-xs text-[#E5E5E5] placeholder-[#666666] outline-none transition-colors"
            />
          </div>
        )}

        {/* List of Trashed Notes */}
        {filteredNotes.length > 0 ? (
          <div className="space-y-3">
            {filteredNotes.map((note) => {
              const categoryObj = CATEGORIES.find((c) => c.id === note.category);
              return (
                <div
                  key={note.id}
                  onClick={() => onOpenNote(note)}
                  className="p-4 bg-[#1C1C1C] hover:bg-[#242424] border border-[#2A2A2A] hover:border-neutral-700 rounded-2xl flex flex-col gap-2.5 shadow-sm transition-colors cursor-pointer group"
                >
                  {/* Top row: Title & Category */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#E5E5E5] group-hover:text-neutral-200 transition-colors truncate flex-1">
                      {note.title.trim() || 'Catatan Tanpa Judul'}
                    </h3>
                    {categoryObj && (
                      <span className="text-[10px] font-medium text-[#A3A3A3] bg-[#242424] px-2 py-0.5 rounded-full border border-[#303030] shrink-0 flex items-center gap-1">
                        <span>{categoryObj.emoji}</span>
                        <span>{categoryObj.title}</span>
                      </span>
                    )}
                  </div>

                  {/* Content snippet */}
                  <p className="text-xs text-[#8E8E93] line-clamp-2 leading-relaxed">
                    {note.content.trim() || 'Catatan kosong...'}
                  </p>

                  {/* Footer info & Action buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#262626] flex-wrap gap-2">
                    <div className="text-[10px] text-[#666666]">
                      {note.deletedAt ? (
                        <span>Dihapus: {formatDateToDMY(note.deletedAt)}</span>
                      ) : (
                        <span>Dibuat: {formatDateToDMY(note.createdAt)}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRestoreNote(note.id);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1C1C1C] hover:bg-[#242424] text-[#E5E5E5] border border-[#2A2A2A] rounded-lg text-xs font-medium transition-all cursor-pointer active:scale-95"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Pulihkan</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTargetId(note.id);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-600 rounded-lg text-xs font-medium transition-all cursor-pointer active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Permanen</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty state */
          <div className="bg-[#1C1C1C]/80 border border-[#2A2A2A] rounded-2xl p-8 flex flex-col items-center justify-center text-center my-6">
            <div className="w-12 h-12 rounded-2xl bg-[#242424] border border-[#333333] flex items-center justify-center text-[#737373] mb-3">
              <Trash2 className="w-6 h-6 stroke-[1.75]" />
            </div>
            <h4 className="text-xs font-semibold text-[#E5E5E5] mb-1">
              {searchQuery.trim() ? 'Tidak Ada Hasil' : 'Sampah Kosong'}
            </h4>
            <p className="text-[11px] text-[#8E8E93] max-w-xs leading-relaxed">
              {searchQuery.trim()
                ? `Tidak ditemukan catatan di sampah yang cocok dengan "${searchQuery}".`
                : 'Catatan yang Anda hapus akan dipindahkan ke folder Sampah ini sehingga dapat dipulihkan kapan saja.'}
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Modal: Empty All Trash */}
      {showEmptyConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1C1C1C] border border-[#333333] rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-neutral-300 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Kosongkan Seluruh Sampah?</span>
            </div>
            <p className="text-xs text-[#A3A3A3] leading-relaxed">
              Tindakan ini akan menghapus secara permanen <strong className="text-white">{trashNotes.length} catatan</strong> yang ada di sampah beserta seluruh data vektor terkait. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setShowEmptyConfirm(false)}
                className="flex-1 py-2 bg-[#262626] hover:bg-[#303030] text-[#E5E5E5] text-xs font-medium rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onEmptyTrash();
                  setShowEmptyConfirm(false);
                }}
                className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Single Note Delete Permanently */}
      {deleteTargetId && noteToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1C1C1C] border border-[#333333] rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-neutral-300 font-bold text-sm">
              <ShieldAlert className="w-5 h-5" />
              <span>Hapus Permanen Catatan?</span>
            </div>
            <p className="text-xs text-[#A3A3A3] leading-relaxed">
              Catatan <strong className="text-white">"{noteToDelete.title || 'Catatan Tanpa Judul'}"</strong> akan dihapus selamanya dari penyimpanan lokal Anda.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="flex-1 py-2 bg-[#262626] hover:bg-[#303030] text-[#E5E5E5] text-xs font-medium rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onDeletePermanently(deleteTargetId);
                  setDeleteTargetId(null);
                }}
                className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
