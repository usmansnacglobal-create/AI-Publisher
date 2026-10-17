'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor as TiptapEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { clsx } from 'clsx';
import {
  Bold, Heading1, Heading2, Heading3, Italic, Link2, List, ListOrdered, Minus, Pilcrow, Quote, Redo2, Underline, Undo2,
} from 'lucide-react';
import { locate } from '@/lib/apply';

export interface ManuscriptEditorHandle {
  /** The selected text, or '' if nothing is selected. */
  selectionText: () => string;
  /** Selects and scrolls to a passage. */
  reveal: (text: string) => boolean;
  focus: () => void;
}

interface Props {
  value: string;
  onChange: (markdown: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  /** Rendered next to the selection when text is selected. */
  selectionMenu?: (args: { text: string; close: () => void }) => React.ReactNode;
}

function getMarkdown(editor: TiptapEditor): string {
  const storage = editor.storage as unknown as { markdown: { getMarkdown: () => string } };
  return storage.markdown.getMarkdown();
}

/** Maps plain document text back to editor positions so passages can be found and selected. */
function findInDoc(editor: TiptapEditor, needle: string) {
  let text = '';
  const map: number[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) map.push(pos + i);
      text += node.text;
    } else if (node.isBlock && text.length && !text.endsWith('\n')) {
      text += '\n';
      map.push(pos);
    }
    return true;
  });
  const r = locate(text, needle);
  if (!r) return null;
  return { from: map[r[0]], to: map[r[1] - 1] + 1 };
}

export const ManuscriptEditor = forwardRef<ManuscriptEditorHandle, Props>(function ManuscriptEditor(
  { value, onChange, readOnly, placeholder, selectionMenu },
  ref,
) {
  const lastEmitted = useRef(value);
  const wrap = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ text: string; top: number; left: number } | null>(null);
  const [, force] = useState(0);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer nofollow' } },
        code: false,
        codeBlock: false,
      }),
      Markdown.configure({ html: true, tightLists: true, breaks: false, transformPastedText: true, transformCopiedText: false }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'manuscript-prose outline-none',
        'aria-label': 'Chapter text',
        role: 'textbox',
        'aria-multiline': 'true',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor }) => {
      const md = getMarkdown(editor);
      lastEmitted.current = md;
      onChange(md);
    },
    onSelectionUpdate: ({ editor }) => {
      force((n) => n + 1);
      const { from, to, empty } = editor.state.selection;
      if (empty || !selectionMenu || !wrap.current) return setMenu(null);
      const text = editor.state.doc.textBetween(from, to, '\n\n').trim();
      if (text.length < 3) return setMenu(null);
      const end = editor.view.coordsAtPos(to);
      const box = wrap.current.getBoundingClientRect();
      setMenu({ text, top: end.bottom - box.top + 8, left: Math.min(Math.max(0, end.left - box.left - 160), box.width - 330) });
    },
  });

  // Replace the document when the text changes from outside (AI writing, accepted suggestions, restores).
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    lastEmitted.current = value;
    const { from, to } = editor.state.selection;
    editor.commands.setContent(value, { emitUpdate: false });
    const size = editor.state.doc.content.size;
    editor.commands.setTextSelection({ from: Math.min(from, size), to: Math.min(to, size) });
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [readOnly, editor]);

  // Close the selection menu on Escape or a click anywhere outside the editor and the menu.
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || editor?.view.dom.contains(t)) return;
      setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu, editor]);

  useImperativeHandle(ref, () => ({
    selectionText: () => {
      if (!editor) return '';
      const { from, to, empty } = editor.state.selection;
      return empty ? '' : editor.state.doc.textBetween(from, to, '\n\n');
    },
    reveal: (text: string) => {
      if (!editor) return false;
      const r = findInDoc(editor, text);
      if (!r) return false;
      editor.chain().focus().setTextSelection(r).scrollIntoView().run();
      return true;
    },
    focus: () => editor?.commands.focus(),
  }));

  function setLink() {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = prompt('Link address (leave empty to remove the link)', prev ?? 'https://');
    if (url === null) return;
    if (!url.trim() || url === 'https://') editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  }

  const tools: { label: string; icon: typeof Bold; run: () => void; active?: boolean; key?: string }[] = editor
    ? [
        { label: 'Bold', icon: Bold, run: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), key: 'Ctrl+B' },
        { label: 'Italic', icon: Italic, run: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), key: 'Ctrl+I' },
        { label: 'Underline', icon: Underline, run: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive('underline'), key: 'Ctrl+U' },
        { label: 'Heading 1', icon: Heading1, run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }) },
        { label: 'Heading 2', icon: Heading2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
        { label: 'Heading 3', icon: Heading3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }) },
        { label: 'Normal paragraph', icon: Pilcrow, run: () => editor.chain().focus().setParagraph().run(), active: editor.isActive('paragraph') },
        { label: 'Bulleted list', icon: List, run: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
        { label: 'Numbered list', icon: ListOrdered, run: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
        { label: 'Block quote', icon: Quote, run: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote') },
        { label: 'Insert link', icon: Link2, run: setLink, active: editor.isActive('link') },
        { label: 'Scene break', icon: Minus, run: () => editor.chain().focus().setHorizontalRule().run() },
        { label: 'Undo', icon: Undo2, run: () => editor.chain().focus().undo().run(), key: 'Ctrl+Z' },
        { label: 'Redo', icon: Redo2, run: () => editor.chain().focus().redo().run(), key: 'Ctrl+Shift+Z' },
      ]
    : [];

  return (
    <div ref={wrap} className="relative">
      <div className="sticky top-0 z-10 -mx-2 mb-4 flex flex-wrap gap-0.5 rounded-md border border-line bg-sheet/95 p-1 backdrop-blur sm:top-2" role="toolbar" aria-label="Formatting">
        {tools.map((t, i) => (
          <span key={t.label} className="contents">
            {(i === 3 || i === 7 || i === 10 || i === 12) && <span className="mx-1 w-px self-stretch bg-line" aria-hidden />}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={t.run}
              disabled={readOnly}
              aria-pressed={t.active}
              aria-label={t.label}
              title={t.key ? `${t.label} (${t.key})` : t.label}
              className={clsx('grid h-8 w-8 place-items-center rounded text-ink-soft hover:bg-ink/5 disabled:opacity-40', t.active && 'bg-cloth-light text-cloth-dark')}
            >
              <t.icon className="h-4 w-4" />
            </button>
          </span>
        ))}
      </div>
      {editor && editor.isEmpty && placeholder && (
        <p className="pointer-events-none absolute left-0 top-[3.6rem] font-serif text-[19px] text-ink-faint">{placeholder}</p>
      )}
      <EditorContent editor={editor} className={clsx('manuscript min-h-[30vh]', readOnly && 'opacity-90')} />
      {menu && selectionMenu && !readOnly && (
        <div ref={menuRef} className="absolute z-20 w-[320px]" style={{ top: menu.top, left: menu.left }}>
          {selectionMenu({ text: menu.text, close: () => setMenu(null) })}
        </div>
      )}
    </div>
  );
});
