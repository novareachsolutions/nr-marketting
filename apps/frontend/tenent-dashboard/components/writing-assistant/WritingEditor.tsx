import {
  useRef,
  useCallback,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  Bold,
  Italic,
  Pilcrow,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link,
  Undo,
  Redo,
} from 'lucide-react';
import styles from './WritingEditor.module.css';

interface WritingEditorProps {
  htmlContent: string;
  onContentChange: (html: string, plainText: string) => void;
  title: string;
  onTitleChange: (title: string) => void;
  metaDescription: string;
  onMetaDescriptionChange: (desc: string) => void;
  wordCount: number;
  onTextSelect: (text: string) => void;
}

export interface WritingEditorHandle {
  insertHtml: (html: string) => void;
  appendHtml: (html: string) => void;
  replaceSelection: (text: string) => void;
  focus: () => void;
}

interface ActiveFormats {
  bold: boolean;
  italic: boolean;
  p: boolean;
  h1: boolean;
  h2: boolean;
  h3: boolean;
  ul: boolean;
  ol: boolean;
}

const EMPTY_FORMATS: ActiveFormats = {
  bold: false,
  italic: false,
  p: false,
  h1: false,
  h2: false,
  h3: false,
  ul: false,
  ol: false,
};

function ToolbarButton({
  onClick,
  icon,
  title,
  active,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      style={{
        background: active ? 'var(--bg-hover, rgba(34,197,94,0.12))' : 'none',
        border: 'none',
        padding: '4px 6px',
        cursor: 'pointer',
        color: active ? 'var(--accent-primary, #22c55e)' : 'var(--text-secondary)',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        transition: 'background 0.12s, color 0.12s',
      }}
    >
      {icon}
    </button>
  );
}

