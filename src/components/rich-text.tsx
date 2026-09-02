'use client';

import {
  generateHTML,
  getSchema,
  rewriteUnknownContent,
  type JSONContent,
} from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useMemo } from 'react';

import { cn } from '@/lib/utils';

import { RichTextToolbar } from './rich-text-toolbar';

/**
 * Rich text editor.
 *
 * **The schema is the security boundary.** Tiptap parses everything — typed, pasted,
 * or loaded from the database — through the extension list below, and anything the
 * schema does not describe is dropped rather than escaped. So there is no path by
 * which a `<script>`, an `onerror=`, or an `<iframe>` reaches the document, and no
 * call to `dangerouslySetInnerHTML` with unfiltered input anywhere in the flow.
 *
 * Storage is the ProseMirror JSON document, not an HTML string. HTML is generated
 * on render from that same schema (`richTextToHtml`), which means a value written by
 * an older, laxer schema is re-filtered by today's rules on the way out. Storing HTML
 * would freeze whatever was allowed on the day it was saved.
 *
 * Link URLs are checked separately: the schema permits an `href`, but `javascript:`
 * and `data:` URLs are not links, they are script injection wearing a link's clothes.
 *
 * **Known limitation (Milestone 3):** presentational only. Nothing here persists —
 * the storage adapter lands with the milestone that needs it. Client-side filtering
 * is not a server-side control: whatever eventually accepts this content must run
 * the same schema server-side before trusting it.
 */

const ALLOWED_PROTOCOLS = ['http', 'https', 'mailto'] as const;

export const richTextExtensions = [
  StarterKit.configure({
    // Nothing in this product needs a headline bigger than a section heading, and
    // an <h1> inside body content breaks the page's document outline.
    heading: { levels: [2, 3] },
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
      protocols: [...ALLOWED_PROTOCOLS],
      // Links leaving the app must not hand the opener a window reference.
      HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      isAllowedUri: (url, { defaultValidate }) => {
        const protocol = url.includes(':') ? url.split(':')[0]?.toLowerCase() : undefined;

        // A relative URL (no protocol) is fine. An explicit protocol must be one we
        // allow — `javascript:` and `data:` are rejected outright rather than
        // relying on the default validator's broader notion of a valid URI.
        if (
          protocol &&
          !ALLOWED_PROTOCOLS.includes(protocol as (typeof ALLOWED_PROTOCOLS)[number])
        ) {
          return false;
        }

        return defaultValidate(url);
      },
    },
  }),
];

/**
 * Renders a stored document to HTML through the same schema that produced it.
 *
 * Unknown nodes are rewritten before rendering rather than passed through:
 * `generateHTML` *throws* on a node the schema does not know, so a document saved
 * under an older, laxer schema — or a hand-crafted one — would otherwise take down
 * the page rendering it. Rewriting keeps the text and discards the structure, which
 * is the same trade the schema makes everywhere else.
 */
export function richTextToHtml(document: JSONContent): string {
  // `rewriteUnknownContent` mutates what it is given, so it gets a copy — otherwise
  // rendering would quietly edit the caller's React state.
  const { json } = rewriteUnknownContent(
    JSON.parse(JSON.stringify(document)) as JSONContent,
    getSchema(richTextExtensions),
  );

  return generateHTML(json ?? { type: 'doc', content: [] }, richTextExtensions);
}

/** Shared prose styling, so the editor and the read-only view cannot drift apart. */
const PROSE =
  'text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-s-2 [&_blockquote]:ps-4 [&_blockquote]:text-muted-foreground [&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:ps-5';

type RichTextEditorProps = {
  /** ProseMirror JSON. Undefined starts empty. */
  value?: JSONContent;
  onChange?: (document: JSONContent) => void;
  placeholder?: string;
  label: string;
  disabled?: boolean;
  className?: string;
};

export function RichTextEditor({
  value,
  onChange,
  label,
  disabled = false,
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: richTextExtensions,
    content: value ?? '',
    editable: !disabled,
    // Rendering on the server produces markup React then disagrees with. Tiptap is
    // client-only by nature; say so rather than fighting a hydration mismatch.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
        class: cn(
          PROSE,
          'min-h-40 w-full px-3 py-2 outline-none focus-visible:outline-none',
        ),
      },
    },
    onUpdate: ({ editor: instance }) => onChange?.(instance.getJSON()),
  });

  if (!editor) {
    // Matches the mounted height so the surrounding layout does not jump.
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={`Loading ${label}`}
        className={cn('bg-muted/30 h-[15.5rem] w-full rounded-xl border', className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'focus-within:border-ring focus-within:ring-ring/50 overflow-hidden rounded-xl border transition-colors focus-within:ring-3',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      <RichTextToolbar editor={editor} label={label} />

      <EditorContent editor={editor} />
    </div>
  );
}

/**
 * Read-only rendering of a stored document.
 *
 * `dangerouslySetInnerHTML` is safe **only** because the HTML is generated here from
 * the schema above, never taken from user input as a string. Do not change this to
 * accept an HTML prop.
 */
export function RichTextContent({
  document,
  className,
}: {
  document: JSONContent;
  className?: string;
}) {
  const html = useMemo(() => richTextToHtml(document), [document]);

  return (
    <div className={cn(PROSE, className)} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
