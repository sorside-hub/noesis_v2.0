export interface ThinkingPattern {
  id: string;
  title: string;
  description: string;
  reasoning: string;
  relatedNoteIds: string[];
  confidence?: number;
  evidenceCount: number;
  relatedTopicCount: number;
  evidenceStrength: 'Strong' | 'Moderate' | 'Weak';
  firstDetectedAt: number;
  lastDetectedAt: number;
  occurrenceCount: number;
  previousPatternId?: string;
  createdAt: number;
}

export interface ThinkingPatternHistoryRecord {
  id: string;
  patternId: string;
  title: string;
  description: string;
  reasoning: string;
  relatedNoteIds: string[];
  evidenceCount: number;
  createdAt: number;
  archivedAt: number;
  analysisVersion?: number;
  changeType?: 'NEW_PATTERN' | 'UPDATED_PATTERN' | 'MERGED_PATTERN';
  previousPatternId?: string;
  changeSummary?: string;
}

export interface ThinkingPatternMetaRecord {
  id: 'thinking_pattern_meta';
  analyzedNoteCount: number;
  analyzedNoteIds: string[];
  lastAnalyzedAt: number;
  latestNoteUpdatedAt: number;
  analysisVersion?: number;
  analysisMode?: 'full' | 'incremental';
}