export const WritingEditor = forwardRef<WritingEditorHandle, WritingEditorProps>(
  function WritingEditor(
    {
      htmlContent,
      onContentChange,
      title,
      onTitleChange,
      metaDescription,
      onMetaDescriptionChange,
      wordCount,
      onTextSelect,
    },
    ref,
  ) {
    const editorRef = useRef<HTMLDivElement>(null);
    const savedRangeRef = useRef<Range | null>(null);
    const [activeFormats, setActiveFormats] = useState<ActiveFormats>(EMPTY_FORMATS);

    const syncContent = useCallback(() => {
      if (editorRef.current) {
        const html = editorRef.current.innerHTML;
        const text = editorRef.current.innerText || '';
        onContentChange(html, text);
      }
    }, [onContentChange]);

    const updateActiveFormats = useCallback(() => {
      if (!editorRef.current) return;
      const selection = window.getSelection();
      if (
        !selection ||
        selection.rangeCount === 0 ||
        !editorRef.current.contains(selection.anchorNode)
      ) {
        return;
      }
      try {
        const formatBlock = (document.queryCommandValue('formatBlock') || '')
          .toLowerCase()
          .replace(/[<>]/g, '');
        setActiveFormats({
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          p: formatBlock === 'p' || formatBlock === '' || formatBlock === 'div',
          h1: formatBlock === 'h1',
          h2: formatBlock === 'h2',
          h3: formatBlock === 'h3',
          ul: document.queryCommandState('insertUnorderedList'),
          ol: document.queryCommandState('insertOrderedList'),
        });
      } catch {
        // queryCommand can throw in some edge cases; ignore.
      }
    }, []);

    // Keep DOM in sync with external htmlContent changes (doc load, imperative inserts)
    // without overwriting during user typing (which would reset the cursor).
    useEffect(() => {
      if (!editorRef.current) return;
      if (editorRef.current.innerHTML !== htmlContent) {
        editorRef.current.innerHTML = htmlContent;
      }
    }, [htmlContent]);

    // Ensure an initial <p> block exists so formatBlock has something to transform.
    useEffect(() => {
      try {
        document.execCommand('defaultParagraphSeparator', false, 'p');
      } catch {}
      if (editorRef.current && !editorRef.current.innerHTML.trim()) {
        editorRef.current.innerHTML = '<p><br></p>';
      }
    }, []);

    // Track active formats based on the global selectionchange event so the toolbar
    // stays accurate even when the caret moves via arrow keys or clicks.
    useEffect(() => {
      const handler = () => updateActiveFormats();
      document.addEventListener('selectionchange', handler);
      return () => document.removeEventListener('selectionchange', handler);
    }, [updateActiveFormats]);

    const ensureBlockWrapping = useCallback(() => {
      const el = editorRef.current;
      if (!el) return;
      // If the editor has bare text nodes as direct children (no block element),
      // wrap everything into a <p> so formatBlock and list commands can operate.
      const hasDirectTextNode = Array.from(el.childNodes).some(
        (n) =>
          n.nodeType === Node.TEXT_NODE &&
          (n.textContent?.trim().length ?? 0) > 0,
      );
      const hasBlockChild = Array.from(el.children).some((c) =>
        ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'DIV'].includes(
          c.tagName,
        ),
      );
      if (hasDirectTextNode && !hasBlockChild) {
        el.innerHTML = `<p>${el.innerHTML}</p>`;
        // Place caret at end of the new <p>
        const p = el.firstElementChild;
        if (p) {
          const range = document.createRange();
          range.selectNodeContents(p);
          range.collapse(false);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      } else if (!el.innerHTML.trim()) {
        el.innerHTML = '<p><br></p>';
        const p = el.firstElementChild;
        if (p) {
          const range = document.createRange();
          range.selectNodeContents(p);
          range.collapse(false);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }
    }, []);

    const exec = useCallback(
      (command: string, value?: string) => {
        editorRef.current?.focus();
        ensureBlockWrapping();
        try {
          document.execCommand(command, false, value);
        } catch {}
        syncContent();
        updateActiveFormats();
      },
      [syncContent, updateActiveFormats, ensureBlockWrapping],
    );

    const handleFormatBlock = useCallback(
      (tag: 'h1' | 'h2' | 'h3' | 'p') => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();
        ensureBlockWrapping();
        // Toggle: if already this tag, revert to <p>
        const current = (document.queryCommandValue('formatBlock') || '')
          .toLowerCase()
          .replace(/[<>]/g, '');
        const target = current === tag ? 'p' : tag;
        try {
          // Chrome accepts both "h1" and "<h1>"; use bracketed for Firefox compatibility.
          document.execCommand('formatBlock', false, `<${target}>`);
        } catch {}
        syncContent();
        updateActiveFormats();
      },
      [syncContent, updateActiveFormats, ensureBlockWrapping],
    );

    const handleSelect = useCallback(() => {
      const selection = window.getSelection();
      if (
        selection &&
        selection.rangeCount > 0 &&
        editorRef.current &&
        editorRef.current.contains(selection.anchorNode)
      ) {
        const range = selection.getRangeAt(0);
        if (!range.collapsed) {
          savedRangeRef.current = range.cloneRange();
        }
      }
      const text = selection?.toString()?.trim() || '';
      onTextSelect(text);
      updateActiveFormats();
    }, [onTextSelect, updateActiveFormats]);

    const restoreSelection = useCallback(() => {
      const range = savedRangeRef.current;
      if (!range || !editorRef.current) return false;
      editorRef.current.focus();
      const selection = window.getSelection();
      if (!selection) return false;
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => editorRef.current?.focus(),
        insertHtml: (html: string) => {
          if (!editorRef.current) return;
          editorRef.current.focus();
          if (!restoreSelection()) {
            const range = document.createRange();
            range.selectNodeContents(editorRef.current);
            range.collapse(false);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
          }
          document.execCommand('insertHTML', false, html);
          savedRangeRef.current = null;
          syncContent();
          updateActiveFormats();
        },
        appendHtml: (html: string) => {
          if (!editorRef.current) return;
          editorRef.current.focus();
          const range = document.createRange();
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
          document.execCommand('insertHTML', false, html);
          syncContent();
          updateActiveFormats();
        },
        replaceSelection: (text: string) => {
          if (!editorRef.current) return;
          if (!restoreSelection()) {
            const range = document.createRange();
            range.selectNodeContents(editorRef.current);
            range.collapse(false);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
            document.execCommand('insertHTML', false, `<p>${text}</p>`);
          } else {
            document.execCommand('insertText', false, text);
          }
          savedRangeRef.current = null;
          syncContent();
          updateActiveFormats();
        },
      }),
      [restoreSelection, syncContent, updateActiveFormats],
    );

    const handleInsertLink = () => {
      const url = prompt('Enter URL:');
      if (url) exec('createLink', url);
    };

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          border: '1px solid var(--border-primary)',
          borderRadius: 10,
          background: 'var(--bg-card)',
          overflow: 'hidden',
        }}
      >
        {/* Title */}
        <input
          type="text"
          placeholder="Document title..."
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          style={{
            padding: '14px 16px 8px',
            border: 'none',
            background: 'transparent',
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />

        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            gap: 2,
            padding: '4px 12px',
            borderBottom: '1px solid var(--border-primary)',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <ToolbarButton
            onClick={() => exec('bold')}
            icon={<Bold size={15} />}
            title="Bold"
            active={activeFormats.bold}
          />
          <ToolbarButton
            onClick={() => exec('italic')}
            icon={<Italic size={15} />}
            title="Italic"
            active={activeFormats.italic}
          />
          <div style={{ width: 1, height: 18, background: 'var(--border-primary)', margin: '0 4px' }} />
          <ToolbarButton
            onClick={() => handleFormatBlock('p')}
            icon={<Pilcrow size={15} />}
            title="Normal text"
            active={activeFormats.p}
          />
          <ToolbarButton
            onClick={() => handleFormatBlock('h1')}
            icon={<Heading1 size={15} />}
            title="Heading 1"
            active={activeFormats.h1}
          />
          <ToolbarButton
            onClick={() => handleFormatBlock('h2')}
            icon={<Heading2 size={15} />}
            title="Heading 2"
            active={activeFormats.h2}
          />
          <ToolbarButton
            onClick={() => handleFormatBlock('h3')}
            icon={<Heading3 size={15} />}
            title="Heading 3"
            active={activeFormats.h3}
          />
          <div style={{ width: 1, height: 18, background: 'var(--border-primary)', margin: '0 4px' }} />
          <ToolbarButton
            onClick={() => exec('insertUnorderedList')}
            icon={<List size={15} />}
            title="Bullet List"
            active={activeFormats.ul}
          />
          <ToolbarButton
            onClick={() => exec('insertOrderedList')}
            icon={<ListOrdered size={15} />}
            title="Numbered List"
            active={activeFormats.ol}
          />
          <ToolbarButton onClick={handleInsertLink} icon={<Link size={15} />} title="Insert Link" />
          <div style={{ width: 1, height: 18, background: 'var(--border-primary)', margin: '0 4px' }} />
          <ToolbarButton onClick={() => exec('undo')} icon={<Undo size={15} />} title="Undo" />
          <ToolbarButton onClick={() => exec('redo')} icon={<Redo size={15} />} title="Redo" />
        </div>

        {/* Editor */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => {
            syncContent();
            updateActiveFormats();
          }}
          onMouseUp={handleSelect}
          onKeyUp={handleSelect}
          onFocus={updateActiveFormats}
          data-placeholder="Start writing your content..."
          className={styles.editor}
        />

        {/* Meta Description */}
        <div style={{ borderTop: '1px solid var(--border-primary)', padding: '10px 16px' }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Meta Description ({metaDescription.length}/160)
          </label>
          <textarea
            placeholder="Write a meta description for this content..."
            value={metaDescription}
            onChange={(e) => onMetaDescriptionChange(e.target.value)}
            rows={2}
            style={{
              width: '100%',
              marginTop: 4,
              padding: '6px 0',
              border: 'none',
              background: 'transparent',
              fontSize: 13,
              color: 'var(--text-secondary)',
              outline: 'none',
              resize: 'none',
            }}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid var(--border-primary)',
            padding: '8px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: 'var(--text-tertiary)',
          }}
        >
          <span>{wordCount} words</span>
          <span>{Math.ceil(wordCount / 200)} min read</span>
        </div>
      </div>
    );
  },
);
