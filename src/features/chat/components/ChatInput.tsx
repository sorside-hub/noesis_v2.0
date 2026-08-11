import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, X, Pencil, Check } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onEditSubmit?: (messageId: string, message: string) => void;
  editingMessage?: { id: string; content: string } | null;
  onCancelEdit?: () => void;
  isLoading: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onEditSubmit,
  editingMessage,
  onCancelEdit,
  isLoading,
}) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync input when editingMessage changes
  useEffect(() => {
    if (editingMessage) {
      setInput(editingMessage.content);
      if (textareaRef.current) {
        textareaRef.current.focus();
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.setSelectionRange(
              editingMessage.content.length,
              editingMessage.content.length
            );
          }
        }, 50);
      }
    }
  }, [editingMessage]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        120
      )}px`;
    }
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (editingMessage && onEditSubmit) {
      onEditSubmit(editingMessage.id, input.trim());
    } else {
      onSendMessage(input.trim());
    }

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape' && editingMessage && onCancelEdit) {
      onCancelEdit();
      setInput('');
    }
  };

  const handleCancel = () => {
    if (onCancelEdit) onCancelEdit();
    setInput('');
  };

  return (
    <div className="shrink-0 px-3 pb-2 pt-2 bg-transparent z-20">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col bg-[#1C1C1C]/90 backdrop-blur-md rounded-2xl p-1.5 focus-within:ring-1 focus-within:ring-neutral-500/50 transition-all shadow-2xl border border-[#2A2A2A]"
      >
        {/* Banner indicating Edit Mode */}
        {editingMessage && (
          <div className="flex items-center justify-between px-3 py-1.5 mb-1 bg-[#282828] rounded-xl text-xs text-[#E5E5E5] border border-[#383838]">
            <div className="flex items-center gap-2 truncate">
              <Pencil className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
              <span className="font-semibold text-neutral-300">Mengedit pesan</span>
              <span className="text-[#8E8E93] truncate max-w-[180px]">
                "{editingMessage.content}"
              </span>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              title="Batal edit"
              aria-label="Batal edit"
              className="p-1 text-[#8E8E93] hover:text-[#E5E5E5] hover:bg-[#333333] rounded-md transition-colors cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              editingMessage
                ? 'Ubah pesan kamu lalu tekan Kirim...'
                : 'Tulis apa yang ada di pikiranmu...'
            }
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-transparent px-3 py-2 text-sm text-[#E5E5E5] placeholder-[#A3A3A3] focus:outline-none resize-none max-h-28 overflow-y-auto"
          />

          {/* Circular Send / Update Button */}
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            title={editingMessage ? 'Perbarui pesan' : 'Kirim pesan'}
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ${
              input.trim() && !isLoading
                ? editingMessage
                  ? 'bg-neutral-200 text-[#111111] hover:bg-white active:scale-95 shadow-md shadow-neutral-500/10'
                  : 'bg-neutral-200 text-[#111111] hover:bg-white active:scale-95 shadow-md shadow-neutral-500/10'
                : 'bg-[#262626] text-[#A3A3A3] cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : editingMessage ? (
              <Check className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4 -translate-x-0.5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
