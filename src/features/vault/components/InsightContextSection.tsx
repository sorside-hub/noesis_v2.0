import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Brain,
  Layers,
  ArrowRightLeft,
  Compass,
  Loader2,
} from 'lucide-react';
import { useNavigation } from '../../../core/navigation';
import { themeService } from '../../insights/services/themeService';
import { getSavedThinkingPatterns } from '../../insights/services/thinkingPatternService';
import { connectionService } from '../../insights/services/connectionService';
import { Theme } from '../../insights/types/theme';
import { ThinkingPattern } from '../../insights/types/thinkingPattern';
import { Connection } from '../../insights/types/connection';

interface InsightContextSectionProps {
  currentNoteId?: string;
  onCloseDrawer?: () => void;
}

export const InsightContextSection: React.FC<InsightContextSectionProps> = ({
  currentNoteId,
  onCloseDrawer,
}) => {
  const { navigate } = useNavigation();
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('noesis_drawer_expanded_insights');
    return saved !== null ? saved === 'true' : false;
  });
  const [loading, setLoading] = useState<boolean>(true);

  const [themes, setThemes] = useState<Theme[]>([]);
  const [patterns, setPatterns] = useState<ThinkingPattern[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);

  useEffect(() => {
    let isMounted = true;

    const fetchInsightContext = async () => {
      if (!currentNoteId) {
        setThemes([]);
        setPatterns([]);
        setConnections([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [savedThemes, savedPatterns, savedConnections] = await Promise.all([
          themeService.getSavedThemes().catch(() => []),
          getSavedThinkingPatterns().catch(() => []),
          connectionService.getSavedConnections().catch(() => []),
        ]);

        if (!isMounted) return;

        const filteredThemes = (savedThemes || []).filter(
          (t) => t.relatedNoteIds && t.relatedNoteIds.includes(currentNoteId)
        );

        const filteredPatterns = (savedPatterns || []).filter(
          (p) => p.relatedNoteIds && p.relatedNoteIds.includes(currentNoteId)
        );

        const filteredConnections = (savedConnections || []).filter(
          (c) =>
            (c.sourceIds && c.sourceIds.includes(currentNoteId)) ||
            (c.targetIds && c.targetIds.includes(currentNoteId))
        );

        setThemes(filteredThemes);
        setPatterns(filteredPatterns);
        setConnections(filteredConnections);
      } catch (err) {
        console.error('Error fetching insight context for note:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchInsightContext();

    return () => {
      isMounted = false;
    };
  }, [currentNoteId]);

  const totalCount = themes.length + patterns.length + connections.length;

  const handleSelectTheme = (theme: Theme) => {
    navigate({
      tab: 'insight',
      insightViewState: 'themes',
      themeId: theme.id,
    });
    onCloseDrawer?.();
  };

  const handleSelectPattern = (pattern: ThinkingPattern) => {
    navigate({
      tab: 'insight',
      insightViewState: 'patternDetail',
      patternId: pattern.id,
    });
    onCloseDrawer?.();
  };

  const handleSelectConnection = (connection: Connection) => {
    navigate({
      tab: 'insight',
      insightViewState: 'connectionDetail',
      connectionId: connection.id,
    });
    onCloseDrawer?.();
  };

  return (
    <div className="pt-3 border-t border-[#2A2A2A] space-y-2 select-none">
      {/* Section Collapsible Header */}
      <button
        type="button"
        onClick={() => {
          const next = !isExpanded;
          setIsExpanded(next);
          localStorage.setItem('noesis_drawer_expanded_insights', String(next));
        }}
        className="w-full flex items-center justify-between group py-1 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-neutral-400 shrink-0" />
          <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider group-hover:text-[#E5E5E5] transition-colors">
            Insight Context
          </span>
          <span className="text-[10px] font-mono text-[#737373] bg-[#222222] px-1.5 py-0.2 rounded-md border border-[#2A2A2A]">
            {totalCount}
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
        <div className="pt-1 space-y-3 animate-fade-in">
          {loading ? (
            <div className="flex items-center gap-2 py-2 text-[11px] text-[#737373] pl-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400" />
              <span>Memuat konteks insight...</span>
            </div>
          ) : totalCount === 0 ? (
            <p className="text-[11px] text-[#737373] italic pl-2 py-1">
              Belum ada konteks insight untuk catatan ini
            </p>
          ) : (
            <div className="space-y-3">
              {/* 1. Related Themes */}
              {themes.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#FF9500] uppercase tracking-wider pl-1">
                    <Layers className="w-3 h-3" />
                    <span>Themes ({themes.length})</span>
                  </div>
                  <div className="space-y-1">
                    {themes.map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => handleSelectTheme(theme)}
                        className="w-full text-left p-2 bg-[#1C1C1C] hover:bg-[#242424] border border-[#2B2B2B] hover:border-[#FF9500]/50 rounded-xl transition-all cursor-pointer group flex items-center justify-between gap-2"
                        title={`Buka Theme: ${theme.title}`}
                      >
                        <span className="text-[11px] font-medium text-[#E5E5E5] group-hover:text-[#FF9500] truncate">
                          {theme.title}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-[#737373] group-hover:text-[#E5E5E5] shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Thinking Patterns */}
              {patterns.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider pl-1">
                    <Brain className="w-3 h-3" />
                    <span>Thinking Patterns ({patterns.length})</span>
                  </div>
                  <div className="space-y-1">
                    {patterns.map((pattern) => (
                      <button
                        key={pattern.id}
                        type="button"
                        onClick={() => handleSelectPattern(pattern)}
                        className="w-full text-left p-2 bg-[#1C1C1C] hover:bg-[#242424] border border-[#2B2B2B] hover:border-neutral-500/50 rounded-xl transition-all cursor-pointer group flex items-center justify-between gap-2"
                        title={`Buka Pattern: ${pattern.title}`}
                      >
                        <span className="text-[11px] font-medium text-[#E5E5E5] group-hover:text-white truncate">
                          {pattern.title}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-[#737373] group-hover:text-[#E5E5E5] shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Connections */}
              {connections.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider pl-1">
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>Connections ({connections.length})</span>
                  </div>
                  <div className="space-y-1">
                    {connections.map((connection) => (
                      <button
                        key={connection.id}
                        type="button"
                        onClick={() => handleSelectConnection(connection)}
                        className="w-full text-left p-2 bg-[#1C1C1C] hover:bg-[#242424] border border-[#2B2B2B] hover:border-neutral-500/50 rounded-xl transition-all cursor-pointer group flex items-center justify-between gap-2"
                        title={`Buka Connection: ${connection.title}`}
                      >
                        <span className="text-[11px] font-medium text-[#E5E5E5] group-hover:text-white truncate">
                          {connection.title}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-[#737373] group-hover:text-[#E5E5E5] shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
