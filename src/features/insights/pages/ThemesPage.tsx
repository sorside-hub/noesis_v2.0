import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { Layers, Sparkles, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { VaultHeader } from '../../vault/components/VaultHeader';
import { getNotes } from '../../vault/services/noteService';
import { NoteItem } from '../../vault/pages/VaultPage';
import { Theme } from '../types/theme';
import { themeService } from '../services/themeService';
import { ThemeCard } from '../components/ThemeCard';
import { ThemeDetailPage } from './ThemeDetailPage';
import { useNavigation } from '../../../core/navigation';

interface ThemesPageProps {
  onBack?: () => void;
  onSelectTheme?: (theme: Theme) => void;
}

let savedThemeListScrollTop = 0;

export const ThemesPage: React.FC<ThemesPageProps> = ({ onBack, onSelectTheme }) => {
  const { currentLocation, navigate, goBack } = useNavigation();
  const selectedThemeId = currentLocation.themeId || null;

  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const isRestoringScrollRef = useRef<boolean>(true);

  useLayoutEffect(() => {
    if (loading) return;
    if (!selectedThemeId && listContainerRef.current) {
      isRestoringScrollRef.current = true;
      listContainerRef.current.scrollTop = savedThemeListScrollTop;
      const raf = requestAnimationFrame(() => {
        if (listContainerRef.current) {
          listContainerRef.current.scrollTop = savedThemeListScrollTop;
        }
        const timer = setTimeout(() => {
          if (listContainerRef.current) {
            listContainerRef.current.scrollTop = savedThemeListScrollTop;
          }
          isRestoringScrollRef.current = false;
        }, 50);
        return () => clearTimeout(timer);
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [selectedThemeId, loading]);

  const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (loading || isRestoringScrollRef.current) return;
    savedThemeListScrollTop = e.currentTarget.scrollTop;
  };

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [fetchedNotes, savedThemes] = await Promise.all([
          getNotes(),
          themeService.getSavedThemes(),
        ]);

        if (!isMounted) return;

        setNotes(fetchedNotes || []);
        setThemes(savedThemes || []);
      } catch (err: any) {
        console.error('Gagal memuat data awal Themes:', err);
        if (isMounted) {
          setError('Gagal memuat data catatan atau tema dari penyimpanan lokal.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleGenerateThemes = async () => {
    if (notes.length < 2) {
      setError('Diperlukan minimal 2 catatan di Vault untuk menganalisis dan membentuk Themes.');
      return;
    }

    setAnalyzing(true);
    setError(null);
    try {
      const generated = await themeService.generateThemes(notes);
      setThemes(generated);
    } catch (err: any) {
      console.error('Gagal membuat Themes:', err);
      setError(err?.message || 'Terjadi kesalahan saat membuat Themes.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleThemeClick = (theme: Theme) => {
    if (onSelectTheme) {
      onSelectTheme(theme);
    } else {
      navigate({
        tab: 'insight',
        insightViewState: 'themes',
        themeId: theme.id,
      });
    }
  };

  // Render Theme Detail Page when themeId is present in navigation location
  if (selectedThemeId) {
    return (
      <ThemeDetailPage
        themeId={selectedThemeId}
        onBack={goBack}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none animate-fadeIn">
      {/* Self-contained Header */}
      <VaultHeader onBack={onBack} />

      {/* Scrollable Container */}
      <div
        ref={listContainerRef}
        onScroll={handleListScroll}
        className="flex-1 overflow-y-auto px-4 py-5 flex flex-col max-w-lg mx-auto w-full pb-24"
      >
        {/* Header: Icon + Title + Line */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2A2A2A]">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-[#E5E5E5]" />
            <h1 className="text-xl font-bold text-[#E5E5E5] tracking-tight">
              Themes Overview
            </h1>
          </div>

          {themes.length > 0 && (
            <button
              onClick={handleGenerateThemes}
              disabled={analyzing || notes.length < 2}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#242424] hover:bg-[#2C2C2C] text-xs font-medium text-[#E5E5E5] border border-[#333333] transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#A3A3A3] ${analyzing ? 'animate-spin' : ''}`} />
              <span>{analyzing ? 'Menganalisis...' : 'Analisis Ulang'}</span>
            </button>
          )}
        </div>

        {/* Subtitle / Description */}
        <p className="text-xs text-[#A3A3A3] mt-2 mb-4 leading-relaxed">
          Daftar topik utama yang berkembang secara alami dari klaster semantik catatan di Vault Anda.
        </p>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[#181818] border border-[#282828] text-[#A3A3A3] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#E5E5E5]" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="w-7 h-7 animate-spin text-[#E5E5E5] mb-3" />
            <p className="text-sm font-medium text-[#E5E5E5]">Memuat data Themes...</p>
            <p className="text-xs text-[#A3A3A3] mt-1">Mengambil data dari IndexedDB lokal</p>
          </div>
        ) : themes.length === 0 ? (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center bg-[#1C1C1C] rounded-2xl border border-[#2A2A2A] mt-2 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-[#242424] border border-[#303030] flex items-center justify-center mb-4 text-[#E5E5E5]">
              <Sparkles className="w-6 h-6 text-[#E5E5E5]" />
            </div>
            <h2 className="text-base font-semibold text-[#E5E5E5] mb-1">
              Belum Ada Themes Terbentuk
            </h2>
            <p className="text-xs text-[#A3A3A3] max-w-xs mb-6 leading-relaxed">
              Themes Engine akan menganalisis hubungan semantik antar-catatan Anda secara organik untuk mengekstrak topik-topik utama.
            </p>

            <button
              onClick={handleGenerateThemes}
              disabled={analyzing || notes.length < 2}
              className="flex items-center justify-center gap-2 w-full max-w-xs py-2.5 px-4 rounded-xl bg-[#E5E5E5] hover:bg-white text-[#111111] font-semibold text-xs shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#111111]" />
                  <span>Menganalisis Klaster Semantik...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#111111]" />
                  <span>Jalankan Generator Themes</span>
                </>
              )}
            </button>

            {notes.length < 2 && (
              <p className="text-[11px] text-[#8E8E93] mt-3">
                Membutuhkan minimal 2 catatan di Vault. Saat ini terdapat {notes.length} catatan.
              </p>
            )}
          </div>
        ) : (
          /* Theme Card List */
          <div className="space-y-3.5">
            {themes.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                onClick={handleThemeClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
