import React, { useState, useRef, useEffect } from 'react';
import { ChatThread } from '../../../shared/types';
import {
  X,
  Plus,
  MessageSquare,
  MoreVertical,
  Pin,
  Pencil,
  Trash2,
  Check,
} from 'lucide-react';

interface ChatHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  threads: ChatThread[];
  activeThreadId: string;
  onSelectThread: (threadId: string) => void;
  onNewChat: () => void;
  onDeleteThread: (threadId: string) => void;
  onRenameThread: (threadId: string, newTitle: string) => void;
  onTogglePinThread: (threadId: string) => void;
}

export const ChatHistoryDrawer: React.FC<ChatHistoryDrawerProps> = ({
  isOpen,
  onClose,
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onDeleteThread,
  onRenameThread,
  onTogglePinThread,
}) => {
  const [menuOpenThreadId, setMenuOpenThreadId] = useState<string | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingThreadId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingThreadId]);

  if (!isOpen) return null;

  // Sort threads: Pinned threads first, then by last updated
  const sortedThreads = [...threads].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.lastUpdated - a.lastUpdated;
  });

  const handleStartRename = (thread: ChatThread) => {
    setEditingThreadId(thread.id);
    setEditTitle(thread.title);
    setMenuOpenThreadId(null);
  };

  const handleSaveRename = (threadId: string) => {
    if (editTitle.trim()) {
      onRenameThread(threadId, editTitle.trim());
    }
    setEditingThreadId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex select-none">
      {/* Backdrop */}
      <div
        onClick={() => {
          setMenuOpenThreadId(null);
          onClose();
        }}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Drawer Panel (Slide from Left) */}
      <div className="relative w-4/5 max-w-xs h-full bg-[#131313] border-r border-[#303030] flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-250">
        {/* Drawer Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-[#303030] bg-[#1C1C1C]/50">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-neutral-300" />
            <span className="font-semibold text-sm text-[#E5E5E5]">
              Riwayat Chat
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#1C1C1C] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3 border-b border-[#303030]">
          <button
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full py-2.5 px-3 bg-neutral-200 hover:bg-white text-[#111111] rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-98 shadow-md shadow-neutral-500/10"
          >
            <Plus className="w-4 h-4" />
            <span>Obrolan Baru</span>
          </button>
        </div>

        {/* Thread List - Standard Clean Chatbot Style */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sortedThreads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <MessageSquare className="w-8 h-8 text-[#404040] mb-2" />
              <p className="text-xs text-[#A3A3A3] font-medium">Belum ada riwayat chat</p>
              <p className="text-[11px] text-[#666666] mt-1">
                Mulai obrolan baru untuk menyimpan riwayat percakapan Anda.
              </p>
            </div>
          ) : (
            sortedThreads.map((thread) => {
            const isActive = thread.id === activeThreadId;
            const isMenuOpen = menuOpenThreadId === thread.id;
            const isEditing = editingThreadId === thread.id;

            return (
              <div key={thread.id} className="relative">
                <div
                  onClick={() => {
                    if (!isEditing) {
                      onSelectThread(thread.id);
                      onClose();
                    }
                  }}
                  className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${
                    isActive
                      ? 'bg-[#1C1C1C] border-[#303030] text-[#E5E5E5]'
                      : 'bg-transparent border-transparent text-[#A3A3A3] hover:bg-[#1C1C1C]/60 hover:text-[#E5E5E5]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden flex-1 min-w-0 pr-1">
                    {thread.pinned ? (
                      <Pin className="w-3.5 h-3.5 text-neutral-300 shrink-0 rotate-45" />
                    ) : (
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                    )}

                    {isEditing ? (
                      <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(thread.id);
                            if (e.key === 'Escape') setEditingThreadId(null);
                          }}
                          className="w-full bg-[#131313] border border-neutral-500 text-[#E5E5E5] text-xs px-2 py-1 rounded-md focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveRename(thread.id)}
                          className="p-1 text-neutral-300 hover:bg-neutral-800 rounded-md"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`text-xs font-medium truncate ${
                          isActive ? 'text-[#E5E5E5]' : 'text-[#A3A3A3] group-hover:text-[#E5E5E5]'
                        }`}
                      >
                        {thread.title}
                      </span>
                    )}
                  </div>

                  {/* 3 Dots Vertikal Menu Button */}
                  {!isEditing && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenThreadId(isMenuOpen ? null : thread.id);
                      }}
                      className="p-1 rounded-md text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#262626] transition-colors shrink-0"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Popup Dropdown Menu */}
                {isMenuOpen && (
                  <div
                    className="absolute right-2 top-10 z-30 w-36 bg-[#1C1C1C] border border-[#303030] rounded-xl shadow-xl p-1 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        onTogglePinThread(thread.id);
                        setMenuOpenThreadId(null);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[#E5E5E5] hover:bg-[#262626] transition-colors text-left"
                    >
                      <Pin className="w-3.5 h-3.5 text-neutral-300" />
                      <span>{thread.pinned ? 'Unpin' : 'Pin'}</span>
                    </button>

                    <button
                      onClick={() => handleStartRename(thread)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[#E5E5E5] hover:bg-[#262626] transition-colors text-left"
                    >
                      <Pencil className="w-3.5 h-3.5 text-neutral-300" />
                      <span>Edit Judul</span>
                    </button>

                    <button
                      onClick={() => {
                        onDeleteThread(thread.id);
                        setMenuOpenThreadId(null);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-white hover:bg-neutral-800 transition-colors text-left"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
          )}
        </div>
      </div>
    </div>
  );
};
