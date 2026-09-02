'use client';

import { useTemplates } from '@/features/ai/hooks/use-ai';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';

/**
 * Prompt template list (M8, AD-6). Templates are versioned; the active version
 * is what the engine resolves.
 */

export function TemplateList() {
  const { data, isPending, isError, refetch } = useTemplates();

  if (isPending && !data) {
    return <LoadingState rows={4} label="Loading templates" />;
  }

  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const templates = data?.templates ?? [];

  if (templates.length === 0) {
    return (
      <EmptyState
        title="No prompt templates"
        description="Templates version the system prompts the engine resolves per intent."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {templates.map((template) => (
        <li
          key={template.id}
          className="bg-card text-card-foreground flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border p-3 text-sm"
        >
          <span className="font-mono text-xs">{template.key}</span>
          <span className="font-medium">{template.name}</span>
          <Badge variant={template.currentVersionId ? 'default' : 'outline'}>
            v{template.version}
          </Badge>
          <span className="text-muted-foreground ms-auto text-xs">
            {template.currentVersionId ? 'active' : 'no active version'}
          </span>
        </li>
      ))}
    </ul>
  );
}
