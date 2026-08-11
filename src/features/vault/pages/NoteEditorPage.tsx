import React, { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Heading,
  Heading1,
  Heading2,
  Heading3,
  ChevronDown,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  FileSymlink,
  Check,
  X,
  Save,
  Edit3,
  Eye,
} from 'lucide-react';
import { CategoryId, NoteItem } from './VaultPage';
import { MarkdownRenderer } from '../../../shared/components/MarkdownRenderer';
import { useWikilinkAutocomplete } from '../hooks/useWikilinkAutocomplete';
import { WikilinkAutocompletePopup } from '../components/WikilinkAutocompletePopup';
import { VaultHeader } from '../components/VaultHeader';

interface NoteEditorPageProps {
  initialTitle?: string;
  initialContent?: string;
  initialCategory?: CategoryId;
  initialMode?: 'edit' | 'preview';
  onSave: (note: { title: string; content: string; category: CategoryId }) => void;
  onCancel: () => void;
  category?: CategoryId;
  title?: string;
  content?: string;
  allNotes?: NoteItem[];
  onSelectNoteByTitle?: (title: string) => void;
  onSelectTag?: (tag: string) => void;
  onTitleChange?: (title: string) => void;
  onContentChange?: (content: string) => void;
  onCategoryChange?: (category: CategoryId) => void;
  onOpenProperties?: () => void;
}

