import type { Metadata } from 'next';

import { GalleryShell } from '@/features/design-system/components/gallery-shell';

export const metadata: Metadata = { title: 'Design System' };

/**
 * Component gallery.
 *
 * Every component in every state, so "test visually" (PRD, Milestone 3) is something
 * a person can actually do — in both themes and both directions.
 */
export default function DesignPage() {
  return <GalleryShell />;
}
