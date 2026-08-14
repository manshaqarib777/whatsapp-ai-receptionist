'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { useKnowledgeSearch } from '@/features/knowledge/hooks/use-knowledge';

/**
 * Knowledge search (AD-6).
 *
 * Retrieval over approved current-version chunks only — a draft or pending
 * version can never surface here. Debounced on submit (not per keystroke, so
 * the server isn't hammered).
 */

export function KnowledgeSearch() {
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');
  const { data, isPending, isError, refetch } = useKnowledgeSearch(
    submitted,
    submitted.length > 0,
  );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(q.trim());
  }

  const hits = data?.hits ?? [];

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="flex gap-2">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="text-muted-foreground absolute start-3 top-1/2 size-4 -translate-y-1/2"
          />
          <Input
            aria-label="Search the knowledge base"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search approved documents, FAQs, and websites"
            className="ps-9"
          />
        </div>
      </form>

      {submitted.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Search the knowledge base"
          description="Type a query to find approved content the AI can cite."
        />
      ) : isPending && !data ? (
        <LoadingState rows={4} label="Searching the knowledge base" />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : hits.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches"
          description="Nothing in the approved knowledge base matched that query."
        />
      ) : (
        <ul className="divide-border divide-y rounded-2xl border">
          {hits.map((hit) => (
            <li key={hit.chunkId} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{hit.documentTitle}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary">{hit.sourceName}</Badge>
                  {hit.similarity > 0 ? (
                    <span className="text-muted-foreground text-xs">
                      {(hit.similarity * 100).toFixed(0)}%
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="text-muted-foreground mt-1 line-clamp-3 text-sm">
                {hit.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
