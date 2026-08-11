import React, { useState, useRef, useEffect } from 'react';
import { NavTab } from '../types';
import {
  MessageSquare,
  Archive,
  BarChart2,
  User,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'vault', label: 'Vault', icon: Archive },
  { id: 'insight', label: 'Insight', icon: BarChart2 },
  { id: 'profile', label: 'Profile', icon: User },
];

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectTab = (tabId: NavTab) => {
    onTabChange(tabId);
    setIsOpen(false);
  };

  return (
    <div
      ref={navRef}
      className={`fixed right-0 top-1/2 -translate-y-1/2 z-50 select-none flex items-center transition-transform duration-300 ease-out ${
        isOpen ? 'translate-x-0' : 'translate-x-[44px]'
      }`}
    >
      {/* Trigger Button - Standalone shape so it looks like a distinct button when folded */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? 'Tutup Navigasi' : 'Buka Navigasi'}
        className="flex items-center justify-center w-8 py-6 mr-[-1px] z-10 bg-white/5 backdrop-blur-2xl border-l border-y border-white/10 rounded-l-2xl shadow-lg text-white/60 hover:text-white cursor-pointer transition-colors duration-150 shrink-0 active:scale-95 hover:bg-white/10 touch-manipulation"
      >
        {isOpen ? (
          <ChevronRight className="w-5 h-5 text-white/90" />
        ) : (
          <ChevronLeft className="w-5 h-5 text-white/70" />
        )}
      </button>

      {/* Vertical Dock Container - Separate shape from trigger button */}
      <div className="flex flex-col items-center gap-1.5 w-[44px] shrink-0 bg-white/5 backdrop-blur-2xl border-l border-y border-white/10 rounded-l-2xl shadow-lg py-2 px-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleSelectTab(item.id)}
              title={item.label}
              className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-150 cursor-pointer active:scale-90 ${
                isActive
                  ? 'bg-white/10 text-white border border-white/20 shadow-sm backdrop-blur-md'
                  : 'text-white/50 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon
                className={`w-4 h-4 transition-transform duration-150 ${
                  isActive ? 'scale-105 text-white' : 'text-[#8E8E93]'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};


