'use client';

import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateInvoice } from '@/features/invoices/hooks/use-invoices';

/**
 * Create-invoice dialog (M12). Line items with live VAT totals; the contact id
 * is a text field (the contact picker is the CRM surface, same as quotations).
 */

const VAT_RATE = 0.15;

/** Mirrors `computeTotals` in the service — client-side live preview only. */
function liveTotals(lines: { quantity: number; unitPriceAmount: number }[]) {
  let subtotal = 0;
  let tax = 0;
  for (const line of lines) {
    const lineSubtotal = line.unitPriceAmount * line.quantity;
    subtotal += lineSubtotal;
    tax += lineSubtotal * VAT_RATE;
  }
  return { subtotalAmount: subtotal, taxAmount: tax, totalAmount: subtotal + tax };
}

type DraftLine = { description: string; quantity: string; unitPrice: string };

function emptyLine(): DraftLine {
  return { description: '', quantity: '1', unitPrice: '' };
}

export function CreateInvoiceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateInvoice();
  const [contactId, setContactId] = useState('');
  const [quoteId, setQuoteId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);

  const parsedLines = lines
    .filter((l) => l.description.trim())
    .map((l) => ({
      description: l.description.trim(),
      quantity: Number(l.quantity) || 0,
      unitPriceAmount: Number(l.unitPrice) || 0,
    }));
  const totals = liveTotals(parsedLines);

  const submit = () => {
    if (!contactId.trim() || parsedLines.length === 0) return;
    create.mutate(
      {
        contactId: contactId.trim(),
        ...(quoteId.trim() ? { quoteId: quoteId.trim() } : {}),
        ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
        lineItems: parsedLines,
      },
      {
        onSuccess: () => {
          setContactId('');
          setQuoteId('');
          setDueAt('');
          setLines([emptyLine()]);
          onOpenChange(false);
        },
      },
    );
  };

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New invoice</DialogTitle>
          <DialogDescription>
            Line items are priced with 15% VAT. The invoice starts as a draft.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="invoice-contact">Contact id</Label>
              <Input
                id="invoice-contact"
                value={contactId}
                onChange={(event) => setContactId(event.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-due">Due date</Label>
              <Input
                id="invoice-due"
                type="date"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invoice-quote">Quote id (optional — copies line items)</Label>
            <Input
              id="invoice-quote"
              value={quoteId}
              onChange={(event) => setQuoteId(event.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Line items</p>
            {lines.map((line, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_3.5rem_6rem_auto] items-center gap-2"
              >
                <Input
                  aria-label={`Line ${index + 1} description`}
                  value={line.description}
                  onChange={(event) =>
                    updateLine(index, { description: event.target.value })
                  }
                  placeholder="Description"
                />
                <Input
                  aria-label={`Line ${index + 1} quantity`}
                  type="number"
                  min="0"
                  value={line.quantity}
                  onChange={(event) =>
                    updateLine(index, { quantity: event.target.value })
                  }
                />
                <Input
                  aria-label={`Line ${index + 1} unit price`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unitPrice}
                  onChange={(event) =>
                    updateLine(index, { unitPrice: event.target.value })
                  }
                  placeholder="Unit price"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove line ${index + 1}`}
                  disabled={lines.length === 1}
                  onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
            >
              Add line
            </Button>
          </div>

          <dl className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{totals.subtotalAmount.toFixed(2)} SAR</dd>
            </div>
            <div className="flex justify-between">
              <dt>VAT (15%)</dt>
              <dd className="tabular-nums">{totals.taxAmount.toFixed(2)} SAR</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{totals.totalAmount.toFixed(2)} SAR</dd>
            </div>
          </dl>
        </div>

        {create.isError ? (
          <p className="text-destructive text-sm">Could not create the invoice.</p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!contactId.trim() || parsedLines.length === 0 || create.isPending}
            onClick={submit}
          >
            {create.isPending ? 'Creating…' : 'Create invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
