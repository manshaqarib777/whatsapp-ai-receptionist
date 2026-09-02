'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  useCreatePayment,
  useCreateRefund,
  type Payment,
} from '@/features/invoices/hooks/use-invoices';

/**
 * Invoice payment dialogs (M12) — the record-payment dialog (Stripe test-mode
 * checkout) and the refund-a-payment dialog.
 */

export type PaymentDialogsState =
  | { kind: 'none' }
  | { kind: 'payment'; invoiceId: string; balance: number; currency: string }
  | { kind: 'refund'; payment: Payment };

export function PaymentDialogs({
  state,
  onClose,
}: {
  state: PaymentDialogsState;
  onClose: () => void;
}) {
  if (state.kind === 'none') return null;

  if (state.kind === 'payment') {
    return (
      <RecordPaymentDialog
        invoiceId={state.invoiceId}
        balance={state.balance}
        currency={state.currency}
        onClose={onClose}
      />
    );
  }

  return <RefundDialog payment={state.payment} onClose={onClose} />;
}

function RecordPaymentDialog({
  invoiceId,
  balance,
  currency,
  onClose,
}: {
  invoiceId: string;
  balance: number;
  currency: string;
  onClose: () => void;
}) {
  const createPayment = useCreatePayment();
  const [amount, setAmount] = useState('');

  const submit = () => {
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) return;
    createPayment.mutate(
      { invoiceId, gateway: 'stripe', amount: parsed },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Stripe test-mode checkout for{' '}
            {balance.toLocaleString('en', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            {currency} outstanding.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="pay-amount">Amount</Label>
          <Input
            id="pay-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        {createPayment.isError ? (
          <p className="text-destructive text-sm">
            Could not start the payment — is Stripe configured?
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!Number(amount) || createPayment.isPending} onClick={submit}>
            {createPayment.isPending ? 'Starting…' : 'Start payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefundDialog({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const refund = useCreateRefund();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const submit = () => {
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) return;
    refund.mutate(
      { paymentId: payment.id, amount: parsed, reason: reason.trim() || undefined },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Refund payment</DialogTitle>
          <DialogDescription>
            Refund {payment.amount.toFixed(2)} {payment.currency} or a partial amount.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="refund-amount">Amount</Label>
            <Input
              id="refund-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="refund-reason">Reason (optional)</Label>
            <Input
              id="refund-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>
        {refund.isError ? (
          <p className="text-destructive text-sm">Could not process the refund.</p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!Number(amount) || refund.isPending} onClick={submit}>
            {refund.isPending ? 'Refunding…' : 'Refund'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
