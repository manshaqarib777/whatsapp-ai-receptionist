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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateTag, useTags } from '@/features/crm/hooks/use-crm';

/**
 * Tag manager (M10): list + create. Tagging subjects happens on the deal drawer.
 */

const TAG_COLORS = ['neutral', 'info', 'success', 'warning', 'danger'] as const;
const COLOR_LABELS: Record<string, string> = {
  neutral: 'Neutral',
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
  danger: 'Danger',
};

export function TagManager() {
  const { data, isPending, isError, refetch } = useTags();
  const [createOpen, setCreateOpen] = useState(false);

  if (isPending && !data) {
    return <LoadingState rows={4} label="Loading tags" />;
  }
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const tags = data?.tags ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tags</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          New tag
        </Button>
      </div>

      {tags.length === 0 ? (
        <EmptyState title="No tags yet" description="Create a tag to label deals and contacts." />
      ) : (
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag.id}>
              <Badge variant="secondary">{tag.name}</Badge>
            </li>
          ))}
        </ul>
      )}

      <CreateTagDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateTagDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateTag();
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>('neutral');

  const submit = () => {
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), color },
      {
        onSuccess: () => {
          setName('');
          setColor('neutral');
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New tag</DialogTitle>
          <DialogDescription>Tags label deals and contacts across the CRM.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tag-name">Name</Label>
            <Input
              id="tag-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Insurance"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tag-color">Color</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger id="tag-color">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAG_COLORS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {COLOR_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {create.isError ? (
          <p className="text-destructive text-sm">Could not create the tag.</p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || create.isPending} onClick={submit}>
            {create.isPending ? 'Creating…' : 'Create tag'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
