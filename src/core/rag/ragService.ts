import { chunkingService } from './chunking';
import { embeddingService } from './embedding';
import { saveEmbeddings, deleteEmbeddingsByNoteId } from '../database/indexedDb';
import { Note, NoteChunkEmbedding } from '../../shared/types';
import { syncEngine } from '../sync/syncEngine';

export class RAGService {
  async processAndStoreNote(note: Note): Promise<void> {
    if (!note || !note.id) return;

    const chunks = chunkingService.chunkNote(note);

    if (chunks.length === 0) {
      await deleteEmbeddingsByNoteId(note.id);
      return;
    }

    const contents = chunks.map((c) => c.content);
    const embeddings = await embeddingService.getBatchEmbeddings(contents);

    const now = Date.now();
    const chunkEmbeddings: NoteChunkEmbedding[] = chunks.map((chunk, index) => ({
      id: `${note.id}_chunk_${chunk.chunkIndex}`,
      noteId: note.id,
      title: chunk.title || note.title || 'Catatan Tanpa Judul',
      category: chunk.category || note.category || 'self',
      type: chunk.type || note.type || 'unknown',
      tags: chunk.tags || (Array.isArray(note.tags) ? note.tags : []),
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      embedding: embeddings[index] || [],
      createdAt: note.createdAt || now,
      updatedAt: note.updatedAt || now,
    }));

    await saveEmbeddings(note.id, chunkEmbeddings);

    // Push generated chunks to Supabase if connected
    syncEngine.pushNoteChunks(note.id).catch((err) => {
      console.warn(`[RAGService] Non-fatal error pushing note_chunks for ${note.id}:`, err);
    });
  }

  async removeNoteEmbeddings(noteId: string): Promise<void> {
    await deleteEmbeddingsByNoteId(noteId);
  }
}

export const ragService = new RAGService();
