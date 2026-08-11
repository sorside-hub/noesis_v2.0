import React from 'react';

interface MobileShellProps {
  children: React.ReactNode;
}

export const MobileShell: React.FC<MobileShellProps> = ({ children }) => {
  return (
    <div className="w-full h-screen bg-[#0A0A0A] flex items-center justify-center sm:py-4">
      <div className="w-full h-full max-w-md bg-[#131313] sm:rounded-3xl sm:border sm:border-[#303030] shadow-2xl overflow-hidden flex flex-col relative">
        {children}
      </div>
    </div>
  );
};
