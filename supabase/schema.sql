-- Supabase DDL Schema for Noesis Cloud Backup Layer (Local-First Architecture)

-- 1. Enable pgvector extension for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Notes Table
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id UUID DEFAULT auth.uid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  type TEXT DEFAULT 'unknown',
  tags TEXT[] DEFAULT '{}',
  outgoing_links TEXT[] DEFAULT '{}',
  summary TEXT,
  distilled_content TEXT,
  distilled_at TIMESTAMPTZ,
  distilled_metadata JSONB,
  version INT DEFAULT 1,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Index for incremental sync queries
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);

-- 3. Note Chunks Table with Vector Embeddings (768 dimensions for Gemini Text Embeddings)
CREATE TABLE IF NOT EXISTS note_chunks (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID DEFAULT auth.uid(),
  chunk_text TEXT NOT NULL,
  chunk_index INT NOT NULL,
  embedding vector(768),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW Vector Index for efficient cosine similarity indexing
CREATE INDEX IF NOT EXISTS idx_note_chunks_embedding 
ON note_chunks 
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_note_chunks_note_id ON note_chunks(note_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_chunks ENABLE ROW LEVEL SECURITY;

-- Default permissive policies (Supports single-user local-first / anon development mode or auth-authenticated access)
CREATE POLICY "Allow public select on notes" ON notes FOR SELECT USING (true);
CREATE POLICY "Allow public all on notes" ON notes FOR ALL USING (true);

CREATE POLICY "Allow public select on note_chunks" ON note_chunks FOR SELECT USING (true);
CREATE POLICY "Allow public all on note_chunks" ON note_chunks FOR ALL USING (true);
