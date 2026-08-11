import React from 'react';
import { Connection } from '../types/connection';
import { ArrowRightLeft, Layers, FileText, ChevronRight, Activity, Sparkles } from 'lucide-react';

interface ConnectionCardProps {
  connection: Connection;
  onClick?: (connectionId: string) => void;
}

export const ConnectionCard: React.FC<ConnectionCardProps> = ({
  connection,
  onClick,
}) => {
  const strengthPercent = Math.round(connection.strength * 100);

  // Calculate themes count and notes count across source and target entities
  const themeCount =
    (connection.sourceType === 'theme' ? connection.sourceIds.length : 0) +
    (connection.targetType === 'theme' ? connection.targetIds.length : 0);

  const noteCount =
    (connection.sourceType === 'note' ? connection.sourceIds.length : 0) +
    (connection.targetType === 'note' ? connection.targetIds.length : 0);

  const isBridge = connection.connectionType === 'theme_bridge';

  return (
    <div
      onClick={() => onClick && onClick(connection.id)}
      className="group relative bg-[#1C1C1C] hover:bg-[#222222] border border-[#2A2A2A] hover:border-[#383838] rounded-2xl p-4 sm:p-5 shadow-sm transition-all duration-200 cursor-pointer flex flex-col space-y-3"
    >
      {/* Header: Icon + Connection Title + Chevron */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#242424] group-hover:bg-[#2C2C2C] flex items-center justify-center shrink-0 mt-0.5 transition-colors border border-[#303030] group-hover:border-[#404040]">
            <ArrowRightLeft className="w-4 h-4 text-[#E5E5E5]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-[#E5E5E5] group-hover:text-white transition-colors leading-snug line-clamp-2">
              {connection.title}
            </h3>
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-[#737373] group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
      </div>

      {/* Description */}
      {connection.description && (
        <p className="text-xs text-[#A3A3A3] line-clamp-2 leading-relaxed pl-11">
          {connection.description}
        </p>
      )}

      {/* Badge Type & Strength Indicator */}
      <div className="pt-2.5 border-t border-[#262626] flex flex-wrap items-center justify-between gap-2 text-[11px] pl-11">
        {/* Type Badge */}
        <div className="flex items-center gap-1.5">
          {isBridge ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#282828] text-white border border-[#3A3A3A] text-[10px] font-semibold shadow-xs">
              <Layers className="w-3 h-3 text-[#E5E5E5]" />
              <span>Theme Bridge</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#202020] text-[#CCCCCC] border border-[#303030] text-[10px] font-medium">
              <FileText className="w-3 h-3 text-[#A3A3A3]" />
              <span>Theme Evidence</span>
            </span>
          )}
        </div>

        {/* Strength Badge */}
        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#222222] border border-[#2E2E2E] text-[#E5E5E5] text-[10px] font-semibold">
          <Activity className="w-3 h-3 text-[#8E8E93]" />
          <span>Strength: {strengthPercent}%</span>
        </div>
      </div>

      {/* Based on / Entity Summary */}
      <div className="flex items-center justify-between text-[11px] text-[#A3A3A3] pt-1 pl-11">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-semibold text-[#737373] tracking-wider">Based on:</span>
          <div className="flex items-center gap-1.5 font-medium text-[#CCCCCC]">
            {themeCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Layers className="w-3 h-3 text-[#8E8E93]" />
                <span>{themeCount} {themeCount === 1 ? 'Theme' : 'Themes'}</span>
              </span>
            )}
            {themeCount > 0 && noteCount > 0 && <span className="text-[#666666]">•</span>}
            {noteCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <FileText className="w-3 h-3 text-[#8E8E93]" />
                <span>{noteCount} {noteCount === 1 ? 'Note' : 'Notes'}</span>
              </span>
            )}
            {themeCount === 0 && noteCount === 0 && (
              <span className="text-[#A3A3A3]">{connection.sourceIds.length + connection.targetIds.length} Entitas</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
