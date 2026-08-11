import React, { useState } from 'react';
import { Sparkles, Check, X, Copy, CheckCheck, FileText, Wand2 } from 'lucide-react';

interface AutoCorrectModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalText: string;
  correctedText: string;
  onApply: (newContent: string) => void;
}

export const AutoCorrectModal: React.FC<AutoCorrectModalProps> = ({
  isOpen,
  onClose,
  originalText,
  correctedText,
  onApply,
}) => {
  const [activeTab, setActiveTab] = useState<'corrected' | 'original'>('corrected');
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCopyCurrent = () => {
    const textToCopy = activeTab === 'corrected' ? correctedText : originalText;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyClick = () => {
    onApply(correctedText);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in select-none">
      <div
        className="w-full max-w-xl bg-[#181818] border border-[#2F2F2F] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 border-b border-[#2A2A2A] bg-[#1F1F1F]/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 rounded-xl text-[#A855F7]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#E5E5E5]">Auto Correct Preview</h3>
                <span className="text-[10px] font-semibold text-[#C084FC] bg-[#8B5CF6]/20 px-2 py-0.5 rounded-full border border-[#8B5CF6]/40">
                  Groq AI
                </span>
              </div>
              <p className="text-[11px] text-[#8E8E93] mt-0.5">
                Lihat hasil perbaikan ejaan dan tata bahasa tulisanmu.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#8E8E93] hover:text-white hover:bg-[#2A2A2A] rounded-lg transition-all cursor-pointer"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher & Action Header */}
        <div className="px-4 py-2.5 bg-[#141414] border-b border-[#262626] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center bg-[#1E1E1E] p-1 rounded-xl border border-[#2A2A2A]">
            <button
              type="button"
              onClick={() => setActiveTab('corrected')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'corrected'
                  ? 'bg-[#8B5CF6] text-white shadow-sm'
                  : 'text-[#8E8E93] hover:text-[#D4D4D4]'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Hasil Perbaikan</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('original')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'original'
                  ? 'bg-[#2F2F2F] text-white shadow-sm'
                  : 'text-[#8E8E93] hover:text-[#D4D4D4]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Teks Asli</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyCurrent}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-[#8E8E93] hover:text-[#C084FC] bg-[#1E1E1E] hover:bg-[#282828] border border-[#2A2A2A] rounded-lg transition-all cursor-pointer shrink-0"
            title="Salin teks tab saat ini"
          >
            {copied ? (
              <>
                <CheckCheck className="w-3.5 h-3.5 text-[#C084FC]" />
                <span className="text-[#C084FC] font-medium">Tersalin</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Salin</span>
              </>
            )}
          </button>
        </div>

        {/* Tab Content Display Area */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-[220px] max-h-[380px] bg-[#121212]">
          {activeTab === 'corrected' ? (
            <div className="text-xs sm:text-sm text-[#E5E5E5] leading-relaxed whitespace-pre-wrap font-sans">
              {correctedText}
            </div>
          ) : (
            <div className="text-xs sm:text-sm text-[#9E9E9E] leading-relaxed whitespace-pre-wrap font-sans">
              {originalText}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-t border-[#2A2A2A] bg-[#1F1F1F]/80 flex items-center justify-between shrink-0 gap-3">
          <p className="text-[11px] text-[#8E8E93] hidden sm:block">
            Tekan <strong className="text-[#E5E5E5] font-semibold">Apply</strong> untuk mengganti isi catatan.
          </p>
          <div className="flex items-center gap-2.5 ml-auto w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#262626] hover:bg-[#333333] active:scale-95 text-[#D4D4D4] font-medium text-xs rounded-xl transition-all cursor-pointer min-w-[70px]"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApplyClick}
              className="px-5 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] active:scale-95 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-[#8B5CF6]/25 min-w-[90px]"
            >
              <Check className="w-4 h-4" />
              <span>Apply</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
