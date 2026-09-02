'use client';

import { FileText } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSource, useUploadDocument } from '@/features/knowledge/hooks/use-knowledge';
import type { KnowledgeDocumentRow } from '@/features/knowledge/repositories/knowledge.repository';

/**
 * Documents belonging to a source (AD-1), plus the upload form for it.
 *
 * `knowledge:write` gates the upload; the list is `knowledge:read`.
 */

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending',
  approved: 'Approved',
  archived: 'Archived',
};

export function DocumentList({ sourceId }: { sourceId: string }) {
  const { data, isPending, isError, refetch } = useSource(sourceId);
  const upload = useUploadDocument(sourceId);
  const [title, setTitle] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (isPending && !data) {
    return <LoadingState rows={5} label="Loading documents" />;
  }

  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const source = data.source;
  const documents = source.documents;

  function submitUpload(event: React.FormEvent) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    upload.mutate(
      { title: title || file.name, file },
      {
        onSuccess: () => {
          toast.success('Upload queued for ingestion.');
          setTitle('');
          if (fileRef.current) fileRef.current.value = '';
        },
        onError: () => toast.error('Could not queue the upload.'),
      },
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submitUpload} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`title-${sourceId}`}>Title</Label>
          <Input
            id={`title-${sourceId}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Policy handbook"
            className="w-56"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`file-${sourceId}`}>File</Label>
          <Input
            id={`file-${sourceId}`}
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.csv,application/pdf,text/csv"
            className="w-64"
          />
        </div>
        <Button type="submit" disabled={upload.isPending}>
          {upload.isPending ? 'Uploading…' : 'Upload'}
        </Button>
      </form>

      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Upload a PDF, DOCX, or CSV to start indexing this source."
        />
      ) : (
        <div className="rounded-2xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc: KnowledgeDocumentRow) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/knowledge/documents/${doc.id}`}
                      className="hover:underline"
                    >
                      {doc.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {doc.fileName ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={doc.currentStatus === 'approved' ? 'default' : 'secondary'}
                    >
                      {doc.currentStatus
                        ? (STATUS_LABEL[doc.currentStatus] ?? doc.currentStatus)
                        : '—'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
