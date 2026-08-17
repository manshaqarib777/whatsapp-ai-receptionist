'use client';

import { useState } from 'react';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
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

import {
  useCreateTemplate,
  useTemplates,
} from '@/features/broadcast/hooks/use-broadcast';

/**
 * Template manager (M14) — list + create. The Meta approval status gates use:
 * only an `approved` template can be attached to a campaign.
 */

export function TemplateManager() {
  const { data, isPending, isError, refetch } = useTemplates();
  const [createOpen, setCreateOpen] = useState(false);

  if (isPending && !data) {
    return <LoadingState rows={3} label="Loading templates" />;
  }
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const templates = data?.templates ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>New template</Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Create a template with a body and it becomes available to campaigns."
        />
      ) : (
        <ul className="bg-card text-card-foreground divide-y overflow-hidden rounded-xl border">
          {templates.map((template) => (
            <li
              key={template.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {template.name}{' '}
                  <span className="text-muted-foreground text-xs">
                    ({template.language})
                  </span>
                </p>
                <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                  {typeof template.body === 'object' &&
                  template.body !== null &&
                  'body' in (template.body as Record<string, unknown>)
                    ? String(
                        (template.body as Record<string, unknown>)['body'] ??
                          'No body text',
                      )
                    : 'No body text'}
                </p>
              </div>
              <Badge
                variant={template.metaStatus === 'approved' ? 'secondary' : 'outline'}
              >
                {template.metaStatus}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <CreateTemplateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function CreateTemplateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateTemplate();
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('en');
  const [body, setBody] = useState('');

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || !body.trim()) return;
    create.mutate(
      {
        name: trimmed,
        language,
        body: { body: body.trim() },
      },
      {
        onSuccess: () => {
          setName('');
          setLanguage('en');
          setBody('');
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New template</DialogTitle>
          <DialogDescription>
            A WhatsApp message template with a body. New templates are approved locally so
            campaigns can use them immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Checkup reminder"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-language">Language</Label>
            <Input
              id="template-language"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              placeholder="e.g. en or ar"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-body">Body</Label>
            <Textarea
              id="template-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Hi {{1}}, your appointment is coming up…"
              rows={4}
            />
          </div>
        </div>
        {create.isError ? (
          <p className="text-destructive text-sm">Could not create the template.</p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || !body.trim() || create.isPending}
            onClick={submit}
          >
            {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