export const NoteEditorPage: React.FC<NoteEditorPageProps> = ({
  initialTitle = '',
  initialContent = '',
  initialCategory = 'all',
  initialMode = 'edit',
  onSave,
  onCancel,
  category: propCategory,
  title: propTitle,
  content: propContent,
  allNotes,
  onSelectNoteByTitle,
  onSelectTag,
  onTitleChange,
  onContentChange,
  onCategoryChange,
  onOpenProperties,
}) => {
  const [title, setTitle] = useState<string>(propTitle ?? initialTitle);
  const [content, setContent] = useState<string>(propContent ?? initialContent);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>(
    propCategory && propCategory !== 'all'
      ? propCategory
      : initialCategory !== 'all'
      ? initialCategory
      : 'self'
  );
  const [mode, setMode] = useState<'edit' | 'preview'>(initialMode);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isHeadingOpen, setIsHeadingOpen] = useState<boolean>(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (propTitle !== undefined) {
      setTitle(propTitle);
    }
  }, [propTitle]);

  useEffect(() => {
    if (propContent !== undefined) {
      setContent(propContent);
    }
  }, [propContent]);

  useEffect(() => {
    if (propCategory && propCategory !== 'all') {
      setSelectedCategory(propCategory);
    }
  }, [propCategory]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTitleChangeInternal = (newTitle: string) => {
    setTitle(newTitle);
    if (onTitleChange) onTitleChange(newTitle);
  };

  const handleContentChangeInternal = (newContent: string) => {
    setContent(newContent);
    if (onContentChange) onContentChange(newContent);
  };

  const wikilinkAutocomplete = useWikilinkAutocomplete({
    textareaRef,
    content,
    onContentChange: handleContentChangeInternal,
    allNotes,
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const handleFormat = (
    type:
      | 'bold'
      | 'italic'
      | 'underline'
      | 'h1'
      | 'h2'
      | 'h3'
      | 'ul'
      | 'ol'
      | 'quote'
      | 'code'
      | 'link'
      | 'wikilink'
  ) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);

    let replacement = '';
    let cursorOffset = 0;

    switch (type) {
      case 'bold':
        if (selected) {
          replacement = `**${selected}**`;
          cursorOffset = replacement.length;
        } else {
          replacement = '****';
          cursorOffset = 2;
        }
        break;

      case 'italic':
        if (selected) {
          replacement = `*${selected}*`;
          cursorOffset = replacement.length;
        } else {
          replacement = '**';
          cursorOffset = 1;
        }
        break;

      case 'underline':
        if (selected) {
          replacement = `<u>${selected}</u>`;
          cursorOffset = replacement.length;
        } else {
          replacement = '<u></u>';
          cursorOffset = 3;
        }
        break;

      case 'h1':
        if (selected) {
          replacement = `# ${selected}`;
          cursorOffset = replacement.length;
        } else {
          replacement = '# ';
          cursorOffset = 2;
        }
        break;

      case 'h2':
        if (selected) {
          replacement = `## ${selected}`;
          cursorOffset = replacement.length;
        } else {
          replacement = '## ';
          cursorOffset = 3;
        }
        break;

      case 'h3':
        if (selected) {
          replacement = `### ${selected}`;
          cursorOffset = replacement.length;
        } else {
          replacement = '### ';
          cursorOffset = 4;
        }
        break;

      case 'ul':
        if (selected) {
          replacement = selected
            .split('\n')
            .map((line) => `- ${line}`)
            .join('\n');
          cursorOffset = replacement.length;
        } else {
          replacement = '- ';
          cursorOffset = 2;
        }
        break;

      case 'ol':
        if (selected) {
          replacement = selected
            .split('\n')
            .map((line, idx) => `${idx + 1}. ${line}`)
            .join('\n');
          cursorOffset = replacement.length;
        } else {
          replacement = '1. ';
          cursorOffset = 3;
        }
        break;

      case 'quote':
        if (selected) {
          replacement = `> ${selected}`;
          cursorOffset = replacement.length;
        } else {
          replacement = '> ';
          cursorOffset = 2;
        }
        break;

      case 'code':
        if (selected) {
          if (selected.includes('\n')) {
            replacement = `\`\`\`\n${selected}\n\`\`\``;
            cursorOffset = replacement.length;
          } else {
            replacement = `\`${selected}\``;
            cursorOffset = replacement.length;
          }
        } else {
          replacement = '``';
          cursorOffset = 1;
        }
        break;

      case 'link':
        if (selected) {
          replacement = `[${selected}](url)`;
          cursorOffset = replacement.length - 1;
        } else {
          replacement = '[]()';
          cursorOffset = 1;
        }
        break;

      case 'wikilink':
        if (selected) {
          replacement = `[[${selected}]]`;
          cursorOffset = replacement.length;
        } else {
          replacement = '[[]]';
          cursorOffset = 2;
        }
        break;
    }

    const newContent =
      content.substring(0, start) + replacement + content.substring(end);
    handleContentChangeInternal(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (wikilinkAutocomplete.handleKeyDown(e)) {
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const newContent =
        content.substring(0, start) + '  ' + content.substring(end);
      setContent(newContent);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 2, start + 2);
      }, 0);
    }
  };

  const handleSave = () => {
    if (!title.trim() && !content.trim()) {
      showToast('Judul atau isi catatan tidak boleh kosong!');
      return;
    }

    showToast('Menyimpan catatan...');
    setTimeout(() => {
      onSave({
        title: title.trim(),
        content: content,
        category: selectedCategory,
      });
    }, 300);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#131313] select-none relative animate-fadeIn pb-14 overflow-hidden">
      {/* Self-contained Header */}
      <VaultHeader onBack={onCancel} onOpenProperties={onOpenProperties} />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#262626] text-[#E5E5E5] border border-[#3A3A3A] px-4 py-2 rounded-full text-xs shadow-xl flex items-center gap-2 animate-fadeIn">
          <Check className="w-3.5 h-3.5 text-neutral-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-8 max-w-lg mx-auto w-full flex flex-col">
        {/* Mode Switcher */}
        <div className="flex items-center justify-center mb-3 border-b border-[#262626] pb-2.5">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 bg-[#1A1A1A] border border-[#2A2A2A] p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setMode('edit')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                mode === 'edit'
                  ? 'bg-[#2A2A2A] text-[#E5E5E5] shadow-xs'
                  : 'text-[#737373] hover:text-[#A3A3A3]'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5 text-neutral-400" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('preview')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                mode === 'preview'
                  ? 'bg-[#2A2A2A] text-[#E5E5E5] shadow-xs'
                  : 'text-[#737373] hover:text-[#A3A3A3]'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-neutral-400" />
              <span>Preview</span>
            </button>
          </div>
        </div>

        {/* Title Input */}
        <input
          type="text"
          placeholder="Judul Catatan..."
          value={title}
          onChange={(e) => handleTitleChangeInternal(e.target.value)}
          className="text-lg font-bold text-[#E5E5E5] placeholder-[#525252] bg-transparent focus:outline-none mb-3 pb-2 border-b border-[#2A2A2A] w-full font-sans"
        />

        {mode === 'edit' ? (
          <>
            {/* Formatting Toolbar */}
            <div className="flex items-center gap-1 bg-[#1A1A1A] border border-[#2C2C2C] p-1.5 rounded-xl mb-3 overflow-x-auto scrollbar-none shrink-0 relative">
              <button
                type="button"
                onClick={() => handleFormat('bold')}
                title="Tebal (Bold)"
                className="p-1.5 rounded-lg text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#262626] active:scale-95 transition-colors cursor-pointer shrink-0"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleFormat('italic')}
                title="Miring (Italic)"
                className="p-1.5 rounded-lg text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#262626] active:scale-95 transition-colors cursor-pointer shrink-0"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleFormat('underline')}
                title="Garis Bawah (Underline)"
                className="p-1.5 rounded-lg text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#262626] active:scale-95 transition-colors cursor-pointer shrink-0"
              >
                <Underline className="w-4 h-4" />
              </button>

              <div className="w-[1px] h-4 bg-[#303030] mx-1 shrink-0" />

              {/* Headings Dropdown */}
              <div className="shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setDropdownPos({ top: rect.bottom + 6, left: rect.left });
                    setIsHeadingOpen((prev) => !prev);
                  }}
                  title="Pilih Judul (H1 - H3)"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#262626] active:scale-95 transition-colors cursor-pointer text-xs font-semibold"
                >
                  <Heading className="w-4 h-4" />
                  <ChevronDown className={`w-3 h-3 text-[#737373] transition-transform ${isHeadingOpen ? 'rotate-180' : ''}`} />
                </button>

                {isHeadingOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsHeadingOpen(false)}
                    />
                    <div
                      style={{ top: `${dropdownPos.top}px`, left: `${dropdownPos.left}px` }}
                      className="fixed z-50 bg-[#1E1E1E] border border-[#333333] rounded-xl shadow-2xl py-1 min-w-[140px] flex flex-col gap-0.5 animate-fadeIn"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          handleFormat('h1');
                          setIsHeadingOpen(false);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#D4D4D4] hover:bg-[#2A2A2A] hover:text-white transition-colors text-left cursor-pointer"
                      >
                        <Heading1 className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Judul (H1)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleFormat('h2');
                          setIsHeadingOpen(false);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#D4D4D4] hover:bg-[#2A2A2A] hover:text-white transition-colors text-left cursor-pointer"
                      >
                        <Heading2 className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Sub Judul (H2)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleFormat('h3');
                          setIsHeadingOpen(false);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#D4D4D4] hover:bg-[#2A2A2A] hover:text-white transition-colors text-left cursor-pointer"
                      >
                        <Heading3 className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Sub Bagian (H3)</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="w-[1px] h-4 bg-[#303030] mx-1 shrink-0" />

              <button
                type="button"
                onClick={() => handleFormat('ul')}
                title="Daftar Bintik (Bullet List)"
                className="p-1.5 rounded-lg text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#262626] active:scale-95 transition-colors cursor-pointer shrink-0"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleFormat('ol')}
                title="Daftar Angka (Numbered List)"
                className="p-1.5 rounded-lg text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#262626] active:scale-95 transition-colors cursor-pointer shrink-0"
              >
                <ListOrdered className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleFormat('quote')}
                title="Kutipan (Blockquote)"
                className="p-1.5 rounded-lg text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#262626] active:scale-95 transition-colors cursor-pointer shrink-0"
              >
                <Quote className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleFormat('code')}
                title="Kode (Inline / Block)"
                className="p-1.5 rounded-lg text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#262626] active:scale-95 transition-colors cursor-pointer shrink-0"
              >
                <Code className="w-4 h-4" />
              </button>

              <div className="w-[1px] h-4 bg-[#303030] mx-1 shrink-0" />

              <button
                type="button"
                onClick={() => handleFormat('link')}
                title="External Link ([teks](url))"
                className="p-1.5 rounded-lg text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#262626] active:scale-95 transition-colors cursor-pointer shrink-0"
              >
                <LinkIcon className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleFormat('wikilink')}
                title="Link Note / Wikilink ([[Nama Catatan]])"
                className="p-1.5 rounded-lg text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#262626] active:scale-95 transition-colors cursor-pointer shrink-0 flex items-center gap-0.5"
              >
                <FileSymlink className="w-4 h-4" />
              </button>
            </div>

            {/* Textarea Content Editor */}
            <div className="relative flex-1 flex flex-col min-h-[320px]">
              <textarea
                ref={textareaRef}
                placeholder="Mulai menulis catatan kamu di sini..."
                value={content}
                onChange={(e) => handleContentChangeInternal(e.target.value)}
                onSelect={() => wikilinkAutocomplete.checkAutocompleteTrigger()}
                onKeyUp={() => wikilinkAutocomplete.checkAutocompleteTrigger()}
                onClick={() => wikilinkAutocomplete.checkAutocompleteTrigger()}
                onScroll={() => wikilinkAutocomplete.checkAutocompleteTrigger()}
                onKeyDown={handleKeyDown}
                className="flex-1 w-full text-sm leading-relaxed text-[#D4D4D4] placeholder-[#484848] bg-transparent focus:outline-none resize-none font-sans pb-12"
              />

              {/* Wikilink Autocomplete Dropdown Popup */}
              <WikilinkAutocompletePopup
                isOpen={wikilinkAutocomplete.isOpen}
                suggestions={wikilinkAutocomplete.suggestions}
                selectedIndex={wikilinkAutocomplete.selectedIndex}
                onSelect={wikilinkAutocomplete.selectSuggestion}
                onHoverIndex={wikilinkAutocomplete.setSelectedIndex}
                query={wikilinkAutocomplete.query}
                position={wikilinkAutocomplete.position}
              />
            </div>
          </>
        ) : (
          /* Live Markdown Preview Container */
          <div className="bg-[#181818] border border-[#282828] rounded-2xl p-4 min-h-[360px] shadow-inner flex-1">
            {content.trim() ? (
              <MarkdownRenderer
                content={content}
                allNotes={allNotes}
                onWikilinkClick={onSelectNoteByTitle}
              />
            ) : (
              <p className="text-xs text-[#737373] italic">
                Belum ada konten untuk ditampilkan. Beralih ke mode "Edit" untuk mulai menulis.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action Dock Bar */}
      <div className="shrink-0 bg-[#131313]/95 backdrop-blur-md border-t border-[#2A2A2A] px-4 py-2.5 flex items-center justify-between max-w-lg mx-auto w-full z-20">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#222222] hover:bg-[#2C2C2C] border border-[#303030] text-[#E5E5E5] text-xs font-medium rounded-xl transition-all cursor-pointer active:scale-95"
        >
          <X className="w-4 h-4 text-[#A3A3A3]" />
          <span>Batal</span>
        </button>

        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-5 py-2 bg-[#E5E5E5] hover:bg-white text-[#111111] text-xs font-semibold rounded-xl shadow-lg transition-all cursor-pointer active:scale-95"
        >
          <Save className="w-4 h-4" />
          <span>Simpan Catatan</span>
        </button>
      </div>
    </div>
  );
};
