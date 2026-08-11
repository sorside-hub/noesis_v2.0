import React from 'react';
import { Menu, SlidersHorizontal } from 'lucide-react';

interface HeaderProps {
  activeThreadTitle?: string;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onNewChat?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenHistory,
  onOpenSettings,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-3 bg-[#131313]/90 backdrop-blur-md border-b border-[#303030] select-none shrink-0">
      {/* Kiri: Icon Menu untuk Chat History Drawer */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onOpenHistory}
          title="Riwayat Chat"
          className="p-2 rounded-xl text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#1C1C1C] transition-colors active:scale-95 flex items-center gap-1.5"
        >
          <Menu className="w-5 h-5 text-[#E5E5E5]" />
        </button>
      </div>

      {/* Tengah: Logo Dark Panjang */}
      <div className="flex items-center justify-center pointer-events-none">
        <img
          src="/logo-dark-panjang.webp"
          alt="Logo"
          className="h-7 w-auto object-contain"
        />
      </div>

      {/* Kanan: Icon Settings untuk Chat Settings Drawer */}
      <div className="flex items-center gap-1">
        <button
          onClick={onOpenSettings}
          title="Chat Settings"
          className="p-2 rounded-xl text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#1C1C1C] transition-colors active:scale-95"
        >
          <SlidersHorizontal className="w-5 h-5 text-[#E5E5E5]" />
        </button>
      </div>
    </header>
  );
};
