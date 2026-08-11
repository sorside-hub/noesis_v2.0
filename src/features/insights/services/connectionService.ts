import { Connection, ConnectionCandidate } from '../types/connection';
import { Theme } from '../types/theme';
import { NoteItem } from '../../vault/pages/VaultPage';
import {
  getAllEmbeddings,
  getSavedConnectionsFromDb,
  saveConnectionsToDb,
  deleteConnectionFromDb,
  clearConnectionsInDb,
} from '../../../core/database/indexedDb';
import { extractConnectionCandidates } from '../utils/connectionMatching';

export class ConnectionService {
  /**
   * Retrieves saved connections from IndexedDB store "connections"
   */
  async getSavedConnections(): Promise<Connection[]> {
    return await getSavedConnectionsFromDb();
  }

  /**
   * Deletes a specific connection from IndexedDB
   */
  async deleteConnection(id: string): Promise<void> {
    await deleteConnectionFromDb(id);
  }

  /**
   * Clears all saved connections in IndexedDB
   */
  async clearConnections(): Promise<void> {
    await clearConnectionsInDb();
  }

  /**
   * Generates Connections following the natural semantic correlation flow.
   *
   * Flow:
   * Notes / Themes (IndexedDB)
   * ↓
   * Ambil embedding yang sudah tersedia (tanpa re-generate)
   * ↓
   * Hitung semantic similarity menggunakan cosine similarity
   * ↓
   * Cari hubungan paling kuat antar entitas (threshold >= 0.55)
   * ↓
   * AI memberi nama, deskripsi, dan reasoning bukti data berdasarkan keterkaitan
   * ↓
   * Simpan hasil ke IndexedDB store "connections"
   */
  async generateConnections(notes: NoteItem[], themes: Theme[] = []): Promise<Connection[]> {
    if ((!notes || notes.length === 0) && (!themes || themes.length === 0)) {
      throw new Error('Diperlukan catatan atau tema untuk menemukan keterkaitan semantik.');
    }

    // Step 1 & 2: Get pre-computed embeddings from IndexedDB (reusing existing cache)
    const storedEmbeddings = await getAllEmbeddings().catch(() => []);

    // Step 3 & 4: Extract candidates with strong cosine similarity
    const candidates: ConnectionCandidate[] = extractConnectionCandidates(
      notes,
      themes,
      storedEmbeddings
    );

    if (candidates.length === 0) {
      await saveConnectionsToDb([]);
      return [];
    }

    // Step 5: Send candidates to AI synthesis (/api/connections)
    let aiConnections: any[] = [];

    try {
      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ candidates }),
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.connections)) {
          aiConnections = data.connections;
        }
      } else {
        console.warn('Backend /api/connections error, using organic fallback synthesis.');
      }
    } catch (err) {
      console.warn('Network error calling /api/connections:', err);
    }

    const now = Date.now();

    // Map AI response or organic fallback to strict Connection output schema
    const finalConnections: Connection[] = candidates.map((cand, idx) => {
      const matchedAi =
        aiConnections.find((c) => c.candidateId === cand.candidateId) ||
        aiConnections[idx];

      const sourceTitlesStr = cand.sourceTitles.join(', ');
      const targetTitlesStr = cand.targetTitles.join(', ');

      const title =
        matchedAi?.title && typeof matchedAi.title === 'string' && matchedAi.title.trim().length > 0
          ? matchedAi.title.trim()
          : `Keterkaitan ${sourceTitlesStr} & ${targetTitlesStr}`;

      const description =
        matchedAi?.description && typeof matchedAi.description === 'string' && matchedAi.description.trim().length > 0
          ? matchedAi.description.trim()
          : `Hubungan semantik alami antara ${sourceTitlesStr} (${cand.sourceType}) dan ${targetTitlesStr} (${cand.targetType}).`;

      const reasoning =
        matchedAi?.reasoning && typeof matchedAi.reasoning === 'string' && matchedAi.reasoning.trim().length > 0
          ? matchedAi.reasoning.trim()
          : `Terdeteksi tingkat kemiripan semantik ${(cand.similarity * 100).toFixed(0)}% berdasarkan kesamaan konteks dan kata kunci dalam data.`;

      const rawStrength = typeof matchedAi?.strength === 'number'
        ? matchedAi.strength
        : cand.similarity;

      const strength = Math.min(1.0, Math.max(0.1, Math.round(rawStrength * 100) / 100));

      const sourceIds = matchedAi?.sourceIds && Array.isArray(matchedAi.sourceIds) && matchedAi.sourceIds.length > 0
        ? matchedAi.sourceIds
        : cand.sourceIds;

      const targetIds = matchedAi?.targetIds && Array.isArray(matchedAi.targetIds) && matchedAi.targetIds.length > 0
        ? matchedAi.targetIds
        : cand.targetIds;

      const sourceType: 'note' | 'theme' = matchedAi?.sourceType === 'note' || matchedAi?.sourceType === 'theme'
        ? matchedAi.sourceType
        : cand.sourceType;

      const targetType: 'note' | 'theme' = matchedAi?.targetType === 'note' || matchedAi?.targetType === 'theme'
        ? matchedAi.targetType
        : cand.targetType;

      const connectionType: 'theme_bridge' | 'theme_evidence' =
        matchedAi?.connectionType === 'theme_bridge' || matchedAi?.connectionType === 'theme_evidence'
          ? matchedAi.connectionType
          : (sourceType === 'theme' && targetType === 'theme' ? 'theme_bridge' : 'theme_evidence');

      return {
        id: `connection_${now}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
        title,
        description,
        sourceType,
        targetType,
        connectionType,
        sourceIds,
        targetIds,
        strength,
        reasoning,
        createdAt: now,
      };
    });

    // Step 6: Save results to IndexedDB store "connections"
    await saveConnectionsToDb(finalConnections);

    return finalConnections;
  }
}

export const connectionService = new ConnectionService();
