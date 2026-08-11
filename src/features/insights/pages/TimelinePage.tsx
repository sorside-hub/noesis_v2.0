import React from 'react';
import { Clock } from 'lucide-react';
import { VaultHeader } from '../../vault/components/VaultHeader';

interface TimelinePageProps {
  onBack?: () => void;
}

export const TimelinePage: React.FC<TimelinePageProps> = ({ onBack }) => {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none animate-fadeIn">
      {/* Self-contained Header */}
      <VaultHeader onBack={onBack} />

      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col max-w-lg mx-auto w-full pb-20">
        {/* Header: Icon + Title + Line */}
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#2A2A2A]">
          <Clock className="w-5 h-5 text-neutral-300" />
          <h1 className="text-xl font-bold text-neutral-300 tracking-tight">
            Timeline
          </h1>
        </div>
      </div>
    </div>
  );
};
