import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { NavLocation, DrawerType, NavigationContextValue, HistoryStatePayload } from './types';

const INITIAL_LOCATION: NavLocation = { tab: 'chat' };

export function getParentLocation(location: NavLocation, currentStack?: NavLocation[]): NavLocation | null {
  if (currentStack && currentStack.length > 1) {
    const last = currentStack[currentStack.length - 1];
    const prev = currentStack[currentStack.length - 2];
    
    const isLastDetail = last.tab === 'vault' && last.vaultViewState === 'detail';
    const isLastThemeDetail = last.tab === 'insight' && last.insightViewState === 'themes' && !!last.themeId;
    const isLastPatternDetail = last.tab === 'insight' && last.insightViewState === 'patternDetail' && !!last.patternId;
    const isLastConnectionDetail = last.tab === 'insight' && last.insightViewState === 'connectionDetail' && !!last.connectionId;
    const isLastLeaf = isLastDetail || isLastThemeDetail || isLastPatternDetail || isLastConnectionDetail;

    const isPrevDetail = prev.tab === 'vault' && prev.vaultViewState === 'detail';
    const isPrevThemeDetail = prev.tab === 'insight' && prev.insightViewState === 'themes' && !!prev.themeId;
    const isPrevPatternDetail = prev.tab === 'insight' && prev.insightViewState === 'patternDetail' && !!prev.patternId;
    const isPrevConnectionDetail = prev.tab === 'insight' && prev.insightViewState === 'connectionDetail' && !!prev.connectionId;
    const isPrevLeaf = isPrevDetail || isPrevThemeDetail || isPrevPatternDetail || isPrevConnectionDetail;

    if (isLastLeaf && isPrevLeaf) {
      return prev;
    }
  }

  if (location.tab === 'chat') {
    return null;
  }
  if (location.tab === 'profile') {
    return { tab: 'chat' };
  }
  if (location.tab === 'insight') {
    const state = location.insightViewState || 'home';
    if (state === 'home') {
      return { tab: 'chat' };
    }
    if (state === 'patternDetail') {
      return { tab: 'insight', insightViewState: 'pattern' };
    }
    if (state === 'themes') {
      if (location.themeId) {
        if (currentStack && currentStack.length > 1) {
          const prev = currentStack[currentStack.length - 2];
          if (prev && prev.tab === 'insight') {
            return prev;
          }
        }
        return { tab: 'insight', insightViewState: 'themes', themeId: null };
      }
      return { tab: 'insight', insightViewState: 'home' };
    }
    if (state === 'connectionDetail') {
      if (currentStack && currentStack.length > 1) {
        const prev = currentStack[currentStack.length - 2];
        if (prev && prev.tab === 'insight') {
          return prev;
        }
      }
      return { tab: 'insight', insightViewState: 'connections' };
    }
    if (['pattern', 'connections', 'timeline', 'reflection'].includes(state)) {
      return { tab: 'insight', insightViewState: 'home' };
    }
    return { tab: 'chat' };
  }
  if (location.tab === 'vault') {
    const state = location.vaultViewState || 'list';
    if (state === 'list') {
      return { tab: 'chat' };
    }
    if (state === 'edit') {
      if (currentStack && currentStack.length > 1) {
        const prev = currentStack[currentStack.length - 2];
        if (prev && prev.tab === 'vault' && prev.vaultViewState === 'detail' && prev.noteId === location.noteId) {
          return prev;
        }
        if (prev && prev.tab === 'chat') {
          return prev;
        }
      }
      if (location.noteId) {
        return { tab: 'vault', vaultViewState: 'detail', noteId: location.noteId };
      }
      return { tab: 'vault', vaultViewState: 'list' };
    }
    if (state === 'detail') {
      if (currentStack && currentStack.length > 1) {
        const prev = currentStack[currentStack.length - 2];
        if (prev && (
          (prev.tab === 'vault' && (prev.vaultViewState === 'category' || prev.vaultViewState === 'tag' || prev.vaultViewState === 'trash' || prev.vaultViewState === 'list')) ||
          prev.tab === 'insight' ||
          prev.tab === 'chat'
        )) {
          return prev;
        }
      }
      return { tab: 'vault', vaultViewState: 'list' };
    }
    if (state === 'category') {
      if (currentStack && currentStack.length > 1) {
        const prev = currentStack[currentStack.length - 2];
        if (prev && (prev.tab === 'vault' || prev.tab === 'insight')) {
          return prev;
        }
      }
      return { tab: 'vault', vaultViewState: 'list' };
    }
    if (state === 'tag') {
      if (location.tagId) {
        if (currentStack && currentStack.length > 1) {
          const prev = currentStack[currentStack.length - 2];
          if (prev && (
            (prev.tab === 'vault' && (
              prev.vaultViewState === 'detail' ||
              prev.vaultViewState === 'list' ||
              prev.vaultViewState === 'category' ||
              prev.vaultViewState === 'trash' ||
              (prev.vaultViewState === 'tag' && !prev.tagId)
            )) ||
            prev.tab === 'insight'
          )) {
            return prev;
          }
        }
        return { tab: 'vault', vaultViewState: 'tag', tagId: null, categoryId: location.categoryId };
      }
      return { tab: 'vault', vaultViewState: 'list' };
    }
    if (state === 'trash') {
      if (currentStack && currentStack.length > 1) {
        const prev = currentStack[currentStack.length - 2];
        if (prev && (prev.tab === 'vault' || prev.tab === 'insight')) {
          return prev;
        }
      }
      return { tab: 'vault', vaultViewState: 'list' };
    }
    return { tab: 'chat' };
  }
  return { tab: 'chat' };
}

