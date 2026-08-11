import React from 'react';
import { X, Trash2, Cpu, Info, Sparkles, Smartphone } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearChat: () => void;
  messageCount: number;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onClearChat,
  messageCount,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none">
      <div className="w-full max-w-sm bg-[#1C1C1C] border border-[#303030] rounded-2xl p-5 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#303030]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#4F8CFF]" />
            <h2 className="font-semibold text-base text-[#E5E5E5]">
              Pengaturan Noesis v2
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#262626] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Options */}
        <div className="space-y-4 text-xs">
          {/* AI Model Info */}
          <div className="p-3 bg-[#131313] border border-[#303030] rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-4 h-4 text-[#4F8CFF]" />
              <div>
                <p className="font-medium text-[#E5E5E5]">Model AI</p>
                <p className="text-[10px] text-[#A3A3A3]">Google Gemini 3.6 Flash</p>
              </div>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 rounded-full border border-emerald-500/20">
              Aktif
            </span>
          </div>

          {/* PWA Info */}
          <div className="p-3 bg-[#131313] border border-[#303030] rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-4 h-4 text-[#4F8CFF]" />
              <div>
                <p className="font-medium text-[#E5E5E5]">Mode Aplikasi</p>
                <p className="text-[10px] text-[#A3A3A3]">Mobile-first PWA Ready</p>
              </div>
            </div>
            <span className="text-[11px] text-[#A3A3A3]">v2.0</span>
          </div>

          {/* Chat Storage Info & Clear */}
          <div className="p-3 bg-[#131313] border border-[#303030] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Info className="w-4 h-4 text-[#A3A3A3]" />
                <div>
                  <p className="font-medium text-[#E5E5E5]">Pesan Tersimpan</p>
                  <p className="text-[10px] text-[#A3A3A3]">
                    {messageCount} pesan di penyimpanan lokal
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                onClearChat();
                onClose();
              }}
              disabled={messageCount === 0}
              className={`w-full py-2 px-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-all ${
                messageCount > 0
                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 active:scale-98'
                  : 'bg-[#1C1C1C] text-[#A3A3A3] border border-[#303030] cursor-not-allowed opacity-60'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Semua Percakapan</span>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-2 text-center text-[10px] text-[#A3A3A3]">
          Noesis v2 • Personal AI Assistant & Second Brain
        </div>
      </div>
    </div>
  );
};
