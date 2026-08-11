export interface Theme {
  id: string;
  title: string;
  description: string;
  relatedNoteIds: string[];
  noteCount: number;
  strength: number; // Score indicating topic cluster coherence (0.0 - 1.0 or 0 - 100)
  createdAt: number;
}

export interface ThemeCluster {
  clusterId: string;
  noteIds: string[];
  noteTitles?: string[];
  avgSimilarity: number;
}

export interface ThemeMetaRecord {
  id: 'theme_meta';
  analyzedNoteCount: number;
  analyzedNoteIds: string[];
  lastAnalyzedAt: number;
}
