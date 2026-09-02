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
import { useCompanies, useCreateCompany } from '@/features/crm/hooks/use-crm';

/**
 * Companies list + create dialog (M10).
 */

export function CompanyList() {
  const { data, isPending, isError, refetch } = useCompanies();
  const [createOpen, setCreateOpen] = useState(false);

  if (isPending && !data) {
    return <LoadingState rows={5} label="Loading companies" />;
  }
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const companies = data?.companies ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Companies</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          Add company
        </Button>
      </div>

      {companies.length === 0 ? (
        <EmptyState
          title="No companies yet"
          description="Add a company to link contacts and deals."
        />
      ) : (
        <ul className="bg-card divide-border divide-y rounded-xl border">
          {companies.map((company) => (
            <li
              key={company.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{company.name}</p>
                {company.vatNumber ? (
                  <p className="text-muted-foreground text-xs">{company.vatNumber}</p>
                ) : null}
              </div>
              <Badge variant="outline">{company.contactCount} contacts</Badge>
              <Badge variant="outline">{company.dealCount} deals</Badge>
            </li>
          ))}
        </ul>
      )}

      <CreateCompanyDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateCompanyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateCompany();
  const [name, setName] = useState('');
  const [vatNumber, setVatNumber] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), vatNumber: vatNumber.trim() || undefined },
      {
        onSuccess: () => {
          setName('');
          setVatNumber('');
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add company</DialogTitle>
          <DialogDescription>
            Companies link contacts and deals together.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="company-name">Name</Label>
            <Input
              id="company-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Alrajhi Logistics"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company-vat">VAT number</Label>
            <Input
              id="company-vat"
              value={vatNumber}
              onChange={(event) => setVatNumber(event.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
        {create.isError ? (
          <p className="text-destructive text-sm">Could not create the company.</p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || create.isPending} onClick={submit}>
            {create.isPending ? 'Adding…' : 'Add company'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
