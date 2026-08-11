import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NavTab } from './shared/types';
import { useChat } from './features/chat/hooks/useChat';
import { MobileShell } from './shared/components/MobileShell';
import { BottomNav } from './shared/components/BottomNav';
import { ChatHistoryDrawer } from './features/chat/components/ChatHistoryDrawer';
import { ChatSettingsDrawer } from './features/chat/components/ChatSettingsDrawer';
import { VaultSettingsDrawer } from './features/vault/components/VaultSettingsDrawer';
import { ChatPage } from './features/chat/pages/ChatPage';
import { VaultPage } from './features/vault/pages/VaultPage';
import { InsightPage } from './features/insights/pages/InsightPage';
import { ProfilePage } from './features/profile/pages/ProfilePage';
import { NavigationProvider, useNavigation } from './core/navigation';

function AppContent() {
  const {
    currentLocation,
    navigate,
    resetTo,
    goBack,
    openDrawer,
    closeDrawer,
    isDrawerOpen,
  } = useNavigation();

  const activeTab: NavTab = currentLocation.tab;
  const isVaultEditing =
    activeTab === 'vault' &&
    (currentLocation.vaultViewState === 'detail' ||
      currentLocation.vaultViewState === 'edit');

  const isHistoryOpen = isDrawerOpen('chatHistory');
  const isSettingsOpen = isDrawerOpen('chatSettings');
  const isVaultSettingsOpen = isDrawerOpen('vaultSettings');
  const isNotePropertyOpen = isDrawerOpen('noteProperty');

  const [pendingNoteFromAI, setPendingNoteFromAI] = useState<{ title: string; content: string } | null>(null);

  const {
    threads,
    activeThreadId,
    activeThreadTitle,
    messages,
    isLoading,
    loadingStatus,
    aiSettings,
    setAiSettings,
    createNewThread,
    selectThread,
    deleteThread,
    renameThread,
    togglePinThread,
    sendMessage,
    editAndResendMessage,
  } = useChat();

  const handleTabChange = useCallback(
    (newTab: NavTab) => {
      resetTo({ tab: newTab });
    },
    [resetTo]
  );

  // Drawer Handlers
  const handleOpenHistory = useCallback(() => {
    openDrawer('chatHistory');
  }, [openDrawer]);

  const handleCloseHistory = useCallback(() => {
    closeDrawer('chatHistory');
  }, [closeDrawer]);

  const handleOpenSettings = useCallback(() => {
    openDrawer('chatSettings');
  }, [openDrawer]);

  const handleCloseSettings = useCallback(() => {
    closeDrawer('chatSettings');
  }, [closeDrawer]);

  const handleOpenVaultSettings = useCallback(() => {
    openDrawer('vaultSettings');
  }, [openDrawer]);

  const handleCloseVaultSettings = useCallback(() => {
    closeDrawer('vaultSettings');
  }, [closeDrawer]);

  const handleOpenNoteProperty = useCallback(() => {
    openDrawer('noteProperty');
  }, [openDrawer]);

  const handleCloseNoteProperty = useCallback(() => {
    closeDrawer('noteProperty');
  }, [closeDrawer]);

  // Mobile Touch Swipe Gesture Listener to open/close sidebars
  const touchRef = useRef<{ startX: number; startY: number; ignore: boolean } | null>(null);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const target = e.target;

      const shouldIgnore = (t: EventTarget | null) => {
        if (!(t instanceof HTMLElement)) return false;
        const tagName = t.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
          return true;
        }
        let el: HTMLElement | null = t;
        while (el && el !== document.body) {
          if (el.getAttribute('role') === 'slider' || el.classList.contains('no-swipe')) {
            return true;
          }
          const overflowX = window.getComputedStyle(el).overflowX;
          if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth) {
            return true;
          }
          el = el.parentElement;
        }
        return false;
      };

      touchRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        ignore: shouldIgnore(target),
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchRef.current || touchRef.current.ignore) {
        touchRef.current = null;
        return;
      }
      if (e.changedTouches.length === 0) {
        touchRef.current = null;
        return;
      }

      const { startX, startY } = touchRef.current;
      touchRef.current = null;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      // Swipe must be horizontal (> 50px) and dominant over vertical movement
      if (Math.abs(deltaX) < 50 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.5) {
        return;
      }

      // 1. If left drawer (Chat History) is open
      if (isHistoryOpen) {
        if (deltaX < -50) {
          closeDrawer('chatHistory');
        }
        return;
      }

      // 2. If right drawer (Chat Settings / Vault Settings / Note Property) is open
      if (isSettingsOpen || isVaultSettingsOpen || isNotePropertyOpen) {
        if (deltaX > 50) {
          if (isSettingsOpen) closeDrawer('chatSettings');
          if (isVaultSettingsOpen) closeDrawer('vaultSettings');
          if (isNotePropertyOpen) closeDrawer('noteProperty');
        }
        return;
      }

      // Ignore swipes that start at extreme screen edges (< 20px or > innerWidth - 20px)
      // to avoid conflicting with system/browser back/forward gestures
      const isExtremeEdge = startX < 20 || startX > window.innerWidth - 20;

      // 3. No drawers open -> Open drawer based on swipe direction and current page
      if (!isExtremeEdge) {
        if (deltaX > 50) {
          // Swipe Right -> Open left sidebar (Chat History on chat tab)
          if (activeTab === 'chat') {
            openDrawer('chatHistory');
          }
        } else if (deltaX < -50) {
          // Swipe Left -> Open right sidebar
          if (activeTab === 'chat') {
            openDrawer('chatSettings');
          } else if (activeTab === 'vault') {
            if (isVaultEditing) {
              openDrawer('noteProperty');
            } else if (currentLocation.vaultViewState === 'list' || !currentLocation.vaultViewState) {
              openDrawer('vaultSettings');
            }
          }
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [
    activeTab,
    isVaultEditing,
    isHistoryOpen,
    isSettingsOpen,
    isVaultSettingsOpen,
    isNotePropertyOpen,
    openDrawer,
    closeDrawer,
    currentLocation.vaultViewState,
  ]);

  const handleCreateNoteFromAI = useCallback(
    (content: string) => {
      const clean = content.replace(/^[#*\s-]+/, '').trim();
      const firstLine = clean.split('\n')[0].trim();
      const title = firstLine
        ? firstLine.length > 40
          ? firstLine.substring(0, 40) + '...'
          : firstLine
        : 'Catatan dari Chat AI';

      setPendingNoteFromAI({ title, content });
      navigate({ tab: 'vault', vaultViewState: 'edit', isEditing: true });
    },
    [navigate]
  );

  const handleOpenNoteById = useCallback(
    (noteId: string) => {
      navigate({ tab: 'vault', vaultViewState: 'detail', noteId, isEditing: true });
    },
    [navigate]
  );

  const lastAiMsg = [...messages].reverse().find(
    (m) => (m.role === 'model' || m.role === 'assistant') && m.content
  );
  const activeModel = lastAiMsg?.modelMeta?.model || aiSettings.model || 'gemini-3.6-flash';
  const isFallback = Boolean(lastAiMsg?.modelMeta?.isFallback);
  const primaryModel = lastAiMsg?.modelMeta?.primaryModel || 'gemini-3.6-flash';

  return (
    <MobileShell>
      {/* Main View Area (Each page now manages and renders its own self-contained header) */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-[#131313]">
        {activeTab === 'chat' && (
          <ChatPage
            messages={messages}
            isLoading={isLoading}
            loadingStatus={loadingStatus}
            onSendMessage={sendMessage}
            onEditAndResendMessage={editAndResendMessage}
            onCreateNoteFromAI={handleCreateNoteFromAI}
            onOpenNoteById={handleOpenNoteById}
            activeThreadId={activeThreadId}
            activeModel={activeModel}
            isFallback={isFallback}
            primaryModel={primaryModel}
            ragMode={aiSettings.ragMode}
            onOpenSettings={handleOpenSettings}
            activeThreadTitle={activeThreadTitle}
            onOpenHistory={handleOpenHistory}
            onNewChat={createNewThread}
          />
        )}
        {activeTab === 'vault' && (
          <VaultPage
            isPropertyDrawerOpen={isNotePropertyOpen}
            onClosePropertyDrawer={handleCloseNoteProperty}
            onOpenPropertyDrawer={handleOpenNoteProperty}
            pendingNoteFromAI={pendingNoteFromAI}
            onClearPendingNoteFromAI={() => setPendingNoteFromAI(null)}
            onOpenSettings={handleOpenVaultSettings}
          />
        )}
        {activeTab === 'insight' && <InsightPage />}
        {activeTab === 'profile' && <ProfilePage />}
      </main>

      {/* Fixed Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Chat History Drawer (Left Slide-in) */}
      <ChatHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={handleCloseHistory}
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={selectThread}
        onNewChat={createNewThread}
        onDeleteThread={deleteThread}
        onRenameThread={renameThread}
        onTogglePinThread={togglePinThread}
      />

      {/* Chat Settings Drawer (Right Slide-in) */}
      <ChatSettingsDrawer
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        settings={aiSettings}
        onSaveSettings={setAiSettings}
      />

      {/* Vault Settings Drawer (Right Slide-in) */}
      <VaultSettingsDrawer
        isOpen={isVaultSettingsOpen}
        onClose={handleCloseVaultSettings}
      />
    </MobileShell>
  );
}

export default function App() {
  return (
    <NavigationProvider>
      <AppContent />
    </NavigationProvider>
  );
}

