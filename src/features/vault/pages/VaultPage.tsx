import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import {
  Plus,
  Search,
  ArrowLeft,
  StickyNote,
  Clock,
  Pin,
  Trash2,
  Hash,
  ChevronRight,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { NoteEditorPage } from './NoteEditorPage';
import { NoteDetailPage } from './NoteDetailPage';
import { TagPage } from './TagPage';
import { TrashPage } from './TrashPage';
import { CategoryPage, CATEGORIES, CategoryConfig } from './CategoryPage';
import { NotePropertyDrawer } from '../components/NotePropertyDrawer';
import { SearchInputWithSuggestions } from '../components/SearchInputWithSuggestions';
import { VaultHeader } from '../components/VaultHeader';
import { useNotes } from '../hooks/useNotes';
import { useSemanticSearch } from '../hooks/useSemanticSearch';
import { getNoteById } from '../services/noteService';
import { useNavigation } from '../../../core/navigation';
import { formatDateToDMY, getTodayDateFormatted } from '../../../shared/utils/dateUtils';

export type CategoryId = 'all' | 'world' | 'self' | 'ideas';

export interface DistillationMetadata {
  noteVersion?: number;
  isStale?: boolean;
  [key: string]: any;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  category: CategoryId;
  type: string;
  createdAt: string;
  updatedAt?: string;
  isPinned?: boolean;
  tags?: string[];
  outgoingLinks?: string[];
  summary?: string;
  distilledContent?: string;
  distilledAt?: string;
  distilledMetadata?: DistillationMetadata;
  syncStatus?: 'synced' | 'pending' | 'error';
  deletedAt?: string | null;
  version?: number;
}

export type { CategoryConfig };

const extractTags = (text: string): string[] => {
  const matches = text.match(/#([\w\u0600-\u06FF\-]+)/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.slice(1))));
};

// Persistent memory across view state changes and tab switches
let savedVaultSearchQuery = '';
let savedVaultSearchMode: 'keyword' | 'semantic' = 'keyword';
let savedVaultMainScrollTop = 0;

interface VaultPageProps {
  isPropertyDrawerOpen?: boolean;
  onClosePropertyDrawer?: () => void;
  onOpenPropertyDrawer?: () => void;
  pendingNoteFromAI?: { title: string; content: string } | null;
  onClearPendingNoteFromAI?: () => void;
  onOpenSettings?: () => void;
}

export const VaultPage: React.FC<VaultPageProps> = ({
  isPropertyDrawerOpen = false,
  onClosePropertyDrawer,
  onOpenPropertyDrawer,
  pendingNoteFromAI,
  onClearPendingNoteFromAI,
  onOpenSettings,
}) => {
  const { currentLocation, navigate, replace, goBack } = useNavigation();

  const vaultSubView = currentLocation.vaultViewState || 'list';
  const activeCategory = (currentLocation.categoryId as CategoryId) || null;
  const activeTagForExplorer = currentLocation.tagId !== undefined ? currentLocation.tagId : undefined;

  const [searchQuery, setSearchQuery] = useState<string>(savedVaultSearchQuery);
  const [searchMode, setSearchMode] = useState<'keyword' | 'semantic'>(savedVaultSearchMode);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Scroll retention container ref
  const mainContainerRef = useRef<HTMLDivElement | null>(null);

  // Restore scroll position whenever returning to list view
  useLayoutEffect(() => {
    if (vaultSubView === 'list' && mainContainerRef.current) {
      mainContainerRef.current.scrollTop = savedVaultMainScrollTop;
      const timer = requestAnimationFrame(() => {
        if (mainContainerRef.current) {
          mainContainerRef.current.scrollTop = savedVaultMainScrollTop;
        }
      });
      return () => cancelAnimationFrame(timer);
    }
  }, [vaultSubView]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    savedVaultMainScrollTop = e.currentTarget.scrollTop;
  };

  // Notes list using useNotes hook
  const {
    notes,
    activeNotes,
    trashNotes,
    createNote,
    updateNote,
    deleteNote,
    moveToTrash,
    restoreNote,
    deleteNotePermanently,
    emptyTrash,
    togglePin,
    searchNotes,
  } = useNotes();

  // Semantic search hook (operates on active notes only)
  const semanticSearch = useSemanticSearch(activeNotes);

  // Restore semantic search query if previously saved
  useEffect(() => {
    if (savedVaultSearchMode === 'semantic' && savedVaultSearchQuery) {
      semanticSearch.setQuery(savedVaultSearchQuery);
    }
  }, []);

  const handleSearchQueryChange = (val: string) => {
    savedVaultSearchQuery = val;
    setSearchQuery(val);
    if (searchMode === 'semantic') {
      semanticSearch.setQuery(val);
    }
  };

  const [activeNote, setActiveNote] = useState<NoteItem | null>(null);

  // Calculate total unique tags
  const allTagsCount = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((n) => {
      if (n.tags) {
        n.tags.forEach((t) => tagSet.add(t));
      }
    });
    return tagSet.size;
  }, [notes]);

  // Define 6 cards in exact requested order:
  // All - World
  // Tag Explorer - Self
  // Sampah - Ideas
  const catAll = CATEGORIES.find((c) => c.id === 'all');
  const catWorld = CATEGORIES.find((c) => c.id === 'world');
  const catSelf = CATEGORIES.find((c) => c.id === 'self');
  const catIdeas = CATEGORIES.find((c) => c.id === 'ideas');

  const vaultCards = [
    {
      id: 'all',
      title: catAll?.title || 'All',
      icon: catAll?.emoji || '📁',
      badge: `${notes.length} catatan`,
      onClick: () => handleSelectCategory('all'),
    },
    {
      id: 'world',
      title: catWorld?.title || 'World',
      icon: catWorld?.emoji || '🌍',
      badge: `${notes.filter((n) => n.category === 'world').length} catatan`,
      onClick: () => handleSelectCategory('world'),
    },
    {
      id: 'tag',
      title: 'Tag Explorer',
      icon: '#️⃣',
      badge: `${allTagsCount} tag`,
      onClick: () => handleOpenTagPage(null),
    },
    {
      id: 'self',
      title: catSelf?.title || 'Self',
      icon: catSelf?.emoji || '🪞',
      badge: `${notes.filter((n) => n.category === 'self').length} catatan`,
      onClick: () => handleSelectCategory('self'),
    },
    {
      id: 'trash',
      title: 'Sampah',
      icon: '🗑️',
      badge: `${trashNotes.length} item`,
      badgeColorClass: 'text-neutral-300 bg-neutral-800 border-neutral-700',
      onClick: () => handleOpenTrash(),
    },
    {
      id: 'ideas',
      title: catIdeas?.title || 'Ideas',
      icon: catIdeas?.emoji || '💡',
      badge: `${notes.filter((n) => n.category === 'ideas').length} catatan`,
      onClick: () => handleSelectCategory('ideas'),
    },
  ];
  const [editorCategory, setEditorCategory] = useState<CategoryId>('all');
  const [editorTitle, setEditorTitle] = useState<string>('');
  const [editorContent, setEditorContent] = useState<string>('');
  const [editorType, setEditorType] = useState<string>('unknown');
  const [editorTags, setEditorTags] = useState<string[]>([]);

  // Keep activeNote synced with currentLocation.noteId
  useEffect(() => {
    if (currentLocation.noteId) {
      const match = notes.find((n) => String(n.id) === String(currentLocation.noteId));
      if (match) {
        setActiveNote(match);
        setEditorTitle(match.title);
        setEditorContent(match.content);
        setEditorCategory(match.category);
        setEditorType(match.type || 'unknown');
        setEditorTags(match.tags || []);
      } else {
        getNoteById(currentLocation.noteId).then((n) => {
          if (n) {
            setActiveNote(n);
            setEditorTitle(n.title);
            setEditorContent(n.content);
            setEditorCategory(n.category);
            setEditorType(n.type || 'unknown');
            setEditorTags(n.tags || []);
          }
        });
      }
    }
  }, [currentLocation.noteId, notes]);

  // Open editor prefilled with AI response when created from Chat
  useEffect(() => {
    if (pendingNoteFromAI) {
      setActiveNote(null);
      setEditorTitle(pendingNoteFromAI.title);
      setEditorContent(pendingNoteFromAI.content);
      setEditorCategory('self');
      setEditorTags(['ai-chat']);
      showToast('Catatan dibuat dari jawaban AI');
      if (onClearPendingNoteFromAI) onClearPendingNoteFromAI();
    }
  }, [pendingNoteFromAI, onClearPendingNoteFromAI]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const handleSelectCategory = (catId: CategoryId) => {
    if (vaultSubView === 'category') {
      replace({ tab: 'vault', vaultViewState: 'category', categoryId: catId });
    } else {
      navigate({ tab: 'vault', vaultViewState: 'category', categoryId: catId });
    }
  };

  const handleOpenTagPage = (tag?: string | null) => {
    const targetTag = tag === undefined ? null : tag;
    navigate({
      tab: 'vault',
      vaultViewState: 'tag',
      tagId: targetTag,
      categoryId: currentLocation.categoryId,
    });
    if (onClosePropertyDrawer) onClosePropertyDrawer();
  };

  const handleOpenDetail = (note: NoteItem) => {
    setActiveNote(note);
    setEditorTitle(note.title);
    setEditorContent(note.content);
    setEditorCategory(note.category);
    setEditorType(note.type || 'unknown');
    setEditorTags(note.tags || []);
    navigate({
      tab: 'vault',
      vaultViewState: 'detail',
      noteId: note.id,
      categoryId: currentLocation.categoryId,
      tagId: currentLocation.tagId,
    });
  };

  const handleOpenCreateNew = (defaultCat: CategoryId = 'all') => {
    setActiveNote(null);
    setEditorTitle('');
    setEditorContent('');
    setEditorType('unknown');
    setEditorTags([]);
    setEditorCategory(activeCategory || defaultCat);
    navigate({
      tab: 'vault',
      vaultViewState: 'edit',
      noteId: null,
      categoryId: currentLocation.categoryId || defaultCat,
      tagId: currentLocation.tagId,
    });
  };

  const handleOpenEditCurrent = () => {
    if (activeNote) {
      setEditorTitle(activeNote.title);
      setEditorContent(activeNote.content);
      setEditorCategory(activeNote.category);
      setEditorType(activeNote.type || 'unknown');
      setEditorTags(activeNote.tags || []);
    }
    navigate({
      tab: 'vault',
      vaultViewState: 'edit',
      noteId: activeNote?.id || null,
      categoryId: currentLocation.categoryId,
      tagId: currentLocation.tagId,
    });
  };

  const handleTogglePin = (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    togglePin(noteId);
    showToast('Status pin disesuaikan');
  };

  const handleOpenTrash = () => {
    navigate({
      tab: 'vault',
      vaultViewState: 'trash',
      categoryId: currentLocation.categoryId,
    });
    if (onClosePropertyDrawer) onClosePropertyDrawer();
  };

  const handleDeleteNote = (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    moveToTrash(noteId);
    showToast('Catatan dipindahkan ke Sampah');
  };

  const handleAutoDetectResult = (result: { title: string; category: CategoryId; type?: string; tags: string[]; summary?: string; confidence?: number }) => {
    if (result.title) {
      setEditorTitle(result.title);
    }
    if (result.category) {
      setEditorCategory(result.category);
    }
    if (result.type) {
      setEditorType(result.type);
    }
    if (result.tags) {
      setEditorTags(result.tags);
    }

    if (activeNote) {
      const updatedNote: NoteItem = {
        ...activeNote,
        title: result.title || activeNote.title,
        category: result.category || activeNote.category,
        type: result.type || activeNote.type || 'unknown',
        tags: result.tags || activeNote.tags,
        summary: result.summary ?? activeNote.summary,
      };
      setActiveNote(updatedNote);
      updateNote(updatedNote);
    }

    showToast('Metadata (Judul, Kategori, Type, Tag) berhasil diterapkan');
  };

  const handleAutoCorrectApply = (newContent: string) => {
    setEditorContent(newContent);

    if (activeNote) {
      const updatedNote: NoteItem = {
        ...activeNote,
        content: newContent,
      };
      setActiveNote(updatedNote);
      updateNote(updatedNote);
    }

    showToast('Tulisan berhasil diperbaiki oleh Groq AI');
  };

  const handleSaveNote = async (noteData: { title: string; content: string; category: CategoryId }) => {
    const today = getTodayDateFormatted();
    const parsedTags = extractTags(noteData.content + ' ' + noteData.title);

    const currentTags = activeNote ? (activeNote.tags || []) : editorTags;
    const combinedTags = Array.from(new Set([...currentTags, ...parsedTags]));

    if (activeNote) {
      // Update existing note
      const updatedNote: NoteItem = {
        ...activeNote,
        title: noteData.title,
        content: noteData.content,
        category: noteData.category,
        type: activeNote.type || editorType || 'unknown',
        updatedAt: today,
        tags: combinedTags,
      };
      setActiveNote(updatedNote);
      await updateNote(updatedNote);
      showToast('Catatan berhasil disimpan');
      replace({
        tab: 'vault',
        vaultViewState: 'detail',
        noteId: updatedNote.id,
        categoryId: currentLocation.categoryId,
        tagId: currentLocation.tagId,
      });
    } else {
      // Create new note
      const newNote: NoteItem = {
        id: Date.now().toString(),
        title: noteData.title,
        content: noteData.content,
        category: noteData.category,
        type: editorType || 'unknown',
        createdAt: today,
        updatedAt: today,
        isPinned: false,
        tags: combinedTags,
      };
      setActiveNote(newNote);
      await createNote(newNote);
      showToast('Catatan baru berhasil dibuat');
      replace({
        tab: 'vault',
        vaultViewState: 'detail',
        noteId: newNote.id,
        categoryId: currentLocation.categoryId,
        tagId: currentLocation.tagId,
      });
    }
  };

  const selectedCategoryConfig = CATEGORIES.find((c) => c.id === activeCategory);

  // Vault Home search searches across all notes ('all' scope) via searchNotes
  const filteredNotes = searchNotes(searchQuery, 'all');

  const MAX_RECENT_NOTES = 5;

  // Catatan Terbaru: Ignore pin status, sort strictly by newest ID desc, limit to max 5
  const sortedNotes = useMemo(() => {
    if (searchQuery.trim()) {
      return [...filteredNotes].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    }
    const newest = [...filteredNotes].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    return newest.slice(0, MAX_RECENT_NOTES);
  }, [filteredNotes, searchQuery]);

  const handleCategoryChange = (newCat: CategoryId) => {
    setEditorCategory(newCat);
    if (activeNote) {
      const updated = { ...activeNote, category: newCat };
      setActiveNote(updated);
      updateNote(updated);
    }
  };

  const handleTypeChange = (newType: string) => {
    setEditorType(newType);
    if (activeNote) {
      const updated = { ...activeNote, type: newType };
      setActiveNote(updated);
      updateNote(updated);
    }
  };

  const handleTagsChange = (newTags: string[]) => {
    if (activeNote) {
      const updated = { ...activeNote, tags: newTags };
      setActiveNote(updated);
      updateNote(updated);
    }
  };

  const handleTogglePinCurrent = () => {
    if (activeNote) {
      const updated = { ...activeNote, isPinned: !activeNote.isPinned };
      setActiveNote(updated);
      togglePin(activeNote.id);
    }
  };

  const handleCloseView = () => {
    goBack();
  };

  const handleDeleteCurrent = () => {
    if (activeNote) {
      const noteId = activeNote.id;
      moveToTrash(noteId);
      handleCloseView();
      showToast('Catatan dipindahkan ke Sampah');
    }
  };

  const handleOpenCreateWithTitle = (titleToCreate: string) => {
    setActiveNote(null);
    setEditorTitle(titleToCreate);
    setEditorContent('');
    setEditorTags([]);
    setEditorCategory(activeCategory && activeCategory !== 'all' ? activeCategory : 'self');
    navigate({ tab: 'vault', vaultViewState: 'edit' });
    if (onClosePropertyDrawer) onClosePropertyDrawer();
    showToast(`Membuat catatan baru: "${titleToCreate}"`);
  };

  const handleSelectNoteByTitle = (targetTitle: string) => {
    if (!targetTitle || !targetTitle.trim()) return;
    const match = notes.find(
      (n) => n.title.trim().toLowerCase() === targetTitle.trim().toLowerCase()
    );
    if (match) {
      handleOpenDetail(match);
      if (onClosePropertyDrawer) onClosePropertyDrawer();
      showToast(`Membuka catatan: ${match.title}`);
    } else {
      handleOpenCreateWithTitle(targetTitle.trim());
    }
  };

  // Render Fullpage Detail Note Page
  if (vaultSubView === 'detail' && activeNote) {
    return (
      <>
        <NoteDetailPage
          id={activeNote.id}
          title={activeNote.title}
          content={activeNote.content}
          category={activeNote.category}
          type={activeNote.type}
          createdAt={activeNote.createdAt}
          updatedAt={activeNote.updatedAt}
          deletedAt={activeNote.deletedAt}
          isPinned={activeNote.isPinned}
          tags={activeNote.tags}
          allNotes={notes}
          onSelectNoteByTitle={handleSelectNoteByTitle}
          onSelectTag={handleOpenTagPage}
          onBack={handleCloseView}
          onEdit={handleOpenEditCurrent}
          onTogglePin={handleTogglePinCurrent}
          onDelete={handleDeleteCurrent}
          onRestore={() => {
            restoreNote(activeNote.id);
            showToast('Catatan berhasil dipulihkan');
          }}
          onOpenProperties={onOpenPropertyDrawer}
        />
        <NotePropertyDrawer
          isOpen={isPropertyDrawerOpen}
          onClose={() => onClosePropertyDrawer && onClosePropertyDrawer()}
          type={activeNote.type || editorType}
          onTypeChange={handleTypeChange}
          category={activeNote.category}
          onCategoryChange={handleCategoryChange}
          createdDate={activeNote.createdAt}
          updatedDate={activeNote.updatedAt}
          tags={activeNote.tags || []}
          onTagsChange={handleTagsChange}
          noteContent={activeNote.content}
          noteTitle={activeNote.title}
          currentNoteId={activeNote.id}
          allNotes={notes}
          onSelectNoteByTitle={handleSelectNoteByTitle}
          onSelectTag={handleOpenTagPage}
          onAutoDetectResult={handleAutoDetectResult}
          onAutoCorrectApply={handleAutoCorrectApply}
        />
      </>
    );
  }

  // Render Fullpage Note Editor Page
  if (vaultSubView === 'edit') {
    return (
      <>
        <NoteEditorPage
          key={activeNote ? activeNote.id : 'new-note'}
          initialTitle={activeNote?.title || ''}
          initialContent={activeNote?.content || ''}
          initialCategory={activeNote?.category || editorCategory}
          title={editorTitle}
          content={editorContent}
          category={editorCategory}
          allNotes={notes}
          onSelectNoteByTitle={handleSelectNoteByTitle}
          onSelectTag={handleOpenTagPage}
          onTitleChange={setEditorTitle}
          onContentChange={setEditorContent}
          onCategoryChange={setEditorCategory}
          onSave={handleSaveNote}
          onCancel={goBack}
          onOpenProperties={onOpenPropertyDrawer}
        />
        <NotePropertyDrawer
          isOpen={isPropertyDrawerOpen}
          onClose={() => onClosePropertyDrawer && onClosePropertyDrawer()}
          type={activeNote ? (activeNote.type || editorType) : editorType}
          onTypeChange={(newType) => {
            setEditorType(newType);
            handleTypeChange(newType);
          }}
          category={editorCategory}
          onCategoryChange={(newCat) => {
            setEditorCategory(newCat);
            handleCategoryChange(newCat);
          }}
          createdDate={formatDateToDMY(activeNote?.createdAt)}
          updatedDate={formatDateToDMY(activeNote?.updatedAt)}
          tags={activeNote ? (activeNote.tags || []) : editorTags}
          onTagsChange={(newTags) => {
            setEditorTags(newTags);
            handleTagsChange(newTags);
          }}
          noteContent={editorContent}
          noteTitle={editorTitle}
          currentNoteId={activeNote?.id}
          allNotes={notes}
          onSelectNoteByTitle={handleSelectNoteByTitle}
          onSelectTag={handleOpenTagPage}
          onAutoDetectResult={handleAutoDetectResult}
          onAutoCorrectApply={handleAutoCorrectApply}
          hideRelatedNotes={true}
          isEditorMode={true}
        />
      </>
    );
  }

  // Render Fullpage Tag Explorer / Tag Detail Page
  if (vaultSubView === 'tag' || activeTagForExplorer !== undefined) {
    return (
      <TagPage
        initialTag={activeTagForExplorer}
        notes={notes}
        onBack={goBack}
        onSelectNote={(note) => {
          handleOpenDetail(note);
        }}
        onSelectTag={(tag) => {
          handleOpenTagPage(tag);
        }}
        toastMessage={toastMessage}
      />
    );
  }

  // Render Fullpage Trash Page
  if (vaultSubView === 'trash') {
    return (
      <TrashPage
        trashNotes={trashNotes}
        onBack={goBack}
        onOpenNote={(note) => handleOpenDetail(note)}
        onRestoreNote={(id) => {
          restoreNote(id);
          showToast('Catatan dipulihkan ke Vault');
        }}
        onDeletePermanently={(id) => {
          deleteNotePermanently(id);
          showToast('Catatan dihapus secara permanen');
        }}
        onEmptyTrash={() => {
          emptyTrash();
          showToast('Seluruh sampah telah dikosongkan');
        }}
        toastMessage={toastMessage}
      />
    );
  }

  // Component to render individual Note Card
  const renderNoteCard = (note: NoteItem) => (
    <div
      key={note.id}
      onClick={() => handleOpenDetail(note)}
      className={`p-4 bg-[#1C1C1C] hover:bg-[#242424] border ${
        note.isPinned ? 'border-neutral-500/50 bg-[#1C1C1C]/90' : 'border-[#2A2A2A]'
      } hover:border-[#383838] rounded-2xl transition-all cursor-pointer group flex flex-col gap-2 relative shadow-sm`}
    >
      {/* Header: Title & Pin/Delete Buttons */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h3 className="text-sm font-bold text-[#E5E5E5] group-hover:text-neutral-300 transition-colors truncate">
            {note.title.trim() || 'Catatan Tanpa Judul'}
          </h3>
        </div>

        {/* Action Buttons: Pin & Delete */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => handleTogglePin(e, note.id)}
            title={note.isPinned ? 'Lepas Pin' : 'Sematkan (Pin)'}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              note.isPinned
                ? 'text-[#E5E5E5] bg-[#2A2A2A] hover:bg-[#333333]'
                : 'text-[#737373] hover:text-[#E5E5E5] hover:bg-[#2A2A2A]'
            }`}
          >
            <Pin className={`w-3.5 h-3.5 ${note.isPinned ? 'fill-current' : ''}`} />
          </button>

          <button
            type="button"
            onClick={(e) => handleDeleteNote(e, note.id)}
            title="Hapus Catatan"
            className="p-1.5 rounded-lg text-[#737373] hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Preview Content */}
      <p className="text-xs text-[#A3A3A3] line-clamp-2 leading-relaxed">
        {note.content.trim() || 'Catatan kosong...'}
      </p>

      {/* Footer: Date Created & Modified (No time) + Tags */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#262626] flex-wrap mt-0.5">
        <div className="text-[10px] text-[#737373] flex items-center gap-1.5 flex-wrap">
          <span>Dibuat: {formatDateToDMY(note.createdAt)}</span>
          {note.updatedAt && (
            <>
              <span>•</span>
              <span>Diedit: {formatDateToDMY(note.updatedAt)}</span>
            </>
          )}
        </div>

        {note.tags && note.tags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {note.tags.map((tag, idx) => {
              const cleanTag = tag.replace(/^#/, '');
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenTagPage(cleanTag);
                  }}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-[#242424] hover:bg-[#2C2C2C] border border-[#303030] hover:border-neutral-500/50 text-[#A3A3A3] hover:text-neutral-300 font-medium transition-colors cursor-pointer"
                >
                  #{cleanTag}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // Render View inside a specific Category Page
  if ((vaultSubView === 'category' || activeCategory) && selectedCategoryConfig) {
    return (
      <CategoryPage
        categoryConfig={selectedCategoryConfig}
        notes={notes}
        onBack={goBack}
        onSelectNote={handleOpenDetail}
        onTogglePin={handleTogglePin}
        onDeleteNote={handleDeleteNote}
        onCreateNote={handleOpenCreateNew}
        onSelectTag={handleOpenTagPage}
        toastMessage={toastMessage}
      />
    );
  }

  // Render Main Vault View
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
      {/* Self-contained Vault Header */}
      <VaultHeader onBack={goBack} onOpenSettings={onOpenSettings} />

      {/* Scrollable Content Container */}
      <div
        ref={mainContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-5 flex flex-col max-w-lg mx-auto w-full pb-12"
      >
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#262626] text-[#E5E5E5] border border-[#3A3A3A] px-4 py-2 rounded-full text-xs shadow-xl animate-fadeIn">
            {toastMessage}
          </div>
        )}

      {/* Header Vault Section */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#E5E5E5] tracking-tight">Vault</h1>
        </div>

        <button
          onClick={() => handleOpenCreateNew()}
          className="flex items-center gap-2 px-3.5 py-2.5 bg-[#E5E5E5] hover:bg-white active:scale-95 text-[#111111] text-xs font-semibold rounded-xl shadow-lg transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Note</span>
        </button>
      </div>

      {/* Search Bar UI with Realtime Suggestions */}
      <SearchInputWithSuggestions
        value={searchQuery}
        onChange={handleSearchQueryChange}
        placeholder={
          searchMode === 'semantic'
            ? 'Cari berdasarkan kemiripan makna (mis: prinsip stoik)...'
            : 'Cari dalam catatan Vault...'
        }
        categoryScope="all"
        notes={notes}
        onSelectNote={handleOpenDetail}
        className="mb-2"
        searchMode={searchMode}
        onSearchEnter={() => {
          if (searchMode === 'semantic') {
            semanticSearch.setQuery(searchQuery);
            semanticSearch.performSearch(searchQuery);
          }
          const target = document.getElementById('search-results-anchor');
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }}
      />

      {/* Mode Pencarian Toggle (Teks vs Semantic Search) */}
      <div className="flex items-center gap-1.5 p-1 bg-[#181818] border border-[#2A2A2A] rounded-xl mb-5">
        <button
          type="button"
          onClick={() => {
            savedVaultSearchMode = 'keyword';
            setSearchMode('keyword');
          }}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            searchMode === 'keyword'
              ? 'bg-[#282828] text-[#E5E5E5] shadow-sm'
              : 'text-[#8E8E93] hover:text-[#E5E5E5]'
          }`}
        >
          <Search className="w-3.5 h-3.5 text-neutral-400" />
          <span>Teks & Tag</span>
        </button>

        <button
          type="button"
          onClick={() => {
            savedVaultSearchMode = 'semantic';
            setSearchMode('semantic');
            if (searchQuery) {
              semanticSearch.setQuery(searchQuery);
            }
          }}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            searchMode === 'semantic'
              ? 'bg-[#2A2A2A] text-[#E5E5E5] border border-[#333333] shadow-sm'
              : 'text-[#8E8E93] hover:text-[#E5E5E5]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-neutral-400" />
          <span>Semantic Search</span>
        </button>
      </div>

      {/* Render Category Cards Grid ONLY when search query is empty */}
      {!searchQuery.trim() && (
        <>
          {/* Category Section Header */}
          <div className="flex items-center justify-between mb-3 px-0.5">
            <span className="text-xs font-semibold text-[#A3A3A3] uppercase tracking-wider">
              Kategori & Tag
            </span>
            <span className="text-[11px] text-[#666666]">4 Kategori</span>
          </div>

          {/* Category Cards Grid (2 Columns, Order: All-World, Tag Explorer-Self, Sampah-Ideas) */}
          <div className="grid grid-cols-2 gap-3">
            {vaultCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={card.onClick}
                className="flex flex-col justify-between text-left p-3.5 bg-[#1C1C1C] hover:bg-[#242424] active:scale-[0.98] border border-[#2A2A2A] hover:border-[#383838] rounded-2xl transition-all cursor-pointer group shadow-sm min-h-[76px]"
              >
                {/* Line 1: Icon + Judul */}
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200">
                    {typeof card.icon === 'string' ? (
                      <span className="text-lg leading-none">{card.icon}</span>
                    ) : (
                      card.icon
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-[#E5E5E5] group-hover:text-neutral-200 transition-colors truncate">
                    {card.title}
                  </h3>
                </div>

                {/* Line 2: Badge total */}
                <div className="flex items-center justify-start mt-2.5">
                  <span
                    className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full border transition-colors ${
                      card.badgeColorClass ||
                      'text-[#A3A3A3] bg-[#242424] group-hover:bg-[#2C2C2C] group-hover:text-[#E5E5E5] border-[#303030]'
                    }`}
                  >
                    {card.badge}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Target anchor for automated scrolling to search results */}
      <div id="search-results-anchor" className="scroll-mt-4" />

      {/* Render Search Results ONLY when search query is active */}
      {Boolean(searchQuery.trim()) && (
        <>
          {searchMode === 'semantic' ? (
            <>
              <div className="flex items-center justify-between mb-3 px-0.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  <Sparkles className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Semantic Search (Makna ≥ 50%)</span>
                </div>
                {!semanticSearch.isLoading && (
                  <span className="text-[11px] font-medium text-[#A3A3A3] bg-[#2A2A2A] px-2.5 py-0.5 rounded-full border border-[#333333]">
                    {semanticSearch.results.length} ditemukan
                  </span>
                )}
              </div>

              {semanticSearch.isLoading ? (
                <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3">
                  <Loader2 className="w-6 h-6 text-neutral-400 animate-spin" />
                  <span className="text-xs font-medium text-[#E5E5E5]">
                    Menganalisis kemiripan makna vektor...
                  </span>
                </div>
              ) : semanticSearch.results.length > 0 ? (
                <div className="space-y-3">
                  {semanticSearch.results.map(({ note, snippet }) => {
                    const categoryObj = CATEGORIES.find((c) => c.id === note.category);
                    return (
                      <div
                        key={`sem_${note.id}`}
                        onClick={() => handleOpenDetail(note)}
                        className="p-4 bg-[#1C1C1C] hover:bg-[#242424] border border-[#2A2A2A] hover:border-neutral-500/50 rounded-2xl transition-all cursor-pointer group flex flex-col gap-2 relative shadow-sm"
                      >
                        {/* Header with Title & Category */}
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-bold text-[#E5E5E5] group-hover:text-neutral-300 transition-colors truncate flex-1">
                            {note.title.trim() || 'Catatan Tanpa Judul'}
                          </h3>
                          {categoryObj && (
                            <span className="text-[10px] font-semibold text-[#A3A3A3] bg-[#242424] px-2.5 py-0.5 rounded-full border border-[#303030] shrink-0 flex items-center gap-1">
                              <span>{categoryObj.emoji}</span>
                              <span>{categoryObj.title}</span>
                            </span>
                          )}
                        </div>

                        {/* Preview snippet content */}
                        <p className="text-xs text-[#A3A3A3] line-clamp-3 leading-relaxed bg-[#141414] p-2.5 rounded-xl border border-[#262626]">
                          "{snippet || note.content}"
                        </p>

                        {/* Footer info */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#262626] flex-wrap text-[10px] text-[#737373]">
                          <span>Dibuat: {formatDateToDMY(note.createdAt)}</span>
                          {note.tags && note.tags.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              {note.tags.map((t, idx) => (
                                <span key={idx} className="px-1.5 py-0.5 rounded bg-[#242424] text-[#A3A3A3]">
                                  #{t.replace(/^#/, '')}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-[#1C1C1C]/80 border border-[#2A2A2A] rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#242424] border border-[#333333] flex items-center justify-center text-[#A3A3A3] mb-3">
                    <Sparkles className="w-6 h-6 stroke-[1.75]" />
                  </div>
                  <h4 className="text-xs font-semibold text-[#E5E5E5] mb-1">
                    Tidak Ditemukan Hasil Semantik
                  </h4>
                  <p className="text-[11px] text-[#8E8E93] max-w-xs leading-relaxed">
                    Tidak ada catatan yang memiliki kemiripan makna ≥ 50% untuk "{searchQuery}". Coba masukkan konsep atau kalimat lain.
                  </p>
                </div>
              )}
            </>
          ) : (
            /* Keyword / Tag Search Mode */
            <>
              {/* Search Results Section Header */}
              <div className="flex items-center justify-between mb-3 px-0.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                  <Search className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="text-[#E5E5E5]">Hasil Pencarian</span>
                </div>
                <span className="text-[11px] font-medium text-[#A3A3A3] bg-[#242424] px-2.5 py-0.5 rounded-full border border-[#303030]">
                  {sortedNotes.length} ditemukan
                </span>
              </div>

              {/* List or Empty State UI for Search Results */}
              {sortedNotes.length > 0 ? (
                <div className="space-y-3">
                  {sortedNotes.map((note) => renderNoteCard(note))}
                </div>
              ) : (
                <div className="bg-[#1C1C1C]/80 border border-[#2A2A2A] rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#242424] border border-[#333333] flex items-center justify-center text-neutral-400 mb-3">
                    <Search className="w-6 h-6 stroke-[1.75] text-[#A3A3A3]" />
                  </div>
                  <h4 className="text-xs font-semibold text-[#E5E5E5] mb-1">
                    Tidak Ditemukan Hasil
                  </h4>
                  <p className="text-[11px] text-[#8E8E93] max-w-xs leading-relaxed mb-4">
                    Tidak ditemukan catatan yang cocok dengan "{searchQuery}". Coba kata kunci atau tag lain.
                  </p>
                  <button
                    onClick={() => handleSearchQueryChange('')}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-[#262626] hover:bg-[#303030] border border-[#3A3A3A] text-[#E5E5E5] text-xs font-medium rounded-xl transition-all cursor-pointer active:scale-95"
                  >
                    <span>Bersihkan Pencarian</span>
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
    </div>
  );
};


