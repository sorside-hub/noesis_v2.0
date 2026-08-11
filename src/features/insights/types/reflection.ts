export interface Reflection {
  id: string;
  title: string;
  observation: string;
  question: string;
  relatedNoteIds: string[];
  relatedThemeIds: string[];
  relatedConnectionIds: string[];
  createdAt: number;
  type?: 'creative_reflection' | 'pattern_reflection' | 'growth_reflection' | 'tension_reflection';
  formationBasis?: string;
}
