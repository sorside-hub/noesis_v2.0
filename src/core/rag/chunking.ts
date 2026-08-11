import { NoteChunk, Note } from '../../shared/types';

export interface ChunkOptions {
  maxChunkSize?: number;
  overlap?: number;
}

export class ChunkingService {
  chunkNote(
    noteOrId: string | Note | any,
    titleArg?: string,
    contentArg?: string,
    optionsArg: ChunkOptions = {}
  ): NoteChunk[] {
    let noteId: string = '';
    let title: string = '';
    let content: string = '';
    let category: string = 'self';
    let type: string = 'unknown';
    let tags: string[] = [];
    let createdAt: string | number | undefined;
    let updatedAt: string | number | undefined;
    let options: ChunkOptions = {};

    if (typeof noteOrId === 'object' && noteOrId !== null) {
      noteId = String(noteOrId.id || '');
      title = String(noteOrId.title || '').trim();
      content = String(noteOrId.content || '').trim();
      category = String(noteOrId.category || 'self').trim();
      type = String(noteOrId.type || 'unknown').trim();
      tags = Array.isArray(noteOrId.tags) ? noteOrId.tags : [];
      createdAt = noteOrId.createdAt;
      updatedAt = noteOrId.updatedAt;
      options = titleArg && typeof titleArg === 'object' ? titleArg : optionsArg;
    } else {
      noteId = String(noteOrId || '');
      title = String(titleArg || '').trim();
      content = String(contentArg || '').trim();
      options = optionsArg;
    }

    if (!noteId || !content) return [];

    const maxSize = options.maxChunkSize || 500;
    const overlap = options.overlap || 100;

    // Context header to retain note metadata inside every chunk's text representation
    const metaHeaderParts: string[] = [];
    if (title) metaHeaderParts.push(`Note: ${title}`);
    if (category) metaHeaderParts.push(`Category: ${category}`);
    if (type) metaHeaderParts.push(`Type: ${type}`);
    if (tags.length > 0) metaHeaderParts.push(`Tags: ${tags.join(', ')}`);

    const headerPrefix = metaHeaderParts.length > 0 ? `[${metaHeaderParts.join(' | ')}]\n\n` : '';

    const paragraphs = content.split(/\n\s*\n/);
    const rawChunks: string[] = [];
    let currentChunk = '';

    for (const p of paragraphs) {
      if (!p.trim()) continue;
      if ((currentChunk + '\n\n' + p).length <= maxSize) {
        currentChunk = currentChunk ? `${currentChunk}\n\n${p}` : p;
      } else {
        if (currentChunk) {
          rawChunks.push(currentChunk);
        }
        if (p.length > maxSize) {
          let start = 0;
          while (start < p.length) {
            const end = Math.min(start + maxSize, p.length);
            rawChunks.push(p.slice(start, end));
            if (end === p.length) break;
            start += maxSize - overlap;
          }
          currentChunk = '';
        } else {
          currentChunk = p;
        }
      }
    }

    if (currentChunk) {
      rawChunks.push(currentChunk);
    }

    return rawChunks.map((chunkText, index) => {
      const fullChunkText = headerPrefix ? `${headerPrefix}${chunkText}` : chunkText;
      return {
        noteId,
        title: title || 'Catatan Tanpa Judul',
        category,
        type,
        tags,
        chunkIndex: index,
        content: fullChunkText,
        createdAt,
        updatedAt,
      };
    });
  }
}

export const chunkingService = new ChunkingService();