export function getHierarchyStack(location: NavLocation, currentStack: NavLocation[] = []): NavLocation[] {
  const currentLoc = currentStack[currentStack.length - 1];
  
  if (currentLoc) {
    const isCurrentDetail = currentLoc.tab === 'vault' && currentLoc.vaultViewState === 'detail';
    const isCurrentThemeDetail = currentLoc.tab === 'insight' && currentLoc.insightViewState === 'themes' && !!currentLoc.themeId;
    const isCurrentPatternDetail = currentLoc.tab === 'insight' && currentLoc.insightViewState === 'patternDetail' && !!currentLoc.patternId;
    const isCurrentConnectionDetail = currentLoc.tab === 'insight' && currentLoc.insightViewState === 'connectionDetail' && !!currentLoc.connectionId;
    const isCurrentLeaf = isCurrentDetail || isCurrentThemeDetail || isCurrentPatternDetail || isCurrentConnectionDetail;
    
    const isTargetDetail = location.tab === 'vault' && location.vaultViewState === 'detail';
    const isTargetThemeDetail = location.tab === 'insight' && location.insightViewState === 'themes' && !!location.themeId;
    const isTargetPatternDetail = location.tab === 'insight' && location.insightViewState === 'patternDetail' && !!location.patternId;
    const isTargetConnectionDetail = location.tab === 'insight' && location.insightViewState === 'connectionDetail' && !!location.connectionId;
    const isTargetLeaf = isTargetDetail || isTargetThemeDetail || isTargetPatternDetail || isTargetConnectionDetail;
    
    if (isCurrentLeaf && isTargetLeaf) {
      const isSame = currentLoc.tab === location.tab &&
        (isCurrentDetail && location.noteId === currentLoc.noteId ||
         isCurrentThemeDetail && location.themeId === currentLoc.themeId ||
         isCurrentPatternDetail && location.patternId === currentLoc.patternId ||
         isCurrentConnectionDetail && location.connectionId === currentLoc.connectionId);
         
      if (isSame) {
        return currentStack;
      } else {
        return [...currentStack, { ...location }];
      }
    }
  }

  if (location.tab === 'chat') {
    return [{ tab: 'chat' }];
  }
  if (location.tab === 'profile') {
    return [{ tab: 'chat' }, { tab: 'profile' }];
  }
  if (location.tab === 'insight') {
    const state = location.insightViewState || 'home';
    if (state === 'home') {
      return [{ tab: 'chat' }, { tab: 'insight', insightViewState: 'home' }];
    }
    if (state === 'pattern') {
      return [
        { tab: 'chat' },
        { tab: 'insight', insightViewState: 'home' },
        { tab: 'insight', insightViewState: 'pattern' }
      ];
    }
    if (state === 'patternDetail') {
      return [
        { tab: 'chat' },
        { tab: 'insight', insightViewState: 'home' },
        { tab: 'insight', insightViewState: 'pattern' },
        { tab: 'insight', insightViewState: 'patternDetail', patternId: location.patternId }
      ];
    }
    if (state === 'themes') {
      if (location.themeId) {
        let parentIndex = -1;
        for (let i = currentStack.length - 1; i >= 0; i--) {
          const item = currentStack[i];
          if (item && item.tab === 'insight' && (
            item.insightViewState === 'connectionDetail' ||
            item.insightViewState === 'connections' ||
            (item.insightViewState === 'themes' && !item.themeId) ||
            item.insightViewState === 'home'
          )) {
            parentIndex = i;
            break;
          }
        }
        if (parentIndex >= 0) {
          const baseStack = currentStack.slice(0, parentIndex + 1);
          return [...baseStack, { ...location, tab: 'insight' }];
        }
        return [
          { tab: 'chat' },
          { tab: 'insight', insightViewState: 'home' },
          { tab: 'insight', insightViewState: 'themes', themeId: null },
          { tab: 'insight', insightViewState: 'themes', themeId: location.themeId }
        ];
      }
      return [
        { tab: 'chat' },
        { tab: 'insight', insightViewState: 'home' },
        { tab: 'insight', insightViewState: 'themes', themeId: null }
      ];
    }
    if (state === 'connectionDetail') {
      let parentIndex = -1;
      for (let i = currentStack.length - 1; i >= 0; i--) {
        const item = currentStack[i];
        if (item && item.tab === 'insight' && (
          (item.insightViewState === 'themes' && item.themeId) ||
          item.insightViewState === 'themes' ||
          item.insightViewState === 'connections' ||
          item.insightViewState === 'home'
        )) {
          parentIndex = i;
          break;
        }
      }
      if (parentIndex >= 0) {
        const baseStack = currentStack.slice(0, parentIndex + 1);
        return [...baseStack, { ...location, tab: 'insight' }];
      }
      return [
        { tab: 'chat' },
        { tab: 'insight', insightViewState: 'home' },
        { tab: 'insight', insightViewState: 'connections' },
        { tab: 'insight', insightViewState: 'connectionDetail', connectionId: location.connectionId }
      ];
    }
    return [
      { tab: 'chat' },
      { tab: 'insight', insightViewState: 'home' },
      { ...location, tab: 'insight' }
    ];
  }
  if (location.tab === 'vault') {
    const state = location.vaultViewState || 'list';
    if (state === 'list') {
      return [{ tab: 'chat' }, { tab: 'vault', vaultViewState: 'list' }];
    }
    if (state === 'category') {
      let parentIndex = -1;
      for (let i = currentStack.length - 1; i >= 0; i--) {
        const item = currentStack[i];
        if (item && (
          (item.tab === 'vault' && item.vaultViewState === 'list') ||
          item.tab === 'insight'
        )) {
          parentIndex = i;
          break;
        }
      }
      if (parentIndex >= 0) {
        const baseStack = currentStack.slice(0, parentIndex + 1);
        return [...baseStack, { ...location, tab: 'vault' }];
      }
      return [
        { tab: 'chat' },
        { tab: 'vault', vaultViewState: 'list' },
        { tab: 'vault', vaultViewState: 'category', categoryId: location.categoryId }
      ];
    }
    if (state === 'tag') {
      if (location.tagId) {
        let parentIndex = -1;
        for (let i = currentStack.length - 1; i >= 0; i--) {
          const item = currentStack[i];
          if (item && (
            (item.tab === 'vault' && (
              item.vaultViewState === 'detail' ||
              item.vaultViewState === 'list' ||
              item.vaultViewState === 'category' ||
              (item.vaultViewState === 'tag' && !item.tagId)
            )) ||
            item.tab === 'insight'
          )) {
            parentIndex = i;
            break;
          }
        }
        if (parentIndex >= 0) {
          const baseStack = currentStack.slice(0, parentIndex + 1);
          return [...baseStack, { ...location, tab: 'vault' }];
        }
        return [
          { tab: 'chat' },
          { tab: 'vault', vaultViewState: 'list' },
          { tab: 'vault', vaultViewState: 'tag', tagId: null, categoryId: location.categoryId },
          { ...location, tab: 'vault' }
        ];
      }
      return [
        { tab: 'chat' },
        { tab: 'vault', vaultViewState: 'list' },
        { tab: 'vault', vaultViewState: 'tag', tagId: null, categoryId: location.categoryId }
      ];
    }
    if (state === 'trash') {
      let parentIndex = -1;
      for (let i = currentStack.length - 1; i >= 0; i--) {
        const item = currentStack[i];
        if (item && (
          (item.tab === 'vault' && item.vaultViewState === 'list') ||
          item.tab === 'insight'
        )) {
          parentIndex = i;
          break;
        }
      }
      if (parentIndex >= 0) {
        const baseStack = currentStack.slice(0, parentIndex + 1);
        return [...baseStack, { ...location, tab: 'vault' }];
      }
      return [
        { tab: 'chat' },
        { tab: 'vault', vaultViewState: 'list' },
        { tab: 'vault', vaultViewState: 'trash' }
      ];
    }
    if (state === 'detail') {
      let parentLoc: NavLocation | null = null;
      let parentIndex = -1;
      for (let i = currentStack.length - 1; i >= 0; i--) {
        const item = currentStack[i];
        if (item && (
          (item.tab === 'vault' && (item.vaultViewState === 'category' || item.vaultViewState === 'tag' || item.vaultViewState === 'trash' || item.vaultViewState === 'list')) ||
          item.tab === 'insight' ||
          item.tab === 'chat'
        )) {
          parentLoc = item;
          parentIndex = i;
          break;
        }
      }
      if (parentLoc && parentIndex >= 0) {
        const baseStack = currentStack.slice(0, parentIndex + 1);
        return [...baseStack, { ...location, tab: 'vault' }];
      }
      return [{ tab: 'chat' }, { tab: 'vault', vaultViewState: 'list' }, { ...location, tab: 'vault' }];
    }
    if (state === 'edit') {
      let detailIndex = -1;
      for (let i = currentStack.length - 1; i >= 0; i--) {
        const item = currentStack[i];
        if (item && item.tab === 'vault' && item.vaultViewState === 'detail' && item.noteId === location.noteId) {
          detailIndex = i;
          break;
        }
      }
      if (detailIndex >= 0) {
        const baseStack = currentStack.slice(0, detailIndex + 1);
        return [...baseStack, { ...location, tab: 'vault' }];
      }

      let parentLoc: NavLocation | null = null;
      let parentIndex = -1;
      for (let i = currentStack.length - 1; i >= 0; i--) {
        const item = currentStack[i];
        if (item && (
          (item.tab === 'vault' && (item.vaultViewState === 'category' || item.vaultViewState === 'tag' || item.vaultViewState === 'trash' || item.vaultViewState === 'list')) ||
          item.tab === 'insight' ||
          item.tab === 'chat'
        )) {
          parentLoc = item;
          parentIndex = i;
          break;
        }
      }
      if (parentLoc && parentIndex >= 0) {
        const baseStack = currentStack.slice(0, parentIndex + 1);
        return [...baseStack, { ...location, tab: 'vault' }];
      }

      return [{ tab: 'chat' }, { tab: 'vault', vaultViewState: 'list' }, { ...location, tab: 'vault' }];
    }
    return [{ tab: 'chat' }, { tab: 'vault', vaultViewState: 'list' }];
  }
  return [{ tab: 'chat' }];
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stack, setStack] = useState<NavLocation[]>([INITIAL_LOCATION]);
  const [activeOverlays, setActiveOverlays] = useState<DrawerType[]>([]);

  // Ref tracking current state for imperative access without closure staleness
  const stateRef = useRef<{ stack: NavLocation[]; overlays: DrawerType[] }>({
    stack: [INITIAL_LOCATION],
    overlays: [],
  });

  useEffect(() => {
    stateRef.current = { stack, overlays: activeOverlays };
  }, [stack, activeOverlays]);

  // Sync window.history - MUST be called directly from user actions, NOT inside setState updaters
  const syncHistoryState = useCallback(
    (newStack: NavLocation[], newOverlays: DrawerType[], action: 'push' | 'replace') => {
      const payload: HistoryStatePayload = { stack: newStack, overlays: newOverlays };
      if (action === 'push') {
        window.history.pushState(payload, '');
      } else {
        window.history.replaceState(payload, '');
      }
    },
    []
  );

  // Initialize history state on mount
  useEffect(() => {
    const currentState = window.history.state as HistoryStatePayload | null;
    if (currentState && Array.isArray(currentState.stack) && currentState.stack.length > 0) {
      setStack(currentState.stack);
      setActiveOverlays(currentState.overlays || []);
    } else {
      window.history.replaceState({ stack: [INITIAL_LOCATION], overlays: [] }, '');
    }
  }, []);

  // Centralized single popstate listener
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const { stack: currentStack, overlays: currentOverlays } = stateRef.current;
      const state = event.state as HistoryStatePayload | null;

      if (currentOverlays.length > 0) {
        const nextOverlays = currentOverlays.slice(0, -1);
        stateRef.current = { stack: currentStack, overlays: nextOverlays };
        setActiveOverlays(nextOverlays);
        window.history.replaceState({ stack: currentStack, overlays: nextOverlays }, '');
        return;
      }

      const prevLocation = currentStack[currentStack.length - 1];
      if (!prevLocation) return;

      const expectedParent = getParentLocation(prevLocation, currentStack);

      if (expectedParent) {
        const parentStack = getHierarchyStack(expectedParent, currentStack.slice(0, -1));
        stateRef.current = { stack: parentStack, overlays: [] };
        setStack(parentStack);
        setActiveOverlays([]);
        window.history.replaceState({ stack: parentStack, overlays: [] }, '');
      } else {
        if (state && Array.isArray(state.stack) && state.stack.length > 0) {
          stateRef.current = { stack: state.stack, overlays: state.overlays || [] };
          setStack(state.stack);
          setActiveOverlays(state.overlays || []);
        } else {
          stateRef.current = { stack: [INITIAL_LOCATION], overlays: [] };
          setStack([INITIAL_LOCATION]);
          setActiveOverlays([]);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const currentLocation = stack[stack.length - 1] || INITIAL_LOCATION;

  const navigate = useCallback(
    (location: NavLocation) => {
      const currentStack = stateRef.current.stack;
      const newStack = getHierarchyStack(location, currentStack);

      stateRef.current = { stack: newStack, overlays: [] };
      setStack(newStack);
      setActiveOverlays([]);
      syncHistoryState(newStack, [], 'push');
    },
    [syncHistoryState]
  );

  const replace = useCallback(
    (location: NavLocation) => {
      const currentStack = stateRef.current.stack;
      const newStack = getHierarchyStack(location, currentStack);

      stateRef.current = { stack: newStack, overlays: stateRef.current.overlays };
      setStack(newStack);
      syncHistoryState(newStack, stateRef.current.overlays, 'replace');
    },
    [syncHistoryState]
  );

  const goBack = useCallback(() => {
    const { stack: currentStack, overlays: currentOverlays } = stateRef.current;
    if (currentOverlays.length > 0) {
      window.history.back();
      return;
    }

    const currentLoc = currentStack[currentStack.length - 1];
    if (!currentLoc) return;

    const parent = getParentLocation(currentLoc, currentStack);
    if (parent) {
      window.history.back();
    }
  }, []);

  const openDrawer = useCallback(
    (drawer: DrawerType) => {
      const currentStack = stateRef.current.stack;
      const currentOverlays = stateRef.current.overlays;

      if (currentOverlays.includes(drawer)) return;

      const nextOverlays = [...currentOverlays, drawer];
      stateRef.current = { stack: currentStack, overlays: nextOverlays };
      setActiveOverlays(nextOverlays);
      syncHistoryState(currentStack, nextOverlays, 'push');
    },
    [syncHistoryState]
  );

  const closeDrawer = useCallback(
    (drawer?: DrawerType) => {
      const { overlays: currentOverlays } = stateRef.current;
      if (currentOverlays.length === 0) return;

      if (!drawer || currentOverlays[currentOverlays.length - 1] === drawer) {
        window.history.back();
      } else {
        // Closed out of order
        const nextOverlays = currentOverlays.filter((d) => d !== drawer);
        stateRef.current = { stack: stateRef.current.stack, overlays: nextOverlays };
        setActiveOverlays(nextOverlays);
        syncHistoryState(stateRef.current.stack, nextOverlays, 'replace');
      }
    },
    [syncHistoryState]
  );

  const resetTo = useCallback(
    (location: NavLocation) => {
      const currentStack = stateRef.current.stack;
      const newStack = getHierarchyStack(location, currentStack);

      setStack(newStack);
      setActiveOverlays([]);

      if (location.tab === 'chat') {
        syncHistoryState(newStack, [], 'replace');
      } else {
        const action = (currentStack.length === 1 && newStack.length > 1) ? 'push' : 'replace';
        syncHistoryState(newStack, [], action);
      }
    },
    [syncHistoryState]
  );

  const canGoBack = useCallback(() => {
    const { stack: currentStack, overlays: currentOverlays } = stateRef.current;
    if (currentOverlays.length > 0) return true;
    const currentLoc = currentStack[currentStack.length - 1];
    return !!(currentLoc && getParentLocation(currentLoc, currentStack));
  }, []);

  const isDrawerOpen = useCallback(
    (drawer: DrawerType) => {
      return activeOverlays.includes(drawer);
    },
    [activeOverlays]
  );

  const value: NavigationContextValue = {
    currentLocation,
    activeOverlays,
    stack,
    navigate,
    replace,
    goBack,
    openDrawer,
    closeDrawer,
    resetTo,
    canGoBack,
    isDrawerOpen,
  };

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};

export const useNavigationContext = (): NavigationContextValue => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigationContext must be used within a NavigationProvider');
  }
  return context;
};
