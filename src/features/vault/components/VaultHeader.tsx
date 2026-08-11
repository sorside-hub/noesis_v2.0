import React from 'react';
import { ArrowLeft, Settings, SlidersHorizontal } from 'lucide-react';

interface VaultHeaderProps {
  onBack?: () => void;
  onOpenSettings?: () => void;
  onOpenProperties?: () => void;
}

export const VaultHeader: React.FC<VaultHeaderProps> = ({
  onBack,
  onOpenSettings,
  onOpenProperties,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-3 bg-[#131313]/90 backdrop-blur-md border-b border-[#303030] select-none shrink-0">
      {/* Sisi Kiri: Tombol Kembali jika ada */}
      <div className="flex items-center justify-start shrink-0 min-w-9">
        {onBack ? (
          <button
            onClick={onBack}
            title="Kembali"
            aria-label="Kembali"
            className="p-2 rounded-xl text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#1C1C1C] transition-colors active:scale-95 cursor-pointer flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-[#E5E5E5]" />
          </button>
        ) : (
          <div className="w-9 h-9 shrink-0" />
        )}
      </div>

      {/* Tengah: Logo Typography NOESIS */}
      <div className="flex items-center justify-center pointer-events-none">
        <img
          src="/logo-dark-panjang.webp"
          alt="Logo Noesis"
          className="h-7 w-auto object-contain"
        />
      </div>

      {/* Sisi Kanan: Icon Settings atau Properties */}
      <div className="flex items-center justify-end shrink-0 min-w-9">
        {onOpenProperties ? (
          <button
            onClick={onOpenProperties}
            title="Properti Catatan"
            aria-label="Properti Catatan"
            className="p-2 rounded-xl text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#1C1C1C] transition-colors active:scale-95 cursor-pointer flex items-center justify-center"
          >
            <SlidersHorizontal className="w-5 h-5 text-[#E5E5E5]" />
          </button>
        ) : onOpenSettings ? (
          <button
            onClick={onOpenSettings}
            title="Pengaturan Vault"
            aria-label="Pengaturan Vault"
            className="p-2 rounded-xl text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#1C1C1C] transition-colors active:scale-95 cursor-pointer flex items-center justify-center"
          >
            <Settings className="w-5 h-5 text-[#E5E5E5]" />
          </button>
        ) : (
          <div className="w-9 h-9 shrink-0" />
        )}
      </div>
    </header>
  );
};

