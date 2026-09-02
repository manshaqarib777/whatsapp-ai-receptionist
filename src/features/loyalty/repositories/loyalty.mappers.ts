import type { LoyaltyAccountRow, LoyaltyTransactionRow } from './loyalty.types';

export function toAccountRow(row: {
  id: string;
  contactId: string;
  programId: string;
  balance: number;
  totalEarned: number;
  tier: string;
  createdAt: Date;
  contact: { displayName: string };
  program: { name: string };
}): LoyaltyAccountRow {
  return {
    id: row.id,
    contactId: row.contactId,
    contactDisplayName: row.contact.displayName,
    programId: row.programId,
    programName: row.program.name,
    balance: row.balance,
    totalEarned: row.totalEarned,
    tier: row.tier as LoyaltyAccountRow['tier'],
    createdAt: row.createdAt,
  };
}

export function toTransactionRow(row: {
  id: string;
  accountId: string;
  invoiceId: string | null;
  kind: string;
  pointsDelta: number;
  reason: string | null;
  createdAt: Date;
}): LoyaltyTransactionRow {
  return { ...row, kind: row.kind as LoyaltyTransactionRow['kind'] };
}
