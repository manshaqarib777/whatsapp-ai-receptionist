'use client';

import type { JSONContent } from '@tiptap/core';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import { Uploader } from '@/components/uploader';
import { Card, CardContent } from '@/components/ui/card';
import { Section } from '@/features/design-system/components/section';

/**
 * Rich text and uploads.
 *
 * Tiptap is loaded on demand: it is the heaviest dependency in the system and most
 * screens never show an editor, so it must not sit in the shared bundle (Milestone 3
 * risk 6). The editor is client-only anyway, so there is nothing to server-render.
 */
const RichTextEditor = dynamic(
  () => import('@/components/rich-text').then((module) => module.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading editor"
        className="bg-muted/30 h-[15.5rem] w-full rounded-xl border"
      />
    ),
  },
);

const INITIAL_DOCUMENT: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Thanks for getting in touch. We are open ' },
        { type: 'text', marks: [{ type: 'bold' }], text: 'Mon–Fri, 9am–5pm' },
        { type: 'text', text: '.' },
      ],
    },
  ],
};

export function ContentSection() {
  const [document, setDocument] = useState<JSONContent>(INITIAL_DOCUMENT);

  return (
    <>
      <Section
        id="rich-text"
        title="Rich text"
        description="The editor schema is the allow-list: anything it does not describe is dropped, not escaped."
      >
        <RichTextEditor label="Canned reply" value={document} onChange={setDocument} />
      </Section>

      <Section
        id="uploader"
        title="Uploader"
        description="Drag and drop, preview, progress, and client-side validation — which is UX, not a security control."
      >
        <Uploader accept="image/*,.pdf" maxSizeBytes={5 * 1024 * 1024} maxFiles={3} />

        <Card>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Nothing is stored yet. The upload port is a stub until the milestone that
              provisions storage, and the server must re-validate type and size before
              trusting anything a browser sends.
            </p>
          </CardContent>
        </Card>
      </Section>
    </>
  );
}
