export interface Connection {
  id: string;
  title: string;
  description: string;
  sourceType: 'note' | 'theme';
  targetType: 'note' | 'theme';
  connectionType: 'theme_bridge' | 'theme_evidence';
  sourceIds: string[];
  targetIds: string[];
  strength: number; // Decimal 0.0 - 1.0 (cosine similarity or semantic strength score)
  reasoning: string; // Evidence/proof from notes/themes data
  createdAt: number;
}

export interface ConnectionCandidate {
  candidateId: string;
  sourceIds: string[];
  targetIds: string[];
  sourceTitles: string[];
  targetTitles: string[];
  sourceType: 'note' | 'theme';
  targetType: 'note' | 'theme';
  connectionType: 'theme_bridge' | 'theme_evidence';
  similarity: number;
  sourceContentSnippet: string;
  targetContentSnippet: string;
}
