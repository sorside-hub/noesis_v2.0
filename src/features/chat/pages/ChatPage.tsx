import React, { useRef, useEffect, useState } from 'react';
import { Message } from '../../../shared/types';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ArrowDown } from 'lucide-react';
import { Header } from '../../../shared/components/Header';

interface ChatPageProps {
  messages: Message[];
  isLoading: boolean;
  loadingStatus?: string | null;
  onSendMessage: (text: string) => void;
  onEditAndResendMessage?: (messageId: string, text: string) => void;
  onCreateNoteFromAI?: (content: string) => void;
  onOpenNoteById?: (noteId: string) => void;
  activeThreadId?: string;
  activeModel?: string;
  isFallback?: boolean;
  primaryModel?: string;
  ragMode?: 'smart' | 'on' | 'off';
  onOpenSettings?: () => void;
  activeThreadTitle?: string;
  onOpenHistory?: () => void;
  onNewChat?: () => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({
  messages,
  isLoading,
  loadingStatus,
  onSendMessage,
  onEditAndResendMessage,
  onCreateNoteFromAI,
  onOpenNoteById,
  activeThreadId,
  activeModel = 'gemini-3.6-flash',
  isFallback = false,
  primaryModel = 'gemini-3.6-flash',
  ragMode = 'smart',
  onOpenSettings,
  activeThreadTitle,
  onOpenHistory,
  onNewChat,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef<boolean>(true);
  const [showScrollButton, setShowScrollButton] = useState<boolean>(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevMessagesLengthRef = useRef<number>(messages.length);

  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const handleStartEdit = (id: string, content: string) => {
    setEditingMessage({ id, content });
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
  };

  const handleEditSubmit = (id: string, text: string) => {
    isAtBottomRef.current = true;
    setShowScrollButton(false);
    if (onEditAndResendMessage) {
      onEditAndResendMessage(id, text);
    }
    setEditingMessage(null);
  };

  // Reset editing message when thread changes
  useEffect(() => {
    setEditingMessage(null);
  }, [activeThreadId]);

  // Initial scroll to bottom when opening chat / switching thread
  useEffect(() => {
    const scrollToBottomInstant = () => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    };

    scrollToBottomInstant();
    const rAfId = requestAnimationFrame(scrollToBottomInstant);
    const t1 = setTimeout(scrollToBottomInstant, 50);
    const t2 = setTimeout(scrollToBottomInstant, 150);

    isAtBottomRef.current = true;
    setShowScrollButton(false);

    return () => {
      cancelAnimationFrame(rAfId);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [activeThreadId]);

  // Scroll handler: shows floating button while scrolling up, auto-hides after 2.5s of idle reading
  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const isAtBottom = distanceToBottom <= 80;

    isAtBottomRef.current = isAtBottom;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }

    if (isAtBottom) {
      setShowScrollButton(false);
    } else if (messages.length > 0) {
      setShowScrollButton(true);
      // Auto-hide when user stays still while reading
      scrollTimeoutRef.current = setTimeout(() => {
        setShowScrollButton(false);
      }, 2500);
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior,
      });
    }
    isAtBottomRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    setShowScrollButton(false);
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Smart auto-scroll effect
  useEffect(() => {
    const isNewUserMsg =
      messages.length > prevMessagesLengthRef.current &&
      messages[messages.length - 1]?.role === 'user';
    prevMessagesLengthRef.current = messages.length;

    if (isNewUserMsg) {
      isAtBottomRef.current = true;
      setShowScrollButton(false);

      requestAnimationFrame(() => {
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.scrollTo({
              top: containerRef.current.scrollHeight,
              behavior: 'smooth',
            });
          }
        }, 50);
      });
    } else if (isAtBottomRef.current && isLoading) {
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: 'auto',
        });
      }
    }
  }, [messages, isLoading]);

  const handleSendMessage = (text: string) => {
    isAtBottomRef.current = true;
    setShowScrollButton(false);
    onSendMessage(text);
  };

  const lastMsg = messages[messages.length - 1];
  const showThinkingDots = isLoading && (!lastMsg || lastMsg.role === 'user' || !lastMsg.content);

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden relative pb-2">
      {/* Self-contained Header */}
      <Header
        activeThreadTitle={activeThreadTitle}
        onOpenHistory={onOpenHistory}
        onOpenSettings={onOpenSettings}
        onNewChat={onNewChat}
      />

      {/* Floating Badges Overlay (mengambang di atas chat, diposisikan di bawah header) */}
      <div className="absolute top-[62px] left-0 right-0 px-3 flex items-center justify-between z-20 pointer-events-none gap-2">
        {/* Kiri: Model Badge */}
        <button
          onClick={onOpenSettings}
          title={
            isFallback
              ? `Fallback aktif: Menggunakan ${activeModel} (Primary: ${primaryModel})`
              : `Model Aktif: ${activeModel}`
          }
          className={`pointer-events-auto flex items-center gap-1 px-2 py-0.5 rounded-full border backdrop-blur-md shadow-md transition-all cursor-pointer active:scale-95 ${
            isFallback
              ? 'bg-neutral-800 border-neutral-600 text-neutral-300 hover:bg-neutral-700'
              : 'bg-[#1C1C1C]/80 border-[#2A2A2A] text-[#B0B0B0] hover:text-[#FFFFFF] hover:bg-[#252525]/90 hover:border-[#3A3A3A]'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isFallback ? 'bg-neutral-400 animate-pulse' : 'bg-neutral-400'
            }`}
          />
          <span className="text-[10px] font-mono tracking-tight truncate max-w-[110px] sm:max-w-none">
            {activeModel}
          </span>
          {isFallback && (
            <span className="text-[8px] px-1 py-0 bg-neutral-800 text-neutral-300 rounded font-semibold shrink-0">
              Fallback
            </span>
          )}
        </button>

        {/* Kanan: RAG Mode Badge */}
        <button
          onClick={onOpenSettings}
          title={`Mode RAG: ${ragMode.toUpperCase()} (Klik untuk ubah di Pengaturan)`}
          className={`pointer-events-auto flex items-center gap-1 px-2 py-0.5 rounded-full border backdrop-blur-md shadow-md transition-all cursor-pointer active:scale-95 ${
            ragMode === 'smart'
              ? 'bg-neutral-800 border-neutral-600 text-neutral-300 hover:bg-neutral-700'
              : ragMode === 'on'
              ? 'bg-neutral-800 border-neutral-600 text-neutral-300 hover:bg-neutral-700'
              : 'bg-neutral-900/60 border-neutral-600/40 text-neutral-400 hover:bg-neutral-800/80'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              ragMode === 'smart'
                ? 'bg-neutral-400 animate-pulse'
                : ragMode === 'on'
                ? 'bg-neutral-400'
                : 'bg-neutral-500'
            }`}
          />
          <span className="text-[10px] font-mono tracking-tight capitalize">
            {ragMode}
          </span>
        </button>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#262626] text-[#E5E5E5] border border-[#3A3A3A] px-4 py-2 rounded-full text-xs shadow-xl animate-fadeIn pointer-events-none">
          {toastMessage}
        </div>
      )}

      {/* Scrollable Message Area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 pt-[72px] pb-2"
      >
        {messages.length === 0 ? (
          <EmptyState onSelectPrompt={handleSendMessage} />
        ) : (
          <div className="flex flex-col min-h-full pb-2">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onEditMessage={handleStartEdit}
                onCreateNoteFromAI={onCreateNoteFromAI}
                onOpenNoteById={onOpenNoteById}
                isEditing={editingMessage?.id === msg.id}
                onShowToast={showToast}
              />
            ))}

            {/* AI Thinking / Loading Progress Status Indicator */}
            {showThinkingDots && (
              <div className="flex w-full mb-4 justify-start animate-fadeIn">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#181818] border border-[#2A2A2A] rounded-xl text-xs text-[#CCCCCC] shadow-sm select-none">
                  <span className="w-1.5 h-1.5 bg-neutral-300 rounded-full animate-pulse shrink-0" />
                  <span className="font-medium animate-pulse text-[11px] text-[#D4D4D4]">
                    {loadingStatus || '✍️ Menyusun jawaban...'}
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />

            {/* Temporary breathing space at bottom ONLY while AI is generating response */}
            <div
              className={`shrink-0 pointer-events-none transition-all duration-300 ${
                isLoading ? 'h-[10vh]' : 'h-0'
              }`}
            />
          </div>
        )}
      </div>

      {/* Floating Scroll to Bottom Button */}
      <button
        onClick={() => scrollToBottom('smooth')}
        aria-label="Scroll ke bawah"
        title="Scroll ke bawah"
        className={`absolute bottom-20 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center w-10 h-10 bg-[#212121]/95 hover:bg-[#2C2C2C] text-[#E5E5E5] border border-[#444444] rounded-full shadow-2xl backdrop-blur-md transition-all duration-300 cursor-pointer ${
          showScrollButton
            ? 'opacity-100 translate-y-0 pointer-events-auto scale-100 hover:scale-110 active:scale-95'
            : 'opacity-0 translate-y-3 pointer-events-none scale-75'
        }`}
      >
        <ArrowDown className="w-5 h-5 text-neutral-300" />
      </button>

      {/* Input Area */}
      <ChatInput
        onSendMessage={handleSendMessage}
        onEditSubmit={handleEditSubmit}
        editingMessage={editingMessage}
        onCancelEdit={handleCancelEdit}
        isLoading={isLoading}
      />
    </div>
  );
};
