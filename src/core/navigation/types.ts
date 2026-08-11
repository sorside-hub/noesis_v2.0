export type TabType = 'chat' | 'vault' | 'insight' | 'profile';

export type VaultViewState = 'list' | 'category' | 'tag' | 'trash' | 'detail' | 'edit';

export type InsightViewState = 'home' | 'pattern' | 'patternDetail' | 'themes' | 'connections' | 'connectionDetail' | 'timeline' | 'reflection';

export type DrawerType = 'chatHistory' | 'chatSettings' | 'vaultSettings' | 'noteProperty' | 'distilModal';

export interface NavLocation {
  tab: TabType;
  vaultViewState?: VaultViewState;
  insightViewState?: InsightViewState;
  categoryId?: string | null;
  tagId?: string | null;
  noteId?: string | null;
  patternId?: string | null;
  themeId?: string | null;
  connectionId?: string | null;
  isEditing?: boolean;
}

export interface HistoryStatePayload {
  stack: NavLocation[];
  overlays: DrawerType[];
}

export interface NavigationContextValue {
  currentLocation: NavLocation;
  activeOverlays: DrawerType[];
  stack: NavLocation[];
  navigate: (location: NavLocation) => void;
  replace: (location: NavLocation) => void;
  goBack: () => void;
  openDrawer: (drawer: DrawerType) => void;
  closeDrawer: (drawer?: DrawerType) => void;
  resetTo: (location: NavLocation) => void;
  canGoBack: () => boolean;
  isDrawerOpen: (drawer: DrawerType) => boolean;
}
