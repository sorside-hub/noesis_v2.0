import React from 'react';

interface EmptyStateProps {
  onSelectPrompt?: (promptText: string) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = () => {
  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-[60vh] px-4 py-8 text-center select-none">
      {/* Logo Dark Kotak */}
      <div className="flex flex-col items-center justify-center">
        <img
          src="/logo-dark-kotak.webp"
          alt="Logo"
          className="w-20 h-20 object-contain mb-3"
        />
        <p className="text-xs text-[#A3A3A3] max-w-xs">
          Thinking with Vault
        </p>
      </div>
    </div>
  );
};

