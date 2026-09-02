'use client';

import type { Editor } from '@tiptap/react';
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';

/**
 * Formatting toolbar for the rich text editor.
 *
 * Marks and blocks are declarative configs; the toolbar renders them against
 * the live editor instance. The link command validates through the schema's
 * `isAllowedUri` — an unsafe URL never becomes a link.
 */

type ToolbarProps = {
  editor: Editor;
  label: string;
};

export function RichTextToolbar({ editor, label }: ToolbarProps) {
  const marks = [
    {
      name: 'bold',
      icon: Bold,
      label: 'Bold',
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      name: 'italic',
      icon: Italic,
      label: 'Italic',
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      name: 'strike',
      icon: Strikethrough,
      label: 'Strikethrough',
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      name: 'code',
      icon: Code,
      label: 'Inline code',
      run: () => editor.chain().focus().toggleCode().run(),
    },
  ] as const;

  const blocks = [
    {
      name: 'heading-2',
      icon: Heading2,
      label: 'Heading',
      isActive: editor.isActive('heading', { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      name: 'heading-3',
      icon: Heading3,
      label: 'Subheading',
      isActive: editor.isActive('heading', { level: 3 }),
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      name: 'bulletList',
      icon: List,
      label: 'Bulleted list',
      isActive: editor.isActive('bulletList'),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      name: 'orderedList',
      icon: ListOrdered,
      label: 'Numbered list',
      isActive: editor.isActive('orderedList'),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      name: 'blockquote',
      icon: Quote,
      label: 'Quote',
      isActive: editor.isActive('blockquote'),
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
  ];

  function promptForLink() {
    const current = editor.getAttributes('link')['href'] as string | undefined;
    const input = window.prompt('Link URL', current ?? 'https://');

    // Cancelled — leave the document untouched.
    if (input === null) return;

    if (input.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    // A rejected protocol is dropped by `isAllowedUri`, so an unsafe URL simply
    // never becomes a link.
    editor.chain().focus().extendMarkRange('link').setLink({ href: input.trim() }).run();
  }

  return (
    <div
      role="toolbar"
      aria-label={`${label} formatting`}
      aria-orientation="horizontal"
      className="bg-muted/40 flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1"
    >
      {marks.map((mark) => (
        <Toggle
          key={mark.name}
          size="sm"
          pressed={editor.isActive(mark.name)}
          onPressedChange={mark.run}
          aria-label={mark.label}
        >
          <mark.icon aria-hidden="true" className="size-4" />
        </Toggle>
      ))}

      <Separator orientation="vertical" className="mx-1 h-5" />

      {blocks.map((block) => (
        <Toggle
          key={block.name}
          size="sm"
          pressed={block.isActive}
          onPressedChange={block.run}
          aria-label={block.label}
        >
          <block.icon aria-hidden="true" className="size-4" />
        </Toggle>
      ))}

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Toggle
        size="sm"
        pressed={editor.isActive('link')}
        onPressedChange={promptForLink}
        aria-label="Link"
      >
        <Link2 aria-hidden="true" className="size-4" />
      </Toggle>

      <div className="ms-auto flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Undo"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 aria-hidden="true" className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Redo"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </div>
  );
}
