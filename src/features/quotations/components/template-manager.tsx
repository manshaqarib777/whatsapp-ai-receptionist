'use client';

import { useState } from 'react';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateTemplate, useQuoteTemplates } from '@/features/quotations/hooks/use-quotations';

/**
 * Quote templates (M11) — name, body template, and a branding footer.
 */

export function TemplateManager() {
  const { data, isPending, isError, refetch } = useQuoteTemplates();
  const [createOpen, setCreateOpen] = useState(false);

  if (isPending && !data) {
    return <LoadingState rows={3} label="Loading templates" />;
  }
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const templates = data?.templates ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Templates</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          New template
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Templates carry the quote body and branding."
        />
      ) : (
        <ul className="bg-card divide-border divide-y rounded-xl border">
          {templates.map((template) => (
            <li key={template.id} className="px-4 py-3">
              <p className="text-sm font-medium">{template.name}</p>
              <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                {template.bodyTemplate}
              </p>
              {template.branding?.footer ? (
                <p className="text-muted-foreground mt-1 text-xs">Footer: {template.branding.footer}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <CreateTemplateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateTemplateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateTemplate();
  const [name, setName] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [footer, setFooter] = useState('');

  const submit = () => {
    if (!name.trim() || !bodyTemplate.trim()) return;
    create.mutate(
      {
        name: name.trim(),
        bodyTemplate: bodyTemplate.trim(),
        footer: footer.trim() || undefined,
      },
      {
        onSuccess: () => {
          setName('');
          setBodyTemplate('');
          setFooter('');
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New template</DialogTitle>
          <DialogDescription>
            The body template and footer appear on generated quote PDFs.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Standard treatment plan"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="template-body">Body template</Label>
            <Textarea
              id="template-body"
              value={bodyTemplate}
              onChange={(event) => setBodyTemplate(event.target.value)}
              rows={4}
              placeholder="Thank you for choosing our clinic. This quote covers…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="template-footer">Branding footer</Label>
            <Input
              id="template-footer"
              value={footer}
              onChange={(event) => setFooter(event.target.value)}
              placeholder="Optional — e.g. a disclaimer"
            />
          </div>
        </div>
        {create.isError ? (
          <p className="text-destructive text-sm">Could not create the template.</p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || !bodyTemplate.trim() || create.isPending} onClick={submit}>
            {create.isPending ? 'Creating…' : 'Create template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
