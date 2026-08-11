import { Reflection } from '../types/reflection';
import { NoteItem } from '../../vault/pages/VaultPage';
import { Theme } from '../types/theme';
import { Connection } from '../types/connection';
import { ThinkingPattern } from '../types/thinkingPattern';
import {
  getSavedReflectionsFromDb,
  saveReflectionsToDb,
  deleteReflectionFromDb,
  getSavedThemesFromDb,
  getSavedConnectionsFromDb,
} from '../../../core/database/indexedDb';
import { getSavedThinkingPatterns } from './thinkingPatternService';

export class ReflectionService {
  /**
   * Retrieves saved reflections from IndexedDB
   */
  async getSavedReflections(): Promise<Reflection[]> {
    return await getSavedReflectionsFromDb();
  }

  /**
   * Deletes a specific reflection from IndexedDB
   */
  async deleteReflection(id: string): Promise<void> {
    await deleteReflectionFromDb(id);
  }

  /**
   * Generates Reflections based on existing knowledge structures (Themes, Patterns, Connections, Notes)
   * This calls the backend /api/reflections endpoint for synthesis and falls back to a smart heuristic engine if offline/error.
   */
  async generateReflections(notes: NoteItem[]): Promise<Reflection[]> {
    const themes: Theme[] = await getSavedThemesFromDb().catch(() => []);
    const connections: Connection[] = await getSavedConnectionsFromDb().catch(() => []);
    const patterns: ThinkingPattern[] = await getSavedThinkingPatterns().catch(() => []);

    let reflections: Reflection[] = [];
    const now = Date.now();

    try {
      const response = await fetch('/api/reflections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          themes,
          thinkingPatterns: patterns,
          connections,
          notes,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data?.reflections) && data.reflections.length > 0) {
          reflections = data.reflections;
        }
      } else {
        const errText = await response.text();
        console.warn('[ReflectionService] Backend API returned error, falling back to heuristics:', errText);
      }
    } catch (err) {
      console.warn('[ReflectionService] Failed to fetch /api/reflections, falling back to heuristics:', err);
    }

    // Heuristics Fallback Strategy if API did not return reflections
    if (reflections.length === 0) {
      // Strategy 1: Generate from Connections (bridges and evidences)
      if (connections.length > 0) {
        connections.slice(0, 3).forEach((conn, index) => {
          const relatedNotes = notes.filter(n => 
            (conn.sourceIds && conn.sourceIds.includes(n.id)) || 
            (conn.targetIds && conn.targetIds.includes(n.id))
          ).map(n => n.id);

          const relatedThemes = themes.filter(t => 
            (conn.sourceIds && conn.sourceIds.includes(t.id)) || 
            (conn.targetIds && conn.targetIds.includes(t.id))
          ).map(t => t.id);

          reflections.push({
            id: `reflection_${now}_conn_${index}_${Math.random().toString(36).substring(2, 6)}`,
            type: 'creative_reflection',
            title: `Sintesis Hubungan: ${conn.title}`,
            observation: `Anda telah menghubungkan beberapa pemikiran melalui hubungan "${conn.title}". Koneksi ini memiliki kekuatan hubungan sebesar ${(conn.strength * 100).toFixed(0)}%.`,
            formationBasis: `Refleksi ini terbentuk dari jalinan hubungan "${conn.title}" antara beberapa catatan Anda. Hubungan ini memperlihatkan sinergi pemikiran yang menyatukan sudut pandang dari berbagai kategori catatan.`,
            question: `Apakah cara kamu menghubungkan ide "${conn.title}" ini mencerminkan struktur pemikiran utama kamu dalam memecahkan masalah baru?`,
            relatedNoteIds: relatedNotes,
            relatedThemeIds: relatedThemes,
            relatedConnectionIds: [conn.id],
            createdAt: now + index,
          });
        });
      }

      // Strategy 2: Generate from Themes (Topic Clusters)
      if (themes.length > 0) {
        themes.slice(0, 3).forEach((theme, index) => {
          const relatedNotes = theme.relatedNoteIds || [];
          
          reflections.push({
            id: `reflection_${now}_theme_${index}_${Math.random().toString(36).substring(2, 6)}`,
            type: 'pattern_reflection',
            title: `Eksplorasi Tema: ${theme.title}`,
            observation: `Tema "${theme.title}" terbentuk secara organik dari ${theme.noteCount} catatan di Vault Anda. Ini menunjukkan adanya ketertarikan yang mendalam terhadap topik ini akhir-akhir ini.`,
            formationBasis: `Refleksi ini terbentuk karena adanya klaster tema "${theme.title}" yang secara organik menghubungkan ${theme.noteCount} catatan di Vault Anda. Klaster ini memperlihatkan fokus eksplorasi kognitif yang kuat.`,
            question: `Mengapa topik "${theme.title}" ini begitu dominan dalam catatan kamu akhir-akhir ini? Sudut pandang unik apa yang sebenarnya ingin kamu temukan dari tema ini?`,
            relatedNoteIds: relatedNotes,
            relatedThemeIds: [theme.id],
            relatedConnectionIds: [],
            createdAt: now + 10 + index,
          });
        });
      }

      // Strategy 3: Generate from Thinking Patterns
      if (patterns.length > 0) {
        patterns.slice(0, 2).forEach((pattern, index) => {
          const relatedNotes = pattern.relatedNoteIds || [];
          
          reflections.push({
            id: `reflection_${now}_pattern_${index}_${Math.random().toString(36).substring(2, 6)}`,
            type: 'growth_reflection',
            title: `Meta-Kognisi: Pola Pikir ${pattern.title}`,
            observation: `Kami mendeteksi kecenderungan pola "${pattern.title}" dalam cara Anda mendokumentasikan ide. Pola ini terlihat dari ${pattern.evidenceCount} bukti catatan di Vault Anda.`,
            formationBasis: `Refleksi ini terbentuk karena terdeteksinya pola berpikir "${pattern.title}" yang melandasi cara kamu mendokumentasikan gagasan serta menyatukan bukti-bukti tertulis di Vault.`,
            question: `Apakah pola pikir "${pattern.title}" ini mempermudah kamu menyederhanakan masalah kompleks, atau justru membatasi sudut pandang alternatif yang bisa kamu ambil?`,
            relatedNoteIds: relatedNotes,
            relatedThemeIds: [],
            relatedConnectionIds: [],
            createdAt: now + 20 + index,
          });
        });
      }

      // Strategy 4: Fallback or complementary from individual Notes if everything else is dry
      if (reflections.length < 3 && notes.length > 0) {
        notes.slice(0, 3).forEach((note, index) => {
          // Prevent duplicate reflections if note already covered
          const alreadyCovered = reflections.some(r => r.relatedNoteIds.includes(note.id));
          if (alreadyCovered) return;

          reflections.push({
            id: `reflection_${now}_note_${index}_${Math.random().toString(36).substring(2, 6)}`,
            type: 'tension_reflection',
            title: `Pendalaman Catatan: ${note.title || 'Catatan Tanpa Judul'}`,
            observation: `Catatan "${note.title || 'Catatan Tanpa Judul'}" ditulis di kategori "${note.category || 'Umum'}". Catatan ini menyimpan pemikiran orisinal Anda yang berharga.`,
            formationBasis: `Refleksi ini dibentuk untuk menilik kembali catatan tunggal "${note.title || 'Catatan Tanpa Judul'}" yang menyimpan gagasan penting kamu di kategori "${note.category || 'Umum'}".`,
            question: `Jika kamu harus menghubungkan catatan "${note.title || 'Catatan Tanpa Judul'}" ini dengan konsep yang sama sekali berbeda dari bidang lain, gagasan luar biasa apakah itu?`,
            relatedNoteIds: [note.id],
            relatedThemeIds: [],
            relatedConnectionIds: [],
            createdAt: now + 30 + index,
          });
        });
      }

      // Fallback if there are completely no notes
      if (reflections.length === 0) {
        reflections.push({
          id: `reflection_${now}_empty`,
          type: 'pattern_reflection',
          title: 'Langkah Awal Refleksi',
          observation: 'Vault Anda masih kosong atau belum diisi dengan catatan yang cukup.',
          formationBasis: 'Belum ada data catatan untuk merumuskan landasan terbentuknya refleksi.',
          question: 'Refleksi membutuhkan data pemikiran kamu. Mari mulai menulis beberapa catatan di Noesis, hubungkan ide-ide kamu, dan saksikan bagaimana jalinan kognitif terbentuk!',
          relatedNoteIds: [],
          relatedThemeIds: [],
          relatedConnectionIds: [],
          createdAt: now,
        });
      }
    }

    // Sort by createdAt descending
    reflections.sort((a, b) => b.createdAt - a.createdAt);

    // Save the newly generated reflections to IndexedDB
    await saveReflectionsToDb(reflections);

    return reflections;
  }
}

export const reflectionService = new ReflectionService();
