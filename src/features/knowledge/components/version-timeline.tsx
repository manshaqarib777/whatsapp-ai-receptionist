'use client';

import { CheckCircle2, Clock, FileText, Send, Archive, CircleDashed } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import {
  useApproveVersion,
  useArchiveVersion,
  useDocument,
  useSubmitVersion,
} from '@/features/knowledge/hooks/use-knowledge';
import type { KnowledgeVersionRow } from '@/features/knowledge/repositories/knowledge.repository';

/**
 * A document's version timeline with approval actions (AD-4).
 *
 * The approval gate: an approved version becomes the document's current version,
 * which is the only one retrieval can see. `knowledge:approve` gates the approve/
 * archive buttons.
 */

const STATUS_META: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline'; icon: typeof Clock }
> = {
  draft: { label: 'Draft', variant: 'outline', icon: CircleDashed },
  pending_approval: { label: 'Pending approval', variant: 'secondary', icon: Clock },
  approved: { label: 'Approved', variant: 'default', icon: CheckCircle2 },
  archived: { label: 'Archived', variant: 'outline', icon: Archive },
};

export function VersionTimeline({ documentId }: { documentId: string }) {
  const { data, isPending, isError, refetch } = useDocument(documentId);

  if (isPending && !data) {
    return <LoadingState rows={4} label="Loading versions" />;
  }

  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const document = data.document;

  if (document.versions.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No versions yet"
        description="Upload a new version of this document to get started."
      />
    );
  }

  return (
    <ol className="space-y-3">
      {document.versions.map((version) => (
        <VersionRow
          key={version.id}
          version={version}
          documentId={documentId}
          isCurrent={version.id === document.currentVersionId}
        />
      ))}
    </ol>
  );
}

function VersionRow({
  version,
  documentId,
  isCurrent,
}: {
  version: KnowledgeVersionRow;
  documentId: string;
  isCurrent: boolean;
}) {
  const submit = useSubmitVersion();
  const approve = useApproveVersion();
  const archive = useArchiveVersion();
  const meta =
    STATUS_META[version.status] ??
    ({ label: 'Draft', variant: 'outline', icon: CircleDashed } satisfies {
      label: string;
      variant: 'default' | 'secondary' | 'outline';
      icon: typeof Clock;
    });
  const StatusIcon = meta.icon;

  return (
    <li className="border-border flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3">
      <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-xl">
        <StatusIcon aria-hidden="true" className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">Version {version.versionNumber}</p>
          {isCurrent ? <Badge>Current</Badge> : null}
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          {version.chunkCount ? `${version.chunkCount} chunks` : 'Not indexed yet'}
          {version.approvedAt
            ? ` · approved ${new Date(version.approvedAt).toLocaleDateString()}`
            : ''}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {version.status === 'draft' ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              submit.mutate(
                { documentId, versionId: version.id },
                {
                  onSuccess: () => toast.success('Version submitted for approval.'),
                  onError: () => toast.error('Could not submit the version.'),
                },
              )
            }
            disabled={submit.isPending}
          >
            <Send aria-hidden="true" className="size-3.5" />
            Submit
          </Button>
        ) : null}

        {version.status === 'pending_approval' ? (
          <Button
            size="sm"
            onClick={() =>
              approve.mutate(
                { documentId, versionId: version.id },
                {
                  onSuccess: () => toast.success('Version approved and set current.'),
                  onError: () => toast.error('Could not approve the version.'),
                },
              )
            }
            disabled={approve.isPending}
          >
            <CheckCircle2 aria-hidden="true" className="size-3.5" />
            Approve
          </Button>
        ) : null}

        {version.status === 'pending_approval' || version.status === 'approved' ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              archive.mutate(
                { documentId, versionId: version.id },
                {
                  onSuccess: () => toast.success('Version archived.'),
                  onError: () => toast.error('Could not archive the version.'),
                },
              )
            }
            disabled={archive.isPending}
          >
            <Archive aria-hidden="true" className="size-3.5" />
            Archive
          </Button>
        ) : null}
      </div>
    </li>
  );
}
