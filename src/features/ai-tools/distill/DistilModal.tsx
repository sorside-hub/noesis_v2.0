import React, { useState, useEffect } from 'react';
import { Sparkles, Copy, Check, RefreshCw, Key, Cpu, AlertCircle, Database } from 'lucide-react';
import { MarkdownRenderer } from '../../../shared/components/MarkdownRenderer';
import { useDistill } from './useDistill';

interface DistilModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteId?: string;
  title: string;
  content: string;
  onDistillSaved?: (distilledText: string) => void;
}

export const DistilModal: React.FC<DistilModalProps> = ({
  isOpen,
  onClose,
  noteId,
  title,
  content,
  onDistillSaved,
}) => {
  const {
    distillation,
    loading: isLoading,
    error: distillError,
    loadDistillation,
    runDistill,
    clearDistillation,
  } = useDistill();

  const [localError, setLocalError] = useState<string | null>(null);
  const [needsApiKey, setNeedsApiKey] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isSavedInIDB, setIsSavedInIDB] = useState<boolean>(false);

  const error = localError || distillError;
  const distilledText = distillation?.content || '';

  const handleStartDistill = async () => {
    if (!content.trim()) {
      setLocalError('Catatan ini masih kosong, tidak ada teks yang dapat didistil.');
      return;
    }

    setLocalError(null);
    setNeedsApiKey(false);
    setIsSavedInIDB(false);

    try {
      const resultText = await runDistill({
        noteId,
        title,
        content,
        model: 'llama-3.3-70b-versatile',
      });

      if (resultText && noteId) {
        setIsSavedInIDB(true);
        onDistillSaved?.(resultText);
      }
    } catch (err: any) {
      if (err?.message?.includes('GROQ_API_KEY') || err?.message?.includes('Key')) {
        setNeedsApiKey(true);
      }
      setLocalError(err?.message || 'Terjadi kesalahan saat memproses distilasi.');
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      setLocalError(null);
      setNeedsApiKey(false);
      setIsSavedInIDB(false);
      clearDistillation();

      // Check if there is already a saved distillation in NoesisDB
      if (noteId) {
        loadDistillation(noteId).then((record) => {
          if (!isMounted) return;
          if (record && record.content) {
            setIsSavedInIDB(true);
          } else {
            handleStartDistill();
          }
        });
      } else {
        handleStartDistill();
      }
    } else {
      clearDistillation();
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, noteId]);

  const handleCopy = () => {
    if (!distilledText) return;
    navigator.clipboard.writeText(distilledText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      {/* Overlay Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-fadeIn"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-[#141414] border border-[#2A2A2A] rounded-2xl flex flex-col max-h-[85vh] shadow-2xl z-10 overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#262626] bg-[#1A1A1A]/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-[#A855F7]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm text-[#E5E5E5] leading-tight">
                  Distilasi Catatan
                </h3>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-[#C084FC] text-[10px] font-semibold tracking-wide">
                  <Cpu className="w-2.5 h-2.5" />
                  Groq LLaMA 3.3
                </span>
                {isSavedInIDB && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#30D158]/15 border border-[#30D158]/30 text-[#30D158] text-[10px] font-semibold tracking-wide">
                    <Database className="w-2.5 h-2.5" />
                    NoesisDB
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Missing Groq API Key notice */}
          {needsApiKey && (
            <div className="p-3.5 bg-[#1F1926] border border-[#8B5CF6]/40 rounded-xl space-y-2 text-xs">
              <div className="flex items-start gap-2.5 text-[#C084FC]">
                <Key className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold text-white">GROQ_API_KEY Belum Dikonfigurasi</p>
                  <p className="text-[#A78BFA] text-[11px] leading-relaxed">
                    Fitur distilasi membutuhkan Groq API Key. Silakan atur variabel <code className="px-1 py-0.5 bg-[#14101A] border border-[#3B2D50] rounded text-[#E5E5E5] font-mono">GROQ_API_KEY</code> pada environment variable (<span className="font-mono text-[#E5E5E5]">.env</span>) aplikasi Anda terlebih dahulu.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error banner */}
          {error && !needsApiKey && (
            <div className="p-3 bg-[#261515] border border-[#FF453A]/40 rounded-xl flex items-start gap-2 text-xs text-[#FF857F]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#FF453A]" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && !distilledText && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <div className="relative">
                <div className="w-10 h-10 rounded-full border-2 border-[#8B5CF6]/20 border-t-[#8B5CF6] animate-spin" />
                <Sparkles className="w-4 h-4 text-[#A855F7] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <p className="text-xs text-[#A3A3A3] font-medium">
                Mendistilasi catatan dengan <span className="text-[#C084FC]">Groq LLaMA 3.3</span>...
              </p>
            </div>
          )}

          {/* Distilled Result */}
          {distilledText && (
            <div className="bg-[#181818] border border-[#282828] rounded-xl p-4 text-xs leading-relaxed text-[#E5E5E5] space-y-2">
              {distillation?.isStale && (
                <div className="mb-2 p-2 bg-[#261F10] border border-[#D97706]/30 text-[#FBBF24] rounded-lg text-[11px] flex items-center justify-between">
                  <span>Catatan telah diperbarui sejak distilasi ini dibuat.</span>
                </div>
              )}
              <MarkdownRenderer content={distilledText} />
              {isLoading && (
                <span className="inline-block w-2 h-4 bg-[#A855F7] animate-pulse ml-1 align-middle" />
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 border-t border-[#262626] bg-[#1A1A1A]/70 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => handleStartDistill()}
            disabled={isLoading}
            className="px-3 py-1.5 bg-[#222222] hover:bg-[#2C2C2C] border border-[#303030] text-[#D4D4D4] text-xs font-medium rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#A855F7]' : ''}`} />
            <span>Distil Ulang</span>
          </button>

          <div className="flex items-center gap-2">
            {distilledText && (
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1.5 bg-[#2A2A2A] hover:bg-[#333333] border border-[#3D3D3D] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#30D158]" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#A3A3A3]" />
                    <span>Salin Hasil</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-semibold rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
