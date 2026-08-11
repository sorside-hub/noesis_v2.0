import { useState, useEffect, useCallback, RefObject } from 'react';
import { getNotes } from '../services/noteService';
import { NoteItem } from '../pages/VaultPage';
import { getCaretCoordinates } from '../../../shared/utils/caretCoordinates';

export interface AutocompletePopupPosition {
  top: number;
  left: number;
  height: number;
  placement: 'below' | 'above';
}

interface UseWikilinkAutocompleteParams {
  textareaRef: RefObject<HTMLTextAreaElement>;
  content: string;
  onContentChange: (newContent: string) => void;
  allNotes?: NoteItem[];
}

export function useWikilinkAutocomplete({
  textareaRef,
  content,
  onContentChange,
  allNotes: providedNotes,
}: UseWikilinkAutocompleteParams) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [matchStart, setMatchStart] = useState<number>(-1);
  const [matchEnd, setMatchEnd] = useState<number>(-1);
  const [notesList, setNotesList] = useState<NoteItem[]>(providedNotes || []);
  const [position, setPosition] = useState<AutocompletePopupPosition>({
    top: 0,
    left: 0,
    height: 20,
    placement: 'below',
  });

  // Fetch or update available notes from IndexedDB
  useEffect(() => {
    if (providedNotes && providedNotes.length > 0) {
      setNotesList(providedNotes);
    } else {
      getNotes()
        .then((fetched) => {
          setNotesList(fetched || []);
        })
        .catch((err) => {
          console.error('Error fetching notes for wikilink autocomplete:', err);
        });
    }
  }, [providedNotes]);

  // Check caret position and detect `[[`
  const checkAutocompleteTrigger = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setIsOpen(false);
      return;
    }

    const caretPos = textarea.selectionStart;
    // Don't trigger if user has selected a range of text
    if (textarea.selectionEnd !== caretPos) {
      setIsOpen(false);
      return;
    }

    const textBeforeCaret = content.slice(0, caretPos);
    const lastOpen = textBeforeCaret.lastIndexOf('[[');

    if (lastOpen === -1) {
      setIsOpen(false);
      return;
    }

    const textAfterOpen = textBeforeCaret.slice(lastOpen + 2);

    // If there is a newline or ']]' between '[[' and caret, autocomplete is NOT active
    if (textAfterOpen.includes(']]') || textAfterOpen.includes('\n')) {
      setIsOpen(false);
      return;
    }

    const rawQuery = textAfterOpen;
    setQuery(rawQuery);
    setMatchStart(lastOpen);
    setMatchEnd(caretPos);

    // Filter available note titles
    const normalizedQuery = rawQuery.trim().toLowerCase();
    const availableTitles = Array.from(
      new Set(
        notesList
          .map((n) => n.title?.trim())
          .filter((t): t is string => Boolean(t && t.length > 0))
      )
    );

    let filtered = availableTitles.filter((t) =>
      t.toLowerCase().includes(normalizedQuery)
    );

    // Sort: titles starting with normalizedQuery come first
    filtered.sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(normalizedQuery);
      const bStarts = b.toLowerCase().startsWith(normalizedQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.localeCompare(b);
    });

    // Limit to max 5 suggestions
    filtered = filtered.slice(0, 5);

    if (filtered.length > 0) {
      setSuggestions(filtered);
      setSelectedIndex(0);

      // Calculate caret position for dynamic popup placement
      try {
        const coords = getCaretCoordinates(textarea, caretPos);
        const textareaRect = textarea.getBoundingClientRect();
        const container = textarea.parentElement;
        const containerRect = container ? container.getBoundingClientRect() : textareaRect;

        // Coordinates relative to parent container
        const relativeLeft = textareaRect.left - containerRect.left + coords.left - textarea.scrollLeft;
        const relativeTop = textareaRect.top - containerRect.top + coords.top - textarea.scrollTop;

        // Check viewport collision for vertical placement
        const caretViewportY = textareaRect.top + coords.top - textarea.scrollTop;
        const estimatedPopupHeight = 210;
        const viewportHeight = window.innerHeight;

        let placement: 'below' | 'above' = 'below';
        if (caretViewportY + coords.height + estimatedPopupHeight > viewportHeight - 16) {
          if (caretViewportY - estimatedPopupHeight > 16) {
            placement = 'above';
          }
        }

        // Horizontal boundary constraint
        const containerWidth = containerRect.width || 320;
        const popupWidth = Math.min(288, containerWidth - 16);
        let clampedLeft = Math.max(8, relativeLeft);
        if (clampedLeft + popupWidth > containerWidth - 8) {
          clampedLeft = Math.max(8, containerWidth - popupWidth - 8);
        }

        setPosition({
          top: relativeTop,
          left: clampedLeft,
          height: coords.height || 20,
          placement,
        });
      } catch (err) {
        console.error('Error calculating caret coordinates for wikilink popup:', err);
      }

      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [content, notesList, textareaRef]);

  // Trigger check on content change
  useEffect(() => {
    checkAutocompleteTrigger();
  }, [content, checkAutocompleteTrigger]);

  // Apply chosen suggestion
  const selectSuggestion = useCallback(
    (selectedTitle: string) => {
      const textarea = textareaRef.current;
      if (matchStart === -1) return;

      const before = content.slice(0, matchStart);
      const after = content.slice(matchEnd);
      const replacement = `[[${selectedTitle}]]`;
      const newContent = before + replacement + after;

      onContentChange(newContent);
      setIsOpen(false);

      const newCaretPos = matchStart + replacement.length;
      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(newCaretPos, newCaretPos);
        }
      }, 0);
    },
    [content, matchStart, matchEnd, onContentChange, textareaRef]
  );

  // Handle keydown navigation (Enter, Tab, ArrowUp, ArrowDown, Escape)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!isOpen || suggestions.length === 0) return false;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        return true;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return true;
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = suggestions[selectedIndex];
        if (selected) {
          selectSuggestion(selected);
        }
        return true;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        return true;
      }

      return false;
    },
    [isOpen, suggestions, selectedIndex, selectSuggestion]
  );

  return {
    isOpen,
    query,
    suggestions,
    selectedIndex,
    position,
    setSelectedIndex,
    selectSuggestion,
    handleKeyDown,
    checkAutocompleteTrigger,
    closeAutocomplete: () => setIsOpen(false),
  };
}
