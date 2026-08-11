import React from 'react';
import { Theme } from '../types/theme';
import { Layers, FileText, Activity, Clock, ChevronRight, Sparkles } from 'lucide-react';
import { formatDateToDMY } from '../../../shared/utils/dateUtils';

interface ThemeCardProps {
  theme: Theme;
  onClick?: (theme: Theme) => void;
}

export const ThemeCard: React.FC<ThemeCardProps> = ({ theme, onClick }) => {
  const formatTime = (ts: number) => {
    return formatDateToDMY(ts);
  };

  const getStrengthBadge = (strength: number) => {
    const percent = Math.min(100, Math.round(strength * 100));

    if (strength >= 0.75) {
      return {
        label: `Kuat (${percent}%)`,
        bgColor: 'bg-[#282828]',
        borderColor: 'border-[#3A3A3A]',
        textColor: 'text-white font-semibold',
      };
    } else if (strength >= 0.5) {
      return {
        label: `Moderat (${percent}%)`,
        bgColor: 'bg-[#202020]',
        borderColor: 'border-[#303030]',
        textColor: 'text-[#CCCCCC] font-medium',
      };
    } else {
      return {
        label: `Berkembang (${percent}%)`,
        bgColor: 'bg-[#181818]',
        borderColor: 'border-[#262626]',
        textColor: 'text-[#8E8E93]',
      };
    }
  };

  const badge = getStrengthBadge(theme.strength);
  const noteCount = theme.noteCount || (theme.relatedNoteIds ? theme.relatedNoteIds.length : 0);

  return (
    <div
      onClick={() => onClick && onClick(theme)}
      className="group relative bg-[#1C1C1C] hover:bg-[#222222] border border-[#2A2A2A] hover:border-[#383838] rounded-2xl p-4 sm:p-5 shadow-sm transition-all duration-200 cursor-pointer flex flex-col space-y-3"
    >
      {/* Header: Simple Icon + Theme Title + Chevron */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#242424] group-hover:bg-[#2C2C2C] flex items-center justify-center shrink-0 mt-0.5 transition-colors border border-[#303030] group-hover:border-[#404040]">
            <Layers className="w-4 h-4 text-[#E5E5E5]" />
          </div>
          <h3 className="text-sm font-bold text-[#E5E5E5] group-hover:text-white transition-colors leading-snug line-clamp-2">
            {theme.title}
          </h3>
        </div>
        <ChevronRight className="w-4 h-4 text-[#737373] group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
      </div>

      {/* Description Snippet */}
      {theme.description && (
        <p className="text-xs text-[#A3A3A3] line-clamp-2 leading-relaxed pl-11">
          {theme.description}
        </p>
      )}

      {/* Badges & Metrics */}
      <div className="pt-2.5 border-t border-[#262626] flex flex-wrap items-center justify-between gap-2 text-[11px] pl-11">
        {/* Note Count Badge */}
        <div className="flex items-center gap-1.5 font-medium text-[#8E8E93]">
          <FileText className="w-3.5 h-3.5 text-[#8E8E93]" />
          <span className="text-[#CCCCCC]">{noteCount} Catatan Terkait</span>
        </div>

        {/* Strength Indicator Badge */}
        <div
          className={`px-2.5 py-0.5 rounded-full border text-[10px] flex items-center gap-1 shadow-xs ${badge.bgColor} ${badge.borderColor} ${badge.textColor}`}
        >
          <Activity className="w-3 h-3 opacity-80" />
          <span>{badge.label}</span>
        </div>
      </div>

      {/* Footer Meta */}
      <div className="flex items-center justify-between text-[10px] text-[#737373] pt-1 pl-11">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-[#737373]" />
          <span>Terbentuk: {formatTime(theme.createdAt)}</span>
        </span>
        <span className="flex items-center gap-1 bg-[#222222] px-2 py-0.5 rounded-md border border-[#2E2E2E] text-[#A3A3A3]">
          <Sparkles className="w-3 h-3 text-[#8E8E93]" />
          <span>Semantic Theme</span>
        </span>
      </div>
    </div>
  );
};
