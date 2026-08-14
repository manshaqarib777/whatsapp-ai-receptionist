'use client';

import { BookOpen, Globe, HelpCircle, FileText, Upload } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { useSources } from '@/features/knowledge/hooks/use-knowledge';
import type { KnowledgeSourceRow } from '@/features/knowledge/repositories/knowledge.repository';

/**
 * The knowledge sources list (AD-1).
 *
 * Each source links to its documents. Loading/error/empty handled per the four
 * states rule.
 */

const KIND_META: Record<string, { label: string; icon: typeof FileText }> = {
  upload: { label: 'Upload', icon: Upload },
  pdf: { label: 'PDF', icon: FileText },
  docx: { label: 'DOCX', icon: FileText },
  csv: { label: 'CSV', icon: FileText },
  website: { label: 'Website', icon: Globe },
  faq: { label: 'FAQ', icon: HelpCircle },
};

export function SourceList() {
  const { data, isPending, isError, refetch } = useSources();
  const sources = data?.sources ?? [];

  if (isPending && !data) {
    return <LoadingState rows={6} label="Loading sources" />;
  }

  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  if (sources.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No sources yet"
        description="Upload a document, add an FAQ, or ingest a website to start building your knowledge base."
      />
    );
  }

  return (
    <ul className="divide-border divide-y rounded-2xl border">
      {sources.map((source) => (
        <SourceRow key={source.id} source={source} />
      ))}
    </ul>
  );
}

function SourceRow({ source }: { source: KnowledgeSourceRow }) {
  const meta =
    KIND_META[source.kind] ??
    ({ label: 'Upload', icon: Upload } satisfies {
      label: string;
      icon: typeof FileText;
    });
  const Icon = meta.icon;

  return (
    <li>
      <Link
        href={`/knowledge/sources/${source.id}`}
        className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3 transition-colors"
      >
        <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-xl">
          <Icon aria-hidden="true" className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{source.name}</p>
          <p className="text-muted-foreground truncate text-sm">
            {source.documentCount} document{source.documentCount === 1 ? '' : 's'}
          </p>
        </div>
        <Badge variant="secondary">{meta.label}</Badge>
      </Link>
    </li>
  );
}

export { KIND_META };
