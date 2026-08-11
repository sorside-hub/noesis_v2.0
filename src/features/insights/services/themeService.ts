import { Theme, ThemeCluster } from '../types/theme';
import { NoteItem } from '../../vault/pages/VaultPage';
import {
  getAllEmbeddings,
  getSavedThemesFromDb,
  saveThemesToDb,
  deleteThemeFromDb,
  clearThemesInDb,
} from '../../../core/database/indexedDb';
import { extractNoteVectorMap, clusterNotesByTopic } from '../utils/themeClustering';

export class ThemeService {
  /**
   * Retrieves saved themes from IndexedDB store "themes"
   */
  async getSavedThemes(): Promise<Theme[]> {
    return await getSavedThemesFromDb();
  }

  /**
   * Deletes a specific theme from IndexedDB
   */
  async deleteTheme(id: string): Promise<void> {
    await deleteThemeFromDb(id);
  }

  /**
   * Clears all saved themes in IndexedDB
   */
  async clearThemes(): Promise<void> {
    await clearThemesInDb();
  }

  /**
   * Generates Themes from user notes following the natural semantic clustering flow.
   *
   * Flow:
   * Notes (IndexedDB)
   * ↓
   * Ambil embedding yang sudah tersedia (tanpa generate ulang)
   * ↓
   * Analisis hubungan semantik antar note (cosine similarity)
   * ↓
   * Clustering berdasarkan kemiripan topik
   * ↓
   * AI (Gemini/Groq via /api/themes) memberi nama dan deskripsi tema berdasarkan cluster
   * ↓
   * Simpan hasil ke IndexedDB store "themes"
   */
  async generateThemes(notes: NoteItem[]): Promise<Theme[]> {
    if (!notes || notes.length < 2) {
      throw new Error('Diperlukan minimal 2 catatan di Vault untuk menganalisis dan menghasilkan Themes.');
    }

    // Step 1 & 2: Get pre-computed embeddings from IndexedDB (strictly reuse existing cache)
    const storedEmbeddings = await getAllEmbeddings().catch(() => []);
    const noteVectorMap = extractNoteVectorMap(notes, storedEmbeddings);

    // Step 3 & 4: Analyze semantic relations & cluster notes organically by topic
    const clusters: ThemeCluster[] = clusterNotesByTopic(notes, noteVectorMap);

    if (clusters.length === 0) {
      // If no multi-note cluster formed, clear themes and return empty
      await saveThemesToDb([]);
      return [];
    }

    // Step 5: Send clusters to AI (Gemini / Groq) for topic title & description synthesis
    const sanitizedNotesForAi = notes.map((n) => ({
      id: n.id,
      title: n.title || 'Catatan Tanpa Judul',
      category: n.category || 'Umum',
      tags: n.tags || [],
      content: n.content || '',
    }));

    let aiGeneratedThemes: any[] = [];

    try {
      const response = await fetch('/api/themes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clusters,
          notes: sanitizedNotesForAi,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.themes)) {
          aiGeneratedThemes = data.themes;
        }
      } else {
        console.warn('Backend /api/themes error, using organic fallback topic synthesis.');
      }
    } catch (err) {
      console.warn('Network error calling /api/themes:', err);
    }

    const now = Date.now();

    // Map AI response or fallback to required Theme output schema
    const finalThemes: Theme[] = clusters.map((cluster, idx) => {
      const matchedAi = aiGeneratedThemes.find((t) => {
        if (!t.relatedNoteIds || !Array.isArray(t.relatedNoteIds)) return false;
        // Check overlap
        const overlap = t.relatedNoteIds.some((id: string) => cluster.noteIds.includes(id));
        return overlap;
      }) || aiGeneratedThemes[idx];

      const relatedNoteIds = matchedAi?.relatedNoteIds && Array.isArray(matchedAi.relatedNoteIds) && matchedAi.relatedNoteIds.length > 0
        ? matchedAi.relatedNoteIds.filter((id: string) => cluster.noteIds.includes(id))
        : cluster.noteIds;

      const finalRelatedIds = relatedNoteIds.length > 0 ? relatedNoteIds : cluster.noteIds;

      const title = matchedAi?.title && typeof matchedAi.title === 'string' && matchedAi.title.trim().length > 0
        ? matchedAi.title.trim()
        : `Tema Topik #${idx + 1}`;

      const description = matchedAi?.description && typeof matchedAi.description === 'string' && matchedAi.description.trim().length > 0
        ? matchedAi.description.trim()
        : `Kelompok ${finalRelatedIds.length} catatan dengan pembahasan topik semantik yang saling berhubungan.`;

      const rawStrength = typeof matchedAi?.strength === 'number'
        ? matchedAi.strength
        : cluster.avgSimilarity;

      // Ensure strength is normalized between 0.0 and 1.0 (or rounded float)
      const strength = Math.min(1.0, Math.max(0.1, Math.round(rawStrength * 100) / 100));

      return {
        id: `theme_${now}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
        title,
        description,
        relatedNoteIds: finalRelatedIds,
        noteCount: finalRelatedIds.length,
        strength,
        createdAt: now,
      };
    });

    // Step 6: Save results to IndexedDB store "themes"
    await saveThemesToDb(finalThemes);

    return finalThemes;
  }
}

export const themeService = new ThemeService();
