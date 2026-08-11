import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { Brain, Sparkles, Clock, FileText, Loader2, RefreshCw, AlertCircle, CheckCircle2, Layers, ArrowLeft } from 'lucide-react';
import { getNotes } from '../../vault/services/noteService';
import { ThinkingPattern } from '../types/thinkingPattern';
import { getSavedThinkingPatterns, generateThinkingPatterns } from '../services/thinkingPatternService';
import { ThinkingPatternCard } from '../components/ThinkingPatternCard';
import { ThinkingPatternDetailPage } from './ThinkingPatternDetailPage';
import { useNavigation } from '../../../core/navigation';
import { VaultHeader } from '../../vault/components/VaultHeader';

interface ThinkingPatternPageProps {
  onBack?: () => void;
}

let savedThinkingPatternListScrollTop = 0;

export const ThinkingPatternPage: React.FC<ThinkingPatternPageProps> = ({ onBack }) => {
  const { currentLocation, navigate, goBack } = useNavigation();
  const [noteCount, setNoteCount] = useState<number>(0);
  const [patterns, setPatterns] = useState<ThinkingPattern[]>([]);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const isRestoringScrollRef = useRef<boolean>(true);

  useLayoutEffect(() => {
    if (loading) return;
    if (currentLocation.insightViewState !== 'patternDetail' && listContainerRef.current) {
      isRestoringScrollRef.current = true;
      listContainerRef.current.scrollTop = savedThinkingPatternListScrollTop;
      const raf = requestAnimationFrame(() => {
        if (listContainerRef.current) {
          listContainerRef.current.scrollTop = savedThinkingPatternListScrollTop;
        }
        const timer = setTimeout(() => {
          if (listContainerRef.current) {
            listContainerRef.current.scrollTop = savedThinkingPatternListScrollTop;
          }
          isRestoringScrollRef.current = false;
        }, 50);
        return () => clearTimeout(timer);
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [currentLocation.insightViewState, loading]);

  const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (loading || isRestoringScrollRef.current) return;
    savedThinkingPatternListScrollTop = e.currentTarget.scrollTop;
  };

  const activePatternId = currentLocation.patternId;
  const selectedPattern = patterns.find((p) => p.id === activePatternId) || null;

  // Load notes and stored patterns on component mount
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [fetchedNotes, savedPatterns] = await Promise.all([
          getNotes(),
          getSavedThinkingPatterns(),
        ]);

        if (!isMounted) return;

        setNoteCount(fetchedNotes ? fetchedNotes.length : 0);
        setPatterns(savedPatterns || []);

        if (savedPatterns && savedPatterns.length > 0) {
          // Find latest createdAt
          const latest = Math.max(...savedPatterns.map((p) => p.createdAt || 0));
          if (latest > 0) {
            setLastAnalyzedAt(latest);
          }
        }
      } catch (err: any) {
        console.error('Gagal memuat data awal Thinking Pattern:', err);
        if (isMounted) {
          setError('Gagal memuat data catatan dari Vault.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle Analysis Generator Trigger
  const handleAnalyze = async () => {
    if (analyzing) return;
    setError(null);
    setAnalyzing(true);

    try {
      const freshNotes = await getNotes();
      setNoteCount(freshNotes ? freshNotes.length : 0);

      if (!freshNotes || freshNotes.length === 0) {
        throw new Error('Vault Anda belum memiliki catatan. Tambahkan minimal 2 catatan di Vault untuk menganalisis pola pemikiran.');
      }

      if (freshNotes.length < 2) {
        throw new Error('Vault Anda baru memiliki 1 catatan. Tambahkan minimal 1 catatan lagi (minimal 2 catatan) di Vault untuk menganalisis pola pemikiran.');
      }

      // If patterns exist, force re-analysis to refresh data pipeline
      const force = patterns.length > 0;
      const result = await generateThinkingPatterns(freshNotes, force);
      
      setPatterns(result.patterns);
      
      const now = Date.now();
      setLastAnalyzedAt(now);
    } catch (err: any) {
      console.error('Error saat menjalankan Thinking Pattern Generator:', err);
      setError(err?.message || 'Terjadi kesalahan saat menganalisis pola pemikiran.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSelectPattern = (pattern: ThinkingPattern) => {
    navigate({
      tab: 'insight',
      insightViewState: 'patternDetail',
      patternId: pattern.id,
    });
  };

  if (currentLocation.insightViewState === 'patternDetail') {
    if (loading && !selectedPattern) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-300 space-y-2">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-300" />
          <p className="text-xs">Memuat detail pola pemikiran...</p>
        </div>
      );
    }

    if (selectedPattern) {
      return (
        <ThinkingPatternDetailPage
          pattern={selectedPattern}
          onBack={goBack}
        />
      );
    }
  }

  const formatLastAnalyzed = (timestamp: number | null): string => {
    if (!timestamp) return 'Belum pernah dianalisis';
    const date = new Date(timestamp);
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Self-contained Header with Back button only */}
      <VaultHeader onBack={onBack} />

      {/* Scrollable List Container */}
      <div
        ref={listContainerRef}
        onScroll={handleListScroll}
        className="flex-1 overflow-y-auto px-4 py-5 flex flex-col max-w-lg mx-auto w-full pb-20 select-none animate-fadeIn space-y-5"
      >
      {/* Header: Icon + Title + Line */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-[#2A2A2A]">
        <Brain className="w-5 h-5 text-[#E5E5E5]" />
        <h1 className="text-xl font-bold text-[#E5E5E5] tracking-tight">
          Thinking Pattern
        </h1>
      </div>

      {/* SECTION 1: Intro UI */}
      <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[#E5E5E5] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#E5E5E5]" />
            <span>Ekstraksi Pola Kognitif</span>
          </h2>
          <p className="text-xs text-[#A3A3A3] mt-1 leading-relaxed">
            Temukan pola hubungan antar ide, pengalaman, dan pengetahuanmu.
          </p>
        </div>

        {/* Metadata info: Jumlah notes & waktu analisis terakhir */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="p-2.5 rounded-xl bg-[#181818] border border-[#282828] flex items-center gap-2 text-xs">
            <FileText className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-[#8E8E93]">Catatan Dianalisis</p>
              <p className="font-semibold text-[#E5E5E5] truncate">
                {loading ? '...' : `${noteCount} Notes`}
              </p>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#181818] border border-[#282828] flex items-center gap-2 text-xs">
            <Clock className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-[#8E8E93]">Analisis Terakhir</p>
              <p className="font-semibold text-[#CCCCCC] text-[11px] truncate">
                {formatLastAnalyzed(lastAnalyzedAt)}
              </p>
            </div>
          </div>
        </div>

        {/* Error State Inline */}
        {error && (
          <div className="p-3 rounded-xl bg-[#181818] border border-[#282828] text-xs text-[#A3A3A3] space-y-1.5">
            <div className="flex items-center gap-2 font-medium text-[#E5E5E5]">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[#E5E5E5]" />
              <span>Gagal Melakukan Analisis</span>
            </div>
            <p className="text-[10px] text-[#A3A3A3] leading-relaxed">{error}</p>
          </div>
        )}

        {/* Action Button: Analyze Pattern */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing || loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#E5E5E5] hover:bg-white active:scale-[0.98] text-[#111111] text-xs font-semibold shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#111111]" />
                <span>Menganalisis Pola Pemikiran...</span>
              </>
            ) : (
              <>
                <Brain className="w-4 h-4 text-[#111111]" />
                <span>Analyze Pattern</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* SECTION 2: Active Pattern List or Empty/Loading State */}
      {analyzing && patterns.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-12 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#242424] border border-[#303030] flex items-center justify-center text-[#E5E5E5]">
            <Loader2 className="w-6 h-6 animate-spin text-[#E5E5E5]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#E5E5E5]">
              Menganalisis {noteCount} Catatan Vault...
            </p>
            <p className="text-xs text-[#A3A3A3] mt-1 max-w-xs mx-auto">
              Noesis AI sedang mengekstrak kerangka kognitif dan koneksi ide.
            </p>
          </div>
        </div>
      ) : patterns.length === 0 && !error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-12 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#242424] border border-[#303030] flex items-center justify-center text-[#A3A3A3]">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#E5E5E5]">
              Belum ada pola ditemukan.
            </p>
            <p className="text-xs text-[#A3A3A3] mt-1 max-w-xs mx-auto">
              Klik tombol "Analyze Pattern" di atas untuk memulai analisis otomatis.
            </p>
          </div>
        </div>
      ) : patterns.length > 0 ? (
        <div className="space-y-3 pt-2 animate-fadeIn">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-[#E5E5E5] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#8E8E93]" />
              <span>Active Thinking Patterns</span>
            </h2>
            <span className="text-[11px] font-medium text-[#CCCCCC] bg-[#242424] border border-[#303030] px-2.5 py-0.5 rounded-full">
              {patterns.length} Pola
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {patterns.map((pattern) => (
              <ThinkingPatternCard
                key={pattern.id}
                pattern={pattern}
                onClick={handleSelectPattern}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
    </div>
  );
};
