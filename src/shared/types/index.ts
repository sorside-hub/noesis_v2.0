import { CategoryId, NoteItem } from '../../features/vault/pages/VaultPage';

export type NavTab = 'chat' | 'vault' | 'insight' | 'profile';

export type SyncStatus = 'synced' | 'pending' | 'error';
export type SyncAction = 'upsert' | 'delete';
export type SyncEntityType = 'note' | 'embedding';

export interface SyncQueueItem {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  action: SyncAction;
  payload?: any;
  status: 'pending' | 'processing' | 'error' | 'synced';
  retryCount: number;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export type Note = NoteItem;

export interface NoteChunk {
  noteId: string;
  title: string;
  category: CategoryId | string;
  type: string;
  tags: string[];
  chunkIndex: number;
  content: string;
  createdAt?: string | number;
  updatedAt?: string | number;
}

export interface NoteChunkEmbedding {
  id: string;
  noteId: string;
  title: string;
  category: CategoryId | string;
  type: string;
  tags: string[];
  chunkIndex: number;
  content: string;
  embedding: number[];
  createdAt: string | number;
  updatedAt: string | number;
}

export interface RetrievalResult {
  chunk: NoteChunkEmbedding;
  score: number;
}

export interface RAGStatusMetadata {
  mode: 'smart' | 'on' | 'off';
  usedVault: boolean;
  intent?: string;
  reasoningStyle?: string;
  memoryDepth?: string;
  confidenceLevel?: 'high' | 'medium' | 'low';
  compositeScore?: number;
  searchMethod?: string;
  category?: string | string[];
  typeFilter?: string | string[];
  tags?: string | string[];
  topK?: number;
  sourcesCount?: number;
  chunksRetrieved?: number;
  chunksUsed?: number;
  highestScore?: number;
  processingTime?: number;
}

export interface MessageModelMeta {
  model: string;
  isFallback: boolean;
  primaryModel?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'assistant';
  content: string;
  timestamp: any;
  status?: string;
  modelMeta?: MessageModelMeta;
  retrievedContexts?: {
    chunkId: string;
    noteId: string;
    title?: string;
    noteTitle?: string;
    category?: string;
    type?: string;
    tags?: string[];
    score: number;
    snippet: string;
  }[];
  ragStatus?: RAGStatusMetadata;
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt?: any;
  updatedAt?: any;
  lastUpdated?: any;
  isPinned?: boolean;
  pinned?: boolean;
  messages: Message[];
}

export type ContextSource = 'vault' | 'workspace' | 'distillations' | string;

export type RAGMode = 'smart' | 'on' | 'off';

export type RetrievalMethod = 'vector' | 'bm25' | 'hybrid';

export interface AISettings {
  model: string;
  memoryEnabled: boolean;
  ragEnabled: boolean;
  ragMode: RAGMode;
  searchMethod?: RetrievalMethod;
  topKChunks: number;
  similarityThreshold?: number;
  categoryFilter?: string | string[];
  typeFilter?: string | string[];
  tagFilter?: string | string[];
  contextSources: ContextSource[];
  customInstructions: string;
}
